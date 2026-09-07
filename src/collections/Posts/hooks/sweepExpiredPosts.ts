import type { CollectionBeforeOperationHook, Payload } from 'payload'

// Posts unpublish themselves at their Expiry Date without any external scheduler.
// Payload's `schedulePublish` job used to do this, but nothing ever drained the
// queue on cPanel/Passenger (no jobs.autoRun, no vercel.json, no crontab), so the
// expiry silently never fired. Instead we sweep on read: any published post whose
// expiryDate has passed is flipped to draft before the query that noticed runs.

/** Minimum gap between sweeps within a single Node process. */
const SWEEP_INTERVAL_MS = 60_000

/**
 * Set on the sweep's own req so that reads triggered from inside its own
 * afterChange chain don't re-enter the sweep and await the very promise that
 * is waiting on them.
 */
export const SKIP_EXPIRY_SWEEP = 'skipExpirySweep'

let lastSweptAt = 0
let inFlight: Promise<void> | null = null

const runSweep = async (payload: Payload): Promise<void> => {
  try {
    const { docs, errors } = await payload.update({
      collection: 'posts',
      // Deliberately no `req`: the sweep gets its own transaction so it can never
      // be rolled back along with the read that happened to trigger it.
      data: { _status: 'draft' },
      depth: 0,
      overrideAccess: true,
      context: { [SKIP_EXPIRY_SWEEP]: true },
      where: {
        and: [
          { _status: { equals: 'published' } },
          { expiryDate: { exists: true } },
          { expiryDate: { less_than_equal: new Date().toISOString() } },
        ],
      },
    })

    if (docs.length) {
      payload.logger.info(
        `Expiry sweep unpublished ${docs.length} post(s): ${docs.map((d) => d.slug).join(', ')}`,
      )
    }

    // A post open in the admin editor fails on `lockDocuments`; it just gets
    // picked up by the next sweep once the lock expires. Never throw.
    for (const e of errors) {
      payload.logger.error(`Expiry sweep failed for post ${e.id}: ${e.message}`)
    }
  } catch (err) {
    // A sweep failure must never break the read that triggered it.
    payload.logger.error({ err }, 'Expiry sweep failed')
  }
}

export const sweepExpiredPosts: CollectionBeforeOperationHook<'posts'> = async ({
  args,
  operation,
  req,
}) => {
  // beforeOperation also fires on update/create/delete — without this the
  // sweep's own payload.update would re-enter this hook.
  if (operation !== 'read' && operation !== 'count') return args

  // Reads made from inside the sweep's own hook chain (plugin-search sync,
  // relationship population) would otherwise await `inFlight`, which is itself
  // waiting on them.
  if (req.context?.[SKIP_EXPIRY_SWEEP]) return args

  // generateStaticParams and the sitemap route query posts at build time. A
  // build must not mutate content — and any revalidation it queued would be
  // meaningless anyway, since there is no running server to invalidate.
  if (process.env.NEXT_PHASE === 'phase-production-build') return args

  if (Date.now() - lastSweptAt < SWEEP_INTERVAL_MS) return args

  if (!inFlight) {
    // Stamp the clock in `finally`, so a slow sweep isn't double-triggered and a
    // failing one backs off instead of retrying on every single request.
    inFlight = runSweep(req.payload).finally(() => {
      lastSweptAt = Date.now()
      inFlight = null
    })
  }

  await inFlight
  return args
}

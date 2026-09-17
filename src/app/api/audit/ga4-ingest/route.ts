import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import { ingestGa4 } from '@/lib/audit-ga4'

/**
 * The GA4 nightly ingest, for cron.
 *
 * The Audit Hub's only API route — everything else it does is a server action,
 * which POSTs to a page URL and so carries a session. Cron has no session, so
 * this needs to be a real endpoint, and it authenticates the same way Payload's
 * job runner does: a shared `CRON_SECRET` bearer token, compared here rather
 * than in middleware, which only checks that *some* authorization header is
 * present before letting the path through.
 *
 * cPanel cron, nightly (the server's timezone, not ours — check with `date`):
 *
 *   15 17 * * * /usr/bin/curl -fsS -m 600 -X POST \
 *     -H "Authorization: Bearer $CRON_SECRET" \
 *     https://<host>/api/audit/ga4-ingest >/dev/null
 *
 * `?days=400` runs the one-off backfill. Because `date` is a report dimension,
 * a 400-day pull is still one request per property, not 400.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const days = Number(new URL(req.url).searchParams.get('days'))

  // A throw here is a whole-run failure — discovery itself fell over, usually a
  // 403 because the Analytics APIs are not enabled. Caught so the response stays
  // JSON: cron reads a body, not a stack trace rendered as HTML.
  let result
  try {
    result = await ingestGa4(Number.isFinite(days) && days > 0 ? { days } : undefined)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[ga4-ingest] run failed', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }

  revalidatePath('/audit', 'layout')

  // A partial failure answers non-2xx on purpose: `curl -f` in the cron line is
  // the only alerting this deployment has, and a run that quietly half-worked
  // is exactly the one worth hearing about.
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}

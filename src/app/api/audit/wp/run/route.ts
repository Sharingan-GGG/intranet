import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import { queueAgentRun, queueContentAudits } from '@/lib/audit-queue'
import { AUDIT_BUSY, fetchWpPageStatuses, SCAN_BUSY, urlBelongsTo } from '@/lib/audit-wp'

import { withWpConnection } from '../_shared'

/**
 * Run Audit / Full Scan / Full Scan + SemRush for one page, from WordPress.
 *
 *   { url, kind: 'audit' | 'full' | 'full-agent' }
 *
 * The same queue writes as the Audit Hub buttons (`src/lib/audit-queue.ts`),
 * with two extra rules the plugin also shows in its UI:
 *   - a Full Scan is only allowed for a page already on the Full Scan list
 *     (staging it stays an Audit Hub decision), and
 *   - a run that is already queued or in progress is not queued again.
 *
 * Answers with the page's fresh status, so the plugin can update its box from
 * the same response. A failed worker nudge is a `warning`, not an error: the
 * row is queued and the worker also polls, so the run is delayed, not lost.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const KINDS = ['audit', 'full', 'full-agent'] as const
type Kind = (typeof KINDS)[number]

export async function POST(req: Request): Promise<Response> {
  return withWpConnection(req, async (conn, body) => {
    const { url, kind } = body
    if (!urlBelongsTo(url, conn.domain)) {
      return NextResponse.json({ error: `url must be on ${conn.domain}.` }, { status: 400 })
    }
    if (!KINDS.includes(kind as Kind)) {
      return NextResponse.json({ error: `kind must be one of ${KINDS.join(', ')}.` }, { status: 400 })
    }

    const before = (await fetchWpPageStatuses([url], conn.domain))[url]!
    if (kind === 'audit') {
      if (AUDIT_BUSY.has(before.audit.status)) {
        return NextResponse.json(
          { error: `An audit is already ${before.audit.label.toLowerCase()}.`, status: before },
          { status: 409 },
        )
      }
    } else {
      if (!before.fullScan.inList) {
        return NextResponse.json(
          { error: 'This page is not in the Full Scan list yet.', status: before },
          { status: 409 },
        )
      }
      if (SCAN_BUSY.has(before.fullScan.status)) {
        return NextResponse.json(
          { error: `A full scan is already ${before.fullScan.label.toLowerCase()}.`, status: before },
          { status: 409 },
        )
      }
    }

    const result =
      kind === 'audit'
        ? await queueContentAudits([url], conn.domain)
        : await queueAgentRun({ url, domain: conn.domain, agentKind: kind as 'full' | 'full-agent' })

    revalidatePath('/audit', 'layout')
    const after = (await fetchWpPageStatuses([url], conn.domain))[url]!

    // "Queued, but the worker…" means the write landed; anything else did not.
    const queued = result.ok || result.error.startsWith('Queued')
    if (!queued) return NextResponse.json({ error: result.error, status: after }, { status: 500 })
    return NextResponse.json({
      ok: true,
      status: after,
      ...(result.ok ? {} : { warning: result.error }),
    })
  })
}

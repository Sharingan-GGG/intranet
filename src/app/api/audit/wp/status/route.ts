import { NextResponse } from 'next/server'

import { fetchWpPageStatuses, urlBelongsTo } from '@/lib/audit-wp'

import { withWpConnection } from '../_shared'

/**
 * Current Audit / Full Scan status for up to 100 of the site's own URLs.
 *
 * The plugin calls this when someone clicks a button (including Refresh) and
 * from its fallback interval, for the posts it still has a run in progress on.
 * The webhook is the normal path; this is the "check now".
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_URLS = 100

export async function POST(req: Request): Promise<Response> {
  return withWpConnection(req, async (conn, body) => {
    const urls = Array.isArray(body.urls) ? body.urls : []
    if (!urls.length || urls.length > MAX_URLS) {
      return NextResponse.json({ error: `Send 1–${MAX_URLS} urls.` }, { status: 400 })
    }
    const own = urls.filter((u): u is string => urlBelongsTo(u, conn.domain))
    if (own.length !== urls.length) {
      return NextResponse.json({ error: `Every url must be on ${conn.domain}.` }, { status: 400 })
    }
    const statuses = await fetchWpPageStatuses([...new Set(own)], conn.domain)
    return NextResponse.json({ ok: true, statuses })
  })
}

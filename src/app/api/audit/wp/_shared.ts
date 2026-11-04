import 'server-only'

import { NextResponse } from 'next/server'

import { authenticateWpRequest, type WpConnection } from '@/lib/audit-wp'

/**
 * Shared front door for `/api/audit/wp/*`.
 *
 * Middleware lets `/api/audit/*` through on any Authorization header and leaves
 * the secret to the route (the same split as the GA4 ingest), so this is the
 * real gate: a bearer key whose hash is in `audit.wp_connections`.
 */
export async function withWpConnection(
  req: Request,
  handler: (conn: WpConnection, body: Record<string, unknown>) => Promise<Response>,
): Promise<Response> {
  let conn: WpConnection | null
  try {
    conn = await authenticateWpRequest(req)
  } catch (err) {
    console.error('[audit-wp] auth lookup failed', err)
    return NextResponse.json({ error: 'The Audit Hub could not reach its database.' }, { status: 503 })
  }
  if (!conn) return NextResponse.json({ error: 'Unknown or disabled site key.' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try {
    const parsed = await req.json()
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed
  } catch {
    // An empty body is fine for every route; each checks its own fields.
  }

  try {
    return await handler(conn, body)
  } catch (err) {
    console.error('[audit-wp] request failed', err)
    return NextResponse.json({ error: 'The Audit Hub hit an error.' }, { status: 500 })
  }
}

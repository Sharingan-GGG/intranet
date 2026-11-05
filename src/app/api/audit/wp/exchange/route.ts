import { NextResponse } from 'next/server'

import { exchangeConnectCode } from '@/lib/audit-wp'

/**
 * Last leg of the plugin's Connect button: WordPress's server trades the
 * one-time code it received on the redirect (sent as the bearer token) plus its
 * PKCE verifier for a new site key.
 *
 *   POST  Authorization: Bearer ahc_…   { verifier }
 *   →     { ok, key, domain, site, connectedBy }
 *
 * No site key exists yet at this point, so this is the one /api/audit/wp/*
 * route that is not behind withWpConnection; the code + verifier are the
 * credential. Middleware lets it through because it carries an Authorization
 * header.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  const match = /^Bearer\s+(\S+)$/.exec(req.headers.get('authorization') ?? '')
  let verifier: unknown
  try {
    verifier = (await req.json())?.verifier
  } catch {}
  if (!match || typeof verifier !== 'string') {
    return NextResponse.json({ error: 'Send the code as a bearer token and { verifier }.' }, { status: 400 })
  }

  try {
    const result = await exchangeConnectCode(match[1]!, verifier)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[audit-wp] exchange failed', err)
    return NextResponse.json({ error: 'The Audit Hub hit an error.' }, { status: 500 })
  }
}

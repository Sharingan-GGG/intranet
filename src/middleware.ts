import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'

import { authConfig } from '@/auth.config'

/**
 * Require a login for every page, including the landing page. Users may be
 * authenticated either via Google SSO (Auth.js session — cryptographically
 * verified here, so stale/invalid cookies don't pass) or via Payload's local
 * strategy (payload-token, used by admins; validated by Payload's access
 * control on every data request).
 *
 * This edge instance of Auth.js uses only the provider/callback config — no
 * Payload adapter — which is all that's needed to decrypt and verify the
 * session cookie.
 */
const { auth } = NextAuth(authConfig)

// API prefixes that must stay reachable without a session:
// - /api/auth: Auth.js endpoints — the Google sign-in flow itself
// - /api/users: Payload admin login/me/logout — Payload enforces its own access control
const PUBLIC_API_PREFIXES = ['/api/auth/', '/api/users/']

export default auth((req) => {
  const hasSession = req.auth !== null || req.cookies.has('payload-token')

  if (hasSession) {
    return NextResponse.next()
  }

  const { pathname } = req.nextUrl

  if (pathname.startsWith('/api/')) {
    if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
      return NextResponse.next()
    }
    // Cron hits /api/payload-jobs/run with an Authorization header;
    // Payload's jobs access control validates the CRON_SECRET itself.
    if (pathname.startsWith('/api/payload-jobs/') && req.headers.has('authorization')) {
      return NextResponse.next()
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const loginUrl = new URL('/login', req.url)
  loginUrl.searchParams.set('redirect', pathname + req.nextUrl.search)
  return NextResponse.redirect(loginUrl)
})

export const config = {
  // Everything except the login page, admin panel (has its own login),
  // Next.js internals, and static assets
  matcher: ['/((?!login|admin|_next|.*\\.[\\w]+$).*)'],
}

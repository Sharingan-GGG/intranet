import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Require a login for every page, including the landing page. Users may be authenticated
 * either via Supabase Auth (Google SSO — the route everyone uses) or via Payload's local
 * strategy (payload-token, the admin fallback, validated by Payload's access control on
 * every data request).
 *
 * The Supabase client here also refreshes an expiring session and writes the rotated cookies
 * onto the response, which is why the response object has to be threaded through it rather
 * than created at the end.
 */

// Paths that must stay reachable without a session:
// - /auth/: the Supabase OAuth callback, which is what establishes the session
// - /api/auth/: Auth.js endpoints, still mounted while payload-authjs is installed
// - /api/users/: Payload admin login/me/logout — Payload enforces its own access control
const PUBLIC_PREFIXES = ['/auth/', '/api/auth/', '/api/users/']

/**
 * The Pre-Departure module is local-development-only: its brand-scoped PNR queue
 * pages and the API routes behind them are served in `next dev` but must not exist
 * on the live intranet. Gating here rather than per-route keeps the page and all
 * sixteen API endpoints behind a single check — a new /api/pnr-queue/* route is
 * covered the moment it's added.
 *
 * Both env vars below are inlined at build time, so the production image is built
 * with the module already unreachable — it cannot be switched on by an accident of
 * runtime configuration. To run it against a local production build, rebuild with
 * PRE_DEPARTURE_ENABLED=true.
 */
const PRE_DEPARTURE_PREFIXES = [
  '/pre-departure',
  '/api/legacy/',
  '/api/notes',
  '/api/pnr-queue/',
  '/api/pnr-snapshot',
  '/api/profiles',
  '/api/report-it',
  '/api/sabre/',
  '/api/sheet-import',
]

const preDepartureEnabled =
  process.env.NODE_ENV !== 'production' || process.env.PRE_DEPARTURE_ENABLED === 'true'

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Checked before the session gate: on live this must read as "no such route",
  // never as a login redirect that hints the module is there.
  if (!preDepartureEnabled && PRE_DEPARTURE_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 })
    }
    return NextResponse.rewrite(new URL('/not-found', req.url), { status: 404 })
  }

  // Checked before the session gate too: the OAuth callback is what creates the session, so
  // gating it would deadlock sign-in.
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const response = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_AUTH_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_AUTH_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => {
          for (const { name, options, value } of list) response.cookies.set(name, value, options)
        },
      },
    },
  )

  // getClaims() verifies the token rather than trusting the cookie's contents, so a stale or
  // forged session does not pass, and it refreshes the session as a side effect.
  const { data } = await supabase.auth.getClaims()
  const hasSession = Boolean(data?.claims) || req.cookies.has('payload-token')

  if (hasSession) {
    return response
  }

  if (pathname.startsWith('/api/')) {
    // Cron hits /api/payload-jobs/run with an Authorization header;
    // Payload's jobs access control validates the CRON_SECRET itself.
    if (pathname.startsWith('/api/payload-jobs/') && req.headers.has('authorization')) {
      return response
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const loginUrl = new URL('/login', req.url)
  loginUrl.searchParams.set('redirect', pathname + req.nextUrl.search)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Everything except the login page, admin panel (has its own login),
  // Next.js internals, and static assets
  matcher: ['/((?!login|admin|_next|.*\\.[\\w]+$).*)'],
}

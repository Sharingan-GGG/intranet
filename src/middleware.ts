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
// - /login: the sign-in page itself, and where the gate below sends everyone
// - /auth/: the Supabase OAuth callback, which is what establishes the session
// - /api/auth/: Auth.js endpoints, still mounted while payload-authjs is installed
// - /api/users/: Payload admin login/me/logout — Payload enforces its own access control
const PUBLIC_PREFIXES = ['/login', '/auth/', '/api/auth/', '/api/users/']

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

/**
 * Cookies that are dead weight but never expire on their own, and so accumulate in a
 * long-lived browser profile until the Cookie header outgrows the edge's header buffer and
 * every request to the site is rejected with a 400 before it ever reaches this app.
 *
 * - Auth.js/NextAuth cookies: leftovers from before the Supabase Auth migration.
 *   payload-authjs stays installed (see auth.ts), but nothing signs in through it anymore,
 *   so nobody ever clears these.
 * - Supabase session cookies belonging to a *different* project than the one SSO points at
 *   now: each project ref gets its own cookie name, so switching projects orphans the old
 *   set — chunked into `.0`, `.1`, … and several KB each.
 */
const STALE_AUTHJS_COOKIE = /^(__Secure-|__Host-)?authjs\./
const SUPABASE_SESSION_COOKIE = /^sb-.+-auth-token(-code-verifier)?(\.\d+)?$/

// Only derivable for a hosted project (`https://<ref>.supabase.co`); on a local Docker stack
// the storage key is not the hostname, so foreign-project cleanup is skipped rather than
// guessed at — deleting the live session's own cookies would log everyone out on each request.
const currentSupabaseCookiePrefix = (() => {
  try {
    const { hostname } = new URL(process.env.NEXT_PUBLIC_SUPABASE_AUTH_URL!)
    return hostname.endsWith('.supabase.co') ? `sb-${hostname.split('.')[0]}-auth-token` : null
  } catch {
    return null
  }
})()

/**
 * A browser ignores a Set-Cookie whose name carries the `__Secure-`/`__Host-` prefix unless
 * the Secure attribute is present, and `response.cookies.delete(name)` does not send it
 * (it defaults Path=/ and an epoch Expires, nothing else). Over https that makes the delete
 * a silent no-op for exactly the cookies that need clearing — which is why the previous
 * cleanup never actually removed anything in production. Hence Secure is set explicitly here.
 * No Domain is set, which both matches how these were written and is what `__Host-` requires.
 */
function expireStaleAuthCookies(req: NextRequest, response: NextResponse) {
  for (const { name } of req.cookies.getAll()) {
    const isStaleAuthjs = STALE_AUTHJS_COOKIE.test(name)
    const isForeignSupabaseSession =
      currentSupabaseCookiePrefix !== null &&
      SUPABASE_SESSION_COOKIE.test(name) &&
      !name.startsWith(currentSupabaseCookiePrefix)

    if (!isStaleAuthjs && !isForeignSupabaseSession) continue

    response.cookies.set(name, '', {
      expires: new Date(0),
      maxAge: 0,
      path: '/',
      secure: name.startsWith('__Secure-') || name.startsWith('__Host-'),
    })
  }
}

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
  // gating it would deadlock sign-in. The cleanup still runs — a browser whose cookies have
  // gone stale is most likely to be sitting on /login, and that is the one page it can reach
  // without a session.
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    const publicResponse = NextResponse.next({ request: req })
    expireStaleAuthCookies(req, publicResponse)
    return publicResponse
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
    expireStaleAuthCookies(req, response)
    return response
  }

  if (pathname.startsWith('/api/')) {
    // Cron hits /api/payload-jobs/run with an Authorization header;
    // Payload's jobs access control validates the CRON_SECRET itself.
    if (pathname.startsWith('/api/payload-jobs/') && req.headers.has('authorization')) {
      return response
    }
    const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    expireStaleAuthCookies(req, unauthorized)
    return unauthorized
  }

  const loginUrl = new URL('/login', req.url)
  loginUrl.searchParams.set('redirect', pathname + req.nextUrl.search)
  const redirect = NextResponse.redirect(loginUrl)
  expireStaleAuthCookies(req, redirect)
  return redirect
}

export const config = {
  // Everything except the admin panel (has its own login), Next.js internals, and static
  // assets. /login is matched — it returns early above, but the cookie cleanup has to run
  // there, since that is where a browser with a broken session ends up.
  matcher: ['/((?!admin|_next|.*\\.[\\w]+$).*)'],
}

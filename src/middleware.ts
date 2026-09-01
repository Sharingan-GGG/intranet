import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { AUTH_COOKIE_OPTIONS } from '@/lib/auth/session'

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
 * Chunks of the *current* project's session that no longer belong to it.
 *
 * @supabase/ssr stores a session either under the bare cookie name or split across `.0`,
 * `.1`, …, and deletes the chunks it no longer needs on every write. Those deletes are
 * silently dropped when the write happens in a Server Component (see the swallowed error in
 * src/lib/auth/supabase-server.ts), so a session that shrinks from three chunks to two can
 * strand `.2` in the browser forever. Unlike the two cases above, an orphan carries the
 * current project's prefix, so it reads as live and nothing ever removes it — and at up to
 * 3KB each, a couple of them are enough to push the Cookie header past what the edge accepts.
 *
 * A valid chunk set is contiguous from `.0`, so anything past the first gap is an orphan, as
 * is every chunk when an unchunked cookie of the same name is also present. A non-contiguous
 * set means the session is already unreadable, so clearing it costs a re-login rather than
 * leaving the browser wedged.
 */
function orphanedSessionChunks(names: string[]): string[] {
  if (currentSupabaseCookiePrefix === null) return []

  const chunks = new Map<number, string>()
  for (const name of names) {
    const match = /^(.+)\.(\d+)$/.exec(name)
    if (match && match[1] === currentSupabaseCookiePrefix) chunks.set(Number(match[2]), name)
  }
  if (chunks.size === 0) return []
  if (names.includes(currentSupabaseCookiePrefix)) return [...chunks.values()]

  let live = -1
  while (chunks.has(live + 1)) live++
  return [...chunks].filter(([index]) => index > live).map(([, name]) => name)
}

/**
 * A browser ignores a Set-Cookie whose name carries the `__Secure-`/`__Host-` prefix unless
 * the Secure attribute is present, and `response.cookies.delete(name)` does not send it
 * (it defaults Path=/ and an epoch Expires, nothing else). Over https that makes the delete
 * a silent no-op for exactly the cookies that need clearing — which is why the previous
 * cleanup never actually removed anything in production. Hence Secure is set explicitly here.
 * No Domain is set, which both matches how these were written and is what `__Host-` requires.
 */
/**
 * Early warning for the 400 described above.
 *
 * The failure is silent from the app's side: the first symptom is one person's browser being
 * rejected upstream, with nothing in this app's logs, because the request never arrives. A
 * header that is merely *growing* still arrives, so logging the approach gives the warning
 * that the wedge itself cannot.
 *
 * The threshold is the old nginx buffer (8KB) — the ceiling has since been raised well past
 * it at every hop, so crossing it is no longer fatal, which is exactly what makes it a useful
 * place to start complaining. Names and sizes only; cookie values are never logged.
 *
 * Throttled, since a browser in this state makes the same oversized request for every asset
 * on the page.
 */
const COOKIE_HEADER_WARN_BYTES = 8 * 1024
const COOKIE_HEADER_WARN_INTERVAL_MS = 60_000
let lastCookieWarningAt = 0

function warnOnOversizedCookieHeader(req: NextRequest) {
  const header = req.headers.get('cookie')
  if (header === null || header.length < COOKIE_HEADER_WARN_BYTES) return

  const now = Date.now()
  if (now - lastCookieWarningAt < COOKIE_HEADER_WARN_INTERVAL_MS) return
  lastCookieWarningAt = now

  const breakdown = req.cookies
    .getAll()
    .map(({ name, value }) => ({ name, bytes: name.length + value.length }))
    .sort((a, b) => b.bytes - a.bytes)
    .map(({ name, bytes }) => `${name}=${bytes}B`)
    .join(' ')

  console.warn(`Cookie header is ${header.length}B on ${req.nextUrl.pathname}: ${breakdown}`)
}

function expireStaleAuthCookies(
  req: NextRequest,
  response: NextResponse,
  justWritten: ReadonlySet<string> = new Set(),
) {
  warnOnOversizedCookieHeader(req)

  const names = req.cookies.getAll().map(({ name }) => name)
  const orphans = new Set(orphanedSessionChunks(names))

  for (const name of names) {
    // A refreshed session is written onto this same response before the cleanup runs, and the
    // request's cookies are the pre-refresh set. Expiring a name the refresh just wrote would
    // replace the new session with a deletion — signing the user out on a request that had in
    // fact just succeeded, and sending them back through Google to sign in again.
    if (justWritten.has(name)) continue

    const isStaleAuthjs = STALE_AUTHJS_COOKIE.test(name)
    const isForeignSupabaseSession =
      currentSupabaseCookiePrefix !== null &&
      SUPABASE_SESSION_COOKIE.test(name) &&
      !name.startsWith(currentSupabaseCookiePrefix)

    if (!isStaleAuthjs && !isForeignSupabaseSession && !orphans.has(name)) continue

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

  // Names the session refresh writes onto this response, so the cleanup below can leave them
  // alone. See the guard at the top of expireStaleAuthCookies().
  const justWritten = new Set<string>()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_AUTH_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_AUTH_PUBLISHABLE_KEY!,
    {
      cookieOptions: AUTH_COOKIE_OPTIONS,
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => {
          for (const { name, options, value } of list) {
            response.cookies.set(name, value, options)
            justWritten.add(name)
          }
        },
      },
    },
  )

  // getClaims() verifies the token rather than trusting the cookie's contents, so a stale or
  // forged session does not pass, and it refreshes the session as a side effect.
  const { data } = await supabase.auth.getClaims()
  const hasSession = Boolean(data?.claims) || req.cookies.has('payload-token')

  if (hasSession) {
    expireStaleAuthCookies(req, response, justWritten)
    return response
  }

  if (pathname.startsWith('/api/')) {
    // Cron hits /api/payload-jobs/run with an Authorization header;
    // Payload's jobs access control validates the CRON_SECRET itself.
    if (pathname.startsWith('/api/payload-jobs/') && req.headers.has('authorization')) {
      return response
    }
    const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    expireStaleAuthCookies(req, unauthorized, justWritten)
    return unauthorized
  }

  const loginUrl = new URL('/login', req.url)
  loginUrl.searchParams.set('redirect', pathname + req.nextUrl.search)
  const redirect = NextResponse.redirect(loginUrl)
  expireStaleAuthCookies(req, redirect, justWritten)
  return redirect
}

export const config = {
  // Everything except the admin panel (has its own login), Next.js internals, and static
  // assets. /login is matched — it returns early above, but the cookie cleanup has to run
  // there, since that is where a browser with a broken session ends up.
  matcher: ['/((?!admin|_next|.*\\.[\\w]+$).*)'],
}

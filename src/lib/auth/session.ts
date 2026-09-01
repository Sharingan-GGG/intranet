/**
 * How the Supabase session is encoded into cookies.
 *
 * `tokens-only` keeps just the access and refresh tokens in the cookie and moves the user
 * object elsewhere — localStorage in the browser, memory on the server. That user object is
 * ~1,650 B of a ~4.2 KB session (identities included, then base64 +33%), so dropping it is the
 * largest single reduction available without touching Supabase Auth itself.
 *
 * Why this matters: the request path is nginx -> LiteSpeed -> Passenger -> Node, and LiteSpeed
 * caps the Cookie header at ~15,875 B, at or near its maximum. nginx (32 KB) and Node (64 KB)
 * are both already past it, so the ceiling cannot be raised — a browser whose cookie jar
 * crosses it is rejected before any of this code runs, and cannot be rescued from inside the
 * app. Shrinking the session is the lever that remains.
 *
 * Safe here because nothing reads the user object out of storage: `src/middleware.ts` and
 * `src/collections/Users/supabaseStrategy.ts` use getClaims(), and the sign-in callback reads
 * `data.user` from the exchangeCodeForSession() response rather than from the session. Anything
 * added later must use getClaims() or getUser(), never `getSession().data.session.user`, which
 * is unavailable under this encoding.
 *
 * Supabase requires the same value on every client — browser, server and the read-only one
 * built from a raw Cookie header — or they cannot read each other's cookies.
 *
 * Note on what does NOT work: passing `cookieOptions: { maxAge }` to shorten the cookie's
 * 400-day lifetime is silently ignored. @supabase/ssr spreads your cookieOptions and then
 * overwrites maxAge with its own default on the next line (see DEFAULT_COOKIE_OPTIONS in
 * dist/main/cookies.js). Do not re-add it expecting an effect.
 */
export const AUTH_COOKIE_ENCODING = 'tokens-only' as const

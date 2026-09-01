/**
 * How long a session cookie is allowed to sit in a browser.
 *
 * @supabase/ssr defaults to 400 days, which is far longer than the session itself: the
 * project is configured with a 168-hour time-box and a 48-hour inactivity timeout, so a
 * cookie can outlive the session it carries by more than a year. That is how a browser
 * accumulates dead auth cookies until the Cookie header outgrows the edge's header buffer
 * and every request is rejected with a 400 before this app ever sees it (see the cleanup in
 * src/middleware.ts, which cannot rescue a browser that has already crossed that line).
 *
 * Matching the cookie's max-age to the session time-box makes anything that stops being
 * refreshed expire on its own within a week. It never signs an active user out: every token
 * refresh rewrites the cookie with a fresh window.
 *
 * Keep in step with Auth → Sessions → "Time-box user sessions" in the Supabase dashboard.
 */
export const AUTH_COOKIE_MAX_AGE_SECONDS = 168 * 60 * 60

export const AUTH_COOKIE_OPTIONS = { maxAge: AUTH_COOKIE_MAX_AGE_SECONDS }

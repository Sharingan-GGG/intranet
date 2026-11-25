import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { getCurrentUser } from './auth';
import type { User } from './types';

// SHARED PLUMBING FOR THE API ROUTES (src/app/api/quiz/**/route.ts)
//
// Every route does the same few things: find the user, read JSON, answer with the right status
// code, never cache personal data, never leak internal errors. Writing those once here keeps each
// route file short enough to read top to bottom, and guarantees they all behave the same way.
//
// Status codes used by the quiz API:
//   200 OK            successful GET
//   201 Created       attempt saved
//   204 No Content    start recorded (nothing to return)
//   400 Bad Request   body isn't JSON, or fails validation
//   401 Unauthorized  nobody signed in
//   403 Forbidden     signed in, but not allowed (report = admins only)
//   404 Not Found     no such attempt (or it's someone else's: same answer, on purpose)
//   409 Conflict      the quiz version changed since the page was opened
//   413 Too Large     body bigger than any real submission could be
//   415 Unsupported   POST without content-type: application/json
//   502 Bad Gateway   storage (Postgres) or the staff directory failed

/**
 * Personal data must never be stored by the browser cache or any proxy in between.
 * `private` = only this browser may keep it; `no-store` = don't keep it at all.
 */
export const NO_STORE = { 'cache-control': 'private, no-store' } as const;

/**
 * Biggest body we'll read. A real submission is at most ~110 KB (100 items × 20 picks × 50-char ids,
 * see the limits in schema.ts), so 256 KB is generous. Anything bigger is refused BEFORE parsing,
 * so nobody can make the server parse a giant JSON blob.
 */
export const MAX_BODY_BYTES = 256 * 1024;

/** JSON response that is never cached. */
export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: NO_STORE });
}

/** Error response: always `{ error: "…" }`, plus optional extra fields (e.g. validation `issues`). */
export function errorJson(status: number, error: string, extra?: Record<string, unknown>): Response {
  return json({ error, ...extra }, status);
}

/**
 * Reads and parses a JSON request body, with the two cheap safety checks every POST needs:
 *
 *  1. content-type must be application/json → else 415.
 *     This also blocks the classic cross-site form attack (CSRF): an HTML <form> on another
 *     website can't send application/json, and a script on another website can't send it without
 *     the browser asking our server first (CORS), which we never allow.
 *  2. Size limit → else 413. Checked on the real text, not just the content-length header,
 *     because a client can lie about the header.
 *
 * Invalid JSON → 400. On success returns the parsed value, still UNTRUSTED (`unknown`):
 * the route must run it through a zod schema next.
 */
export async function readJsonBody(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const type = request.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('application/json')) {
    return { ok: false, response: errorJson(415, 'Send the body as JSON (content-type: application/json)') };
  }

  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) return { ok: false, response: errorJson(413, 'Request body is too large') };

  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return { ok: false, response: errorJson(413, 'Request body is too large') };
  }

  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, response: errorJson(400, 'Invalid JSON') };
  }
}

/**
 * The wrapper every route uses. It:
 *   1. finds the signed-in user (getCurrentUser, auth.ts) → nobody? 401, and `handler` never runs;
 *   2. runs `handler(user)`;
 *   3. if ANYTHING throws (database down, wrong table name…): logs the real error on the
 *      SERVER with the route's label, and sends the browser a friendly 502 with no internal details.
 *
 * unstable_rethrow: Next.js uses special thrown signals internally (e.g. "this route is dynamic,
 * stop prerendering"). Those must NOT be caught and turned into a 502, so they're re-thrown first.
 *
 * Usage:  export const GET = () => withUser('quiz/status', async (user) => json(...));
 */
export async function withUser(label: string, handler: (user: User) => Promise<Response>): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) return errorJson(401, 'Not signed in');
    return await handler(user);
  } catch (err) {
    unstable_rethrow(err);
    console.error(`[${label}] failed`, err);
    return errorJson(502, 'Something went wrong on our side. Please try again in a moment.');
  }
}

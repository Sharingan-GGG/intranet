import { after } from 'next/server'

/**
 * `after()` throws when there is no request scope — a `payload run` script, a
 * seed, or the expiry sweep firing from a context Next doesn't own. A failed
 * cache revalidation must never fail the write that triggered it, so swallow it
 * and let the caller's `revalidate` TTL catch up instead.
 */
export const safeAfter = (fn: () => void): void => {
  try {
    after(fn)
  } catch {
    // No request scope — nothing to revalidate against.
  }
}

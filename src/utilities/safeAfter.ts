import { after } from 'next/server'

/**
 * Best-effort cache revalidation. A failed revalidation must never fail the
 * write that triggered it, so both ways it can fail are contained here:
 *
 * 1. `after()` itself throws when there is no request scope at all — a
 *    `payload run` script or a seed.
 * 2. The callback throws when the write happened inside a cached render:
 *    `revalidatePath`/`revalidateTag` are unsupported inside `unstable_cache`,
 *    and `after()` inherits the scope it was registered in. The expiry sweep
 *    writes from exactly there (a `beforeOperation` read hook), so this is the
 *    normal path, not an edge case.
 *
 * In both cases the caller's `revalidate` TTL is what brings the cache back in
 * line, so every cache a sweep-driven write can invalidate must carry one.
 */
export const safeAfter = (fn: () => void): void => {
  const attempt = () => {
    try {
      fn()
    } catch (err) {
      // Inside a cached render. The TTL catches up; don't let Next report this
      // as an unhandled `after()` error.
      console.warn(
        `safeAfter: revalidation skipped (${err instanceof Error ? err.message : String(err)})`,
      )
    }
  }

  try {
    after(attempt)
  } catch {
    // No request scope — nothing to revalidate against.
  }
}

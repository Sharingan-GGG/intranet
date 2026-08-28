/* ── Daily cache boundary ──────────────────────────────────────────
   Upstream seat data lands in the MySQL `results` table between
   roughly 5:00 and 6:30 AM Adelaide time. The caches below all expire
   at 8 AM Adelaide, which clears that ingestion window with room to
   spare while still serving fresh data to the first users of the day.

   The zone is pinned rather than taken from the host clock: the server
   runs UTC on Vercel, and the client cache runs on whatever timezone
   the viewer's browser is in. Both must agree on the same boundary.
   ────────────────────────────────────────────────────────────────── */

const CACHE_TIMEZONE = "Australia/Adelaide"
const CACHE_RESET_HOUR = 8

const DAY_MS = 86_400_000

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CACHE_TIMEZONE,
  hourCycle: "h23",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

/* Milliseconds elapsed since the most recent reset hour, in the pinned zone. */
function msSinceReset(now: Date): number {
  const parts = partsFormatter.formatToParts(now)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)

  const sinceMidnight =
    get("hour") * 3_600_000 + get("minute") * 60_000 + get("second") * 1000 + now.getMilliseconds()

  const since = sinceMidnight - CACHE_RESET_HOUR * 3_600_000
  return since < 0 ? since + DAY_MS : since
}

/** Epoch ms of the most recent cache boundary. Entries cached at or after
 *  this timestamp are still fresh; anything older must be refetched. */
export function lastCacheBoundaryMs(now: Date = new Date()): number {
  return now.getTime() - msSinceReset(now)
}

/** Seconds until the next boundary, for HTTP `max-age`. Floored at 60. */
export function secondsUntilNextBoundary(now: Date = new Date()): number {
  return Math.max(60, Math.floor((DAY_MS - msSinceReset(now)) / 1000))
}

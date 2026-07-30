/**
 * **Application convention:** user-visible dates and times use **Adelaide (ADL)**
 * — `Australia/Adelaide` (ACST / ACDT). Import formatters from this module instead of
 * calling `toLocaleString` / `toLocaleDateString` directly on `Date`.
 *
 * **Itinerary / GDS:** `formatAdlItineraryDateTime` treats Sabre-style `YYYY-MM-DD` plus
 * `HH:mm` or `HHmm` as a **wall clock in Adelaide** (office-local view), then formats
 * with the same ADL locale as other UI.
 */

/** Adelaide local time (ACST/ACDT per Australian government zone). */
export const ADL_TIMEZONE = "Australia/Adelaide"

const ADL_DATETIME: Intl.DateTimeFormatOptions = {
  timeZone: ADL_TIMEZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
}

const ADL_DATE: Intl.DateTimeFormatOptions = {
  timeZone: ADL_TIMEZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
}

const ADL_TIME: Intl.DateTimeFormatOptions = {
  timeZone: ADL_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
}

function toDate(input: string | number | Date): Date | null {
  const d = input instanceof Date ? input : new Date(input)
  return Number.isNaN(d.getTime()) ? null : d
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

/** `YYYY-MM-DD HH:mm` prefix (16 chars) for a UTC instant rendered in `timeZone`. */
function wallClockPrefix(utcMs: number, timeZone: string): string {
  const s = new Date(utcMs).toLocaleString("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
  return s.slice(0, 16)
}

/**
 * UTC instant for a **wall-clock** reading in Adelaide (handles DST via binary search).
 * Returns null if that wall time does not exist (e.g. spring-forward gap).
 */
export function utcMsForAdelaideWall(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): number | null {
  const target = `${year}-${pad2(month)}-${pad2(day)} ${pad2(hour)}:${pad2(minute)}`
  let lo = Date.UTC(year, month - 1, day) - 72 * 3600 * 1000
  let hi = Date.UTC(year, month - 1, day) + 72 * 3600 * 1000
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    const w = wallClockPrefix(mid, ADL_TIMEZONE)
    if (w < target) lo = mid + 1
    else hi = mid
  }
  return wallClockPrefix(lo, ADL_TIMEZONE) === target ? lo : null
}

function parseItineraryTimeParts(t: string): { h: number; m: number } | null {
  const s = t.trim()
  const m1 = /^(\d{1,2}):(\d{2})/.exec(s)
  if (m1) return { h: Number(m1[1]), m: Number(m1[2]) }
  const digits = s.replace(/\D/g, "")
  if (digits.length >= 3 && digits.length <= 4) {
    return {
      h: Number(digits.slice(0, -2)),
      m: Number(digits.slice(-2)),
    }
  }
  return null
}

/**
 * Format Sabre-style itinerary date + time as **Adelaide wall clock**, then display in
 * ADL locale (same as other app timestamps).
 */
export function formatAdlItineraryDateTime(
  dateStr: string | null | undefined,
  timeStr: string | null | undefined
): string {
  const d = dateStr != null ? String(dateStr).trim() : ""
  const t = timeStr != null ? String(timeStr).trim() : ""
  if (!d && !t) return "—"
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d)
  const tp = t ? parseItineraryTimeParts(t) : null
  if (dm && tp) {
    const y = Number(dm[1])
    const mo = Number(dm[2])
    const da = Number(dm[3])
    const utc = utcMsForAdelaideWall(y, mo, da, tp.h, tp.m)
    if (utc != null) return formatAdlDateTime(utc)
  }
  if (d && t) return `${d} ${t}`
  return d || t || "—"
}

/** Full date + time in Adelaide (ADL). */
export function formatAdlDateTime(input: string | number | Date): string {
  const dt = toDate(input)
  if (!dt) return "—"
  return dt.toLocaleString("en-AU", ADL_DATETIME)
}

/** Time of day only (Adelaide) for an absolute instant. */
export function formatAdlTime(input: string | number | Date): string {
  const dt = toDate(input)
  if (!dt) return "—"
  return dt.toLocaleString("en-AU", ADL_TIME)
}

/** Month + day in Adelaide (e.g. `12 May`) — for compact chart axes. */
export function formatAdlMonthDay(input: string | number | Date): string {
  const dt = toDate(input)
  if (!dt) return "—"
  return dt.toLocaleString("en-AU", {
    timeZone: ADL_TIMEZONE,
    month: "short",
    day: "numeric",
  })
}

/** Date only in Adelaide (ADL). */
export function formatAdlDate(input: string | number | Date): string {
  const dt = toDate(input)
  if (!dt) return "—"
  return dt.toLocaleString("en-AU", ADL_DATE)
}

// DATE FORMATTING for the quiz screens.
//
// CTG has offices in Adelaide, Sydney, Melbourne and Perth, so every person should see times in
// THEIR OWN device's time zone (their PC/laptop setting). Daylight saving is handled automatically,
// and Perth (no daylight saving) gets Perth time, which one fixed zone in code could never do.
//
// WHO FORMATS WHAT
//   Only the BROWSER knows the device's time zone. The server (usually UTC) doesn't.
//   So, on screen, always use the <LocalTime iso="…" /> component (LocalTime.tsx). It formats in
//   the browser with these functions and NO timeZone, which means "use the device's zone".
//
//   The functions here are plain and work anywhere. Calling them on the SERVER without a zone
//   gives the server's zone (usually UTC), so server code should pass FALLBACK_TIME_ZONE explicitly,
//   e.g. for an email. The CSV export does NOT use these: it stays in UTC ISO format on purpose
//   (a shared file needs one unambiguous standard, whoever downloads it).
//
// All timestamps are stored as ISO strings in UTC, e.g. "2026-11-19T03:15:00.000Z".

/**
 * Used only where there is no device to ask (server-side text such as emails), and for the
 * placeholder <LocalTime> shows for a split second before the browser takes over.
 */
export const FALLBACK_TIME_ZONE = 'Australia/Adelaide';

export type FormatOptions = {
  /** IANA zone, e.g. 'Australia/Perth'. Leave out = the device's own zone (in the browser). */
  timeZone?: string;
  /** Add the zone's short name, e.g. "ACDT", "AEST", "AWST", so a time is never ambiguous. */
  showZone?: boolean;
};

/** Shown instead of crashing when a date is missing or invalid. */
export const NO_DATE = '—';

/** ISO string → Date, or null if missing/invalid. */
export function parseIso(iso: string | undefined | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Intl formatters are slowish to create, so they're cached per (style, zone, showZone).
// (dateStyle/timeStyle can't be combined with timeZoneName, so the parts are spelled out.)
const cache = new Map<string, Intl.DateTimeFormat>();
function formatter(withTime: boolean, { timeZone, showZone = false }: FormatOptions): Intl.DateTimeFormat {
  const key = `${withTime}|${timeZone ?? 'device'}|${showZone}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
      ...(showZone ? { timeZoneName: 'short' } : {}),
      ...(timeZone ? { timeZone } : {}), // no timeZone = the device's zone
    });
    cache.set(key, f);
  }
  return f;
}

/**
 * "19 Nov 2026, 1:45 pm" (+ " ACDT" with showZone). Missing/invalid → "—".
 * Same moment in each office: Adelaide 1:45 pm ACDT · Sydney/Melbourne 2:15 pm AEDT · Perth 11:15 am AWST
 */
export function formatDateTime(iso: string | undefined | null, options: FormatOptions = {}): string {
  const d = parseIso(iso);
  return d ? formatter(true, options).format(d) : NO_DATE;
}

/**
 * "19 Nov 2026". Missing/invalid → "—".
 * The zone matters for dates too: 11:30 pm in Perth on the 18th is already the 19th in Sydney.
 */
export function formatDate(iso: string | undefined | null, options: FormatOptions = {}): string {
  const d = parseIso(iso);
  return d ? formatter(false, options).format(d) : NO_DATE;
}

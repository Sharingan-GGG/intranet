'use client';

import { useSyncExternalStore } from 'react';
import { FALLBACK_TIME_ZONE, formatDate, formatDateTime, parseIso } from './format';

// <LocalTime iso="2026-11-19T03:15:00.000Z" />
//   → "19 Nov 2026, 1:45 pm ACDT" for someone in Adelaide, "…11:15 am AWST" in Perth.
//
// WHY THIS NEEDS TO BE A BROWSER ("client") COMPONENT
//   Pages are first drawn on the SERVER, which doesn't know the reader's time zone (it usually runs
//   in UTC). If the server printed one time and the browser then printed another, React would warn
//   that the page doesn't match, and the text could flicker.
//
// HOW IT AVOIDS THAT
//   1. Server render AND the browser's first render: the same neutral placeholder (the DATE only,
//      in FALLBACK_TIME_ZONE). Both sides produce identical text, so there is no mismatch.
//   2. Right after the page comes alive in the browser, React re-renders this component with the
//      full date + time in the device's own zone (formatDateTime with no timeZone).
//
// useSyncExternalStore with "server = false, browser = true" is React's built-in way of saying
// "am I running in the browser yet?" without a useEffect + setState round trip.
//
// <time dateTime="…"> carries the exact ISO value, for screen readers and other tools.

const subscribe = () => () => {}; // nothing to listen to: the answer never changes after hydration
const inBrowser = () => true;
const onServer = () => false;

export function LocalTime({
  iso,
  dateOnly = false,
  showZone = true,
  className,
}: {
  /** ISO timestamp (UTC), as stored. Missing/invalid shows "—". */
  iso: string | undefined | null;
  /** Just the date, e.g. "Completed on 19 Nov 2026". */
  dateOnly?: boolean;
  /** Add the zone name (ACDT, AEST, AWST…). On by default for times; ignored for dateOnly. */
  showZone?: boolean;
  className?: string;
}) {
  const hydrated = useSyncExternalStore(subscribe, inBrowser, onServer);

  if (!parseIso(iso)) return <span className={className}>—</span>;

  const text = !hydrated
    ? formatDate(iso, { timeZone: FALLBACK_TIME_ZONE }) // placeholder, identical on server + first browser render
    : dateOnly
      ? formatDate(iso)                                  // device zone
      : formatDateTime(iso, { showZone });               // device zone

  return (
    <time dateTime={iso!} className={className}>
      {text}
    </time>
  );
}

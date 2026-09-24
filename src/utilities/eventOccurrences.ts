/**
 * Repeat expansion for Events, shared by the site (src/lib/homeData.ts) and the
 * admin occurrence picker, so both see exactly the same dates.
 */

export type EventSeries = {
  date: string
  repeat?: string | null
  repeatEvery?: number | null
  repeatFrequency?: string | null
}

const STEPS: Record<string, { every: number; unit: string }> = {
  weekly: { every: 1, unit: 'weeks' },
  fortnightly: { every: 2, unit: 'weeks' },
  monthly: { every: 1, unit: 'months' },
  quarterly: { every: 3, unit: 'months' },
  biannually: { every: 6, unit: 'months' },
  annually: { every: 1, unit: 'years' },
}

/** Calendar day (YYYY-MM-DD, Adelaide) of an ISO timestamp, for matching occurrences by day. */
export const dayKey = (iso: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Adelaide' }).format(new Date(iso))

/** Start of every occurrence in the series up to `horizon` (max 200), before any exceptions. */
export const seriesDates = (doc: EventSeries, horizon: Date): string[] => {
  const start = new Date(doc.date)
  const repeat = doc.repeat ?? 'none'
  if (repeat === 'none' || Number.isNaN(start.getTime())) return [doc.date]

  const step =
    repeat === 'custom'
      ? { every: Math.max(1, doc.repeatEvery ?? 1), unit: doc.repeatFrequency ?? 'weeks' }
      : STEPS[repeat]
  if (!step) return [doc.date]

  const dates: string[] = []
  const cursor = new Date(start)
  for (let i = 0; cursor <= horizon && i < 200; i++) {
    dates.push(cursor.toISOString())
    switch (step.unit) {
      case 'days':
        cursor.setDate(cursor.getDate() + step.every)
        break
      case 'weeks':
        cursor.setDate(cursor.getDate() + step.every * 7)
        break
      case 'months':
        cursor.setMonth(cursor.getMonth() + step.every)
        break
      case 'years':
        cursor.setFullYear(cursor.getFullYear() + step.every)
        break
      default:
        return dates
    }
  }
  return dates
}

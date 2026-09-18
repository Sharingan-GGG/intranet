/**
 * The GA4 stat card, and the arrow under it.
 *
 * Lifted out of `traffic.tsx` once the Dashboard grew GA4 cards of its own: a
 * second copy would have been two cards that look alike until someone changes
 * one, and the delta's colour rule below is exactly the sort of thing that
 * gets fixed in one place and not the other.
 */

export function Ga4Stat({
  label,
  value,
  delta,
  note,
  lowerIsBetter,
}: {
  label: string
  value: string
  delta?: number | null
  note?: string
  lowerIsBetter?: boolean
}) {
  return (
    <div className="card stat">
      {/* Clipped to one line by `.audit-summary .stat-label`, so the full text
          has to be reachable somehow — "Traffic Type - Organic Search" is
          already too long for a seventh of the strip. */}
      <span className="stat-label" title={label}>
        {label}
      </span>
      <span className="stat-value tnum">{value}</span>
      {/* "vs previous" is only said when there is an arrow to qualify — on a
          card with no comparison it named a window nothing was measured
          against. A caption passed explicitly always shows; otherwise the line
          falls back to a non-breaking space, which is what keeps every card in
          the strip the same height. */}
      <span className="stat-sub">
        <Ga4Delta value={delta ?? null} lowerIsBetter={lowerIsBetter} />{' '}
        <span className="muted">{note ?? (delta == null ? '\u00a0' : 'vs previous')}</span>
      </span>
    </div>
  )
}

/**
 * The arrow says which way it moved; the colour says whether that is good.
 *
 * They are not the same question — a bounce rate falling is a green ▼ — and
 * colouring by direction alone would call every improvement in it a loss.
 */
function Ga4Delta({
  value,
  lowerIsBetter,
}: {
  value: number | null
  lowerIsBetter?: boolean
}) {
  if (value === null) return null
  const up = value >= 0
  const good = lowerIsBetter ? !up : up
  return (
    <span className={`ga4-delta ${good ? 'ga4-delta--up' : 'ga4-delta--down'}`}>
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(0)}%
    </span>
  )
}

/** Percent change, or null when the previous window has nothing to compare to. */
export function ga4DeltaOf(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous <= 0) return null
  return ((current - previous) / previous) * 100
}

export function ga4Pct(v: number | null): string {
  return v === null ? '—' : `${(v * 100).toFixed(1)}%`
}

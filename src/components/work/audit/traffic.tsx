'use client'

/**
 * The Traffic screen: GA4 engagement for one site, page by page.
 *
 * Deliberately the Dashboard's shape — the same summary strip, the same
 * two-row toolbar with the site select on the right, the same `.audit-table`
 * chrome — because it is the same job on a different data source, and a second
 * table design for it would be a second thing to keep in step.
 *
 * What it does not copy is the Dashboard's row machinery: there is nothing to
 * tick, star, assign or queue here, so there is no select column, no bulk bar
 * and no favourites.
 */
import { ArrowUpRightIcon, RefreshCwIcon } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { refreshGa4 } from '@/app/audit/actions'
import { SITES, type Site } from '@/lib/audit-config'
import { auditPath } from '@/lib/audit-route'
import {
  GA4_ALL_CHANNELS,
  GA4_RANGES,
  type Ga4Cards,
  type Ga4ChannelTotals,
  type Ga4PageEngagement,
  type Ga4RangeDays,
} from '@/lib/audit-types'

/**
 * The metric columns, and the order they appear in.
 *
 * One list drives the toggles, the header and the body, so a metric cannot end
 * up in the chips but missing from the table.
 */
const METRICS = [
  { key: 'activeUsers', label: 'Active Users', short: 'Users' },
  { key: 'newUsers', label: 'New Users', short: 'New' },
  { key: 'sessions', label: 'Sessions', short: 'Sessions' },
  { key: 'engagedSessions', label: 'Engaged Sessions', short: 'Engaged' },
  { key: 'engagementRate', label: 'Engagement Rate', short: 'Engage %' },
  {
    key: 'avgEngagementTime',
    label: 'Average engagement time per active user',
    short: 'Avg. Time',
  },
  { key: 'views', label: 'Pageviews', short: 'Views' },
  { key: 'viewsPerUser', label: 'Views per active user', short: 'Views/User' },
] as const

type MetricKey = (typeof METRICS)[number]['key']

/** Everything but the two derived ratios, which are the least-asked-for pair. */
const DEFAULT_METRICS: MetricKey[] = [
  'activeUsers',
  'newUsers',
  'sessions',
  'engagementRate',
  'avgEngagementTime',
  'views',
]

const STORAGE_KEY = 'audit:traffic:metrics'

const RANGE_LABEL: Record<Ga4RangeDays, string> = {
  7: '7 days',
  28: '28 days',
  90: '90 days',
  365: '12 months',
}

type Props = {
  site: Site
  days: Ga4RangeDays
  channel: string
  channels: Ga4ChannelTotals[]
  cards: Ga4Cards | null
  hasProperty: boolean
  pages: Ga4PageEngagement[] | null
  error: string | null
  freshness: { maxDate: string | null; fetchedAt: string | null; properties: number }
}

export function AuditTraffic({
  site,
  days,
  channel,
  channels,
  cards,
  hasProperty,
  pages,
  error,
  freshness,
}: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [shown, setShown] = useState<MetricKey[]>(DEFAULT_METRICS)

  // Read the saved columns after mount, not during render: localStorage is not
  // available on the server, and seeding state from it would be a hydration
  // mismatch — the same trap the topbar's theme toggle documents.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return
      const valid = parsed.filter((k): k is MetricKey =>
        METRICS.some((m) => m.key === k),
      )
      if (valid.length > 0) setShown(valid)
    } catch {
      // A private window, or blocked site data. The defaults are fine.
    }
  }, [])

  /**
   * Open a page's drawer from anywhere on its row.
   *
   * `push`, not `replace`: the drawer is a history entry, and closing it is a
   * `back()`. Clicks that landed on a link are left alone — the row and the
   * path link are two destinations, and the browser already knows what to do
   * with the one it was given.
   */
  function openPage(e: React.MouseEvent, pagePath: string) {
    if ((e.target as HTMLElement).closest('a')) return
    router.push(
      auditPath({
        screen: 'traffic-page',
        path: pagePath,
        domain: site.domain,
        days,
        channel: channel === GA4_ALL_CHANNELS ? undefined : channel,
      }),
    )
  }

  function toggleMetric(key: MetricKey) {
    setShown((prev) => {
      // Order comes from METRICS, not from click order, so the columns do not
      // shuffle as you toggle them.
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      const ordered = METRICS.filter((m) => next.includes(m.key)).map((m) => m.key)
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ordered))
      } catch {
        // Not worth failing a click over.
      }
      return ordered
    })
  }

  function setParam(key: string, value: string) {
    const q = new URLSearchParams(params?.toString() ?? '')
    q.set(key, value)
    // Channels are per-property, so one site's selection is meaningless on
    // another — switching site drops the filter rather than showing an empty
    // table under a channel name that site never saw.
    if (key === 'domain') q.delete('channel')
    startTransition(() => router.replace(`/audit/traffic?${q}`, { scroll: false }))
  }

  const visible = useMemo(() => {
    if (!pages) return []
    const q = search.trim().toLowerCase()
    return q
      ? pages.filter(
          (p) =>
            p.pageTitle.toLowerCase().includes(q) || p.pagePath.toLowerCase().includes(q),
        )
      : pages
  }, [pages, search])

  const columns = useMemo(() => METRICS.filter((m) => shown.includes(m.key)), [shown])

  /**
   * The chips to render: All first, then each channel by session count.
   *
   * All is a chip rather than an implied state — with no select left, "no
   * filter" needs something to click, and showing the unfiltered total beside
   * the parts is what makes the parts legible.
   *
   * A `?channel=` that is not in the list (a stale link, or a channel with no
   * traffic in the chosen window) gets a synthetic zero chip, so the screen
   * always offers a way back to All.
   */
  const chips = useMemo(() => {
    const total = channels.reduce((a, c) => a + c.sessions, 0)
    const out = [
      { key: GA4_ALL_CHANNELS, label: 'All', sessions: total },
      ...channels.map((c) => ({ key: c.channel, label: c.channel, sessions: c.sessions })),
    ]
    if (channel !== GA4_ALL_CHANNELS && !channels.some((c) => c.channel === channel)) {
      out.splice(1, 0, { key: channel, label: channel, sessions: 0 })
    }
    return out
  }, [channels, channel])

  async function onRefresh() {
    setRefreshing(true)
    const result = await refreshGa4()
    setRefreshing(false)
    if (!result.ok) toast.error(result.error)
    else {
      toast.success('GA4 refreshed.')
      router.refresh()
    }
  }

  return (
    <div className="shell audit-traffic">
      {/* No visible page header: the topbar already brands the hub and marks
          Traffic as the current screen, so a title block under it was saying the
          same thing twice. The heading itself stays for the document outline and
          for screen readers, which have no topbar to read. */}
      <h1 className="sr-only">Traffic</h1>

      {/* Six figures chosen for what this hub is for, not generic analytics.
          Organic Share and AI Assistant are the SEO and GEO signals; the other
          four say whether that traffic did anything. */}
      <section className="audit-summary audit-summary--six" data-cols="6">
        <Stat
          label="Organic Share"
          value={cards ? pct(cards.organicShare) : '—'}
          delta={cards ? deltaOf(cards.organicShare, cards.prevOrganicShare) : null}
          note="of all traffic"
        />
        <Stat
          label="GEO Data"
          value={cards ? fmt(cards.aiAssistant) : '—'}
          delta={cards ? deltaOf(cards.aiAssistant, cards.prevAiAssistant) : null}
          note="AI assistant sessions"
        />
        <Stat
          label="Key Events"
          value={cards ? fmt(cards.keyEvents) : '—'}
          delta={cards ? deltaOf(cards.keyEvents, cards.prevKeyEvents) : null}
        />
        <Stat
          label="Bounce Rate"
          value={cards ? pct(cards.bounceRate) : '—'}
          delta={cards ? deltaOf(cards.bounceRate, cards.prevBounceRate) : null}
          lowerIsBetter
        />
        <Stat
          label="Views / Session"
          value={cards ? cards.viewsPerSession.toFixed(2) : '—'}
          delta={cards ? deltaOf(cards.viewsPerSession, cards.prevViewsPerSession) : null}
        />
        <Stat
          label="Sessions / User"
          value={cards ? cards.sessionsPerUser.toFixed(2) : '—'}
          delta={cards ? deltaOf(cards.sessionsPerUser, cards.prevSessionsPerUser) : null}
        />
      </section>

      {chips.length > 1 && (
        <div className="ga4-channels">
          {chips.map((c) => {
            const on = c.key === channel
            return (
              <button
                key={c.key}
                type="button"
                className={`ga4-channel${on ? ' ga4-channel--on' : ''}${
                  c.key === GA4_ALL_CHANNELS ? ' ga4-channel--all' : ''
                }`}
                aria-pressed={on}
                disabled={pending}
                onClick={() => setParam('channel', c.key)}
                title={
                  c.key === GA4_ALL_CHANNELS
                    ? `${fmt(c.sessions)} sessions from every channel`
                    : `${fmt(c.sessions)} sessions from ${c.label}`
                }
              >
                <span className="ga4-channel__label">{c.label}</span>
                <span className="ga4-channel__value tnum">{fmt(c.sessions)}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* One toolbar, two rows, the same structure as the Dashboard's: the top
          row says what you are looking at and what you are looking for inside
          it; the controls row holds everything that acts on it — the site it is
          scoped to, then the columns. */}
      <div className="audit-toolbar mb-4">
        <div className="audit-toolbar__tabs">
          <nav className="audit-tabs seg seg-mode" aria-label="Date range">
            {GA4_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                className={`seg-btn${r === days ? ' seg-on' : ''}`}
                aria-current={r === days ? 'page' : undefined}
                disabled={pending}
                onClick={() => setParam('days', String(r))}
              >
                {RANGE_LABEL[r]}
              </button>
            ))}
          </nav>

          <span className="audit-toolbar__count small muted tnum">
            {pages ? `${visible.length} of ${pages.length}` : '—'}
          </span>

          <div className="audit-search">
            <input
              type="search"
              className="audit-search__input input"
              title="Filter by page title or path"
              placeholder="Filter pages…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Filter pages by title or path"
            />
          </div>

          {/* The freshness note is this button's tooltip rather than a line of
              prose: same warning, on the control that acts on it. */}
          <button
            type="button"
            className="btn btn-sm"
            disabled={refreshing}
            onClick={onRefresh}
            title={freshnessLine(freshness, channel)}
          >
            <RefreshCwIcon size={14} className={refreshing ? 'ga4-spin' : undefined} aria-hidden />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <div className="audit-toolbar__controls">
          <div className="audit-toolbar__scope">
            <select
              className="audit-toolbar__site input w-auto"
              value={site.domain}
              onChange={(e) => setParam('domain', e.target.value)}
              aria-label="Site"
            >
              {SITES.map((s) => (
                <option key={s.domain} value={s.domain}>
                  {s.short}
                </option>
              ))}
            </select>
          </div>

          {/* aria-pressed, not a checkbox group: each chip is a button that
              turns its own column on or off, which is what it looks like. */}
          <nav className="audit-listtabs seg ga4-metrics" aria-label="Metric columns">
            {METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                className={`seg-btn${shown.includes(m.key) ? ' seg-on' : ''}`}
                aria-pressed={shown.includes(m.key)}
                title={`Show or hide ${m.label}`}
                onClick={() => toggleMetric(m.key)}
              >
                {m.short}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="audit-table-wrap card">
        <table className="audit-table audit-table--traffic text-sm">
          <thead className="audit-table__head">
            <tr className="audit-table__labels">
              <th className="audit-th audit-th--page">
                <span className="th-label">Page</span>
              </th>
              {columns.map((m) => (
                <th key={m.key} className="audit-th audit-th--metric" title={m.label}>
                  {m.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => (
              <tr
                key={`${p.pagePath}|${p.pageTitle}`}
                className="ga4-row"
                onClick={(e) => openPage(e, p.pagePath)}
              >
                <td className="audit-td audit-td--page">
                  {/* The whole row opens the drawer; the title stays a real
                      link so it is reachable by keyboard and opens in a new tab
                      on middle-click. The arrow beside it is the one thing on
                      the row that goes somewhere else — the live page — which
                      is why it is an icon: a second destination reads as an
                      exception, not another label. The URL is in its tooltip.

                      Siblings, not nested: an <a> inside a <Link> is invalid. */}
                  <div className="ga4-pagecell">
                    <Link
                      className="audit-row__title ga4-pagetitle ga4-pagelink font-semibold"
                      href={auditPath({
                        screen: 'traffic-page',
                        path: p.pagePath,
                        domain: site.domain,
                        days,
                        channel: channel === GA4_ALL_CHANNELS ? undefined : channel,
                      })}
                      title={`${p.pageTitle} — open traffic detail`}
                    >
                      {p.pageTitle}
                    </Link>
                    {p.pagePath && (
                      <a
                        className="audit-row__ext"
                        href={`https://${site.domain}${p.pagePath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`https://${site.domain}${p.pagePath}`}
                        aria-label={`Open ${p.pageTitle} in a new tab`}
                      >
                        <ArrowUpRightIcon size={13} aria-hidden />
                      </a>
                    )}
                  </div>
                </td>
                {columns.map((m) => (
                  <td key={m.key} className="audit-td audit-td--metric tnum">
                    {cell(p, m.key)}
                  </td>
                ))}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td className="audit-td" colSpan={columns.length + 1}>
                  <p className="muted small">
                    {emptyMessage(site, hasProperty, pages, error, search, channel)}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * Why the table is empty, specifically.
 *
 * Four different situations produce no rows and they need four different
 * answers — a site with no GA4 property at all is not the same problem as a
 * filter that matched nothing, and one message for all of them would send
 * someone looking in the wrong place.
 */
function emptyMessage(
  site: Site,
  hasProperty: boolean,
  pages: Ga4PageEngagement[] | null,
  error: string | null,
  search: string,
  channel: string,
): string {
  if (!hasProperty) return `No GA4 property is connected for ${site.short} (${site.domain}).`
  if (error) return `Could not load pages: ${error}`
  if (!pages) return 'Loading pages…'
  if (search.trim()) return `No page title or path matches “${search.trim()}”.`
  if (channel !== GA4_ALL_CHANNELS) return `No ${channel} traffic to any page this period.`
  return 'No page data for this period.'
}

function cell(p: Ga4PageEngagement, key: MetricKey): string {
  switch (key) {
    case 'activeUsers':
      return fmt(p.activeUsers)
    case 'newUsers':
      return fmt(p.newUsers)
    case 'sessions':
      return fmt(p.sessions)
    case 'engagedSessions':
      return fmt(p.engagedSessions)
    case 'engagementRate':
      return pct(p.engagementRate)
    case 'avgEngagementTime':
      return duration(p.avgEngagementTime)
    case 'views':
      return fmt(p.views)
    case 'viewsPerUser':
      return p.viewsPerUser === null ? '—' : p.viewsPerUser.toFixed(1)
  }
}

function Stat({
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
      <span className="stat-label">{label}</span>
      <span className="stat-value tnum">{value}</span>
      <span className="stat-sub">
        <Delta value={delta ?? null} lowerIsBetter={lowerIsBetter} />{' '}
        <span className="muted">{note ?? 'vs previous'}</span>
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
function Delta({ value, lowerIsBetter }: { value: number | null; lowerIsBetter?: boolean }) {
  if (value === null) return null
  const up = value >= 0
  const good = lowerIsBetter ? !up : up
  return (
    <span className={`ga4-delta ${good ? 'ga4-delta--up' : 'ga4-delta--down'}`}>
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(0)}%
    </span>
  )
}

/** Percentage change, for any pair — null when there is no baseline to move from. */
function deltaOf(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous <= 0) return null
  return ((current - previous) / previous) * 100
}

function fmt(n: number): string {
  return n.toLocaleString('en-AU')
}

function pct(v: number | null): string {
  return v === null ? '—' : `${(v * 100).toFixed(1)}%`
}

/** Seconds as m:ss — the form GA4 itself uses. */
function duration(seconds: number | null): string {
  if (seconds === null) return '—'
  const s = Math.round(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Say how old the numbers are, in words.
 *
 * A nightly cache's one failure mode is looking live, so the date the data runs
 * to is stated outright — a cron that has quietly stopped then reads as an old
 * date rather than as figures that mysteriously stopped moving.
 */
function freshnessLine(f: Props['freshness'], channel: string): string {
  // Filtered, nothing on screen comes from the snapshot — the cards are fetched
  // from GA alongside the channel list — so quoting the ingest date would be
  // describing numbers that are not being shown.
  if (channel !== GA4_ALL_CHANNELS) {
    return `${channel} only · live from GA4 · figures are not final for ~48h`
  }
  if (!f.maxDate) return 'No GA4 data ingested yet.'
  const through = new Date(`${f.maxDate}T00:00:00`).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  })
  const fetched = f.fetchedAt
    ? new Date(f.fetchedAt).toLocaleString('en-AU', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'unknown'
  return `Cards through ${through}, last fetched ${fetched} · pages are live · GA4 finalises figures after ~48h`
}

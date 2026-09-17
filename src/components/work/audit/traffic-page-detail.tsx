'use client'

/**
 * One page's traffic: totals, a daily trend, and three splits.
 *
 * Read-only, so no toolbar — the range and channel it was opened with travel in
 * the URL and are shown, not edited. Changing either means going back to the
 * list, which is where those controls live.
 */
import { ArrowLeftIcon, ExternalLinkIcon } from 'lucide-react'
import Link from 'next/link'

import { auditPath, contentPreCheckForPath } from '@/lib/audit-route'
import {
  GA4_ALL_CHANNELS,
  type Ga4PageAudit,
  type Ga4PageDetail,
  type Ga4RangeDays,
  type Ga4Split,
} from '@/lib/audit-types'
import type { Site } from '@/lib/audit-config'

type Props = {
  site: Site
  path: string
  days: Ga4RangeDays
  channel: string
  data: {
    detail: Ga4PageDetail
    daily: Ga4Split[]
    byChannel: Ga4Split[]
    byDevice: Ga4Split[]
    byCountry: Ga4Split[]
  } | null
  audit: Ga4PageAudit | null
  error: string | null
  hasProperty: boolean
  /**
   * 'page' is a hard load of the URL; 'drawer' is the intercepted version over
   * the table. The difference is only chrome — the drawer gets its Back from
   * the dialog around it, and must not repeat the page's own shell padding.
   */
  variant?: 'page' | 'drawer'
}

export function AuditTrafficPageDetail({
  site,
  path,
  days,
  channel,
  data,
  audit,
  error,
  hasProperty,
  variant = 'page',
}: Props) {
  const url = `https://${site.domain}${path}`
  const back = `${auditPath({ screen: 'traffic' })}?domain=${site.domain}&days=${days}${
    channel === GA4_ALL_CHANNELS ? '' : `&channel=${encodeURIComponent(channel)}`
  }`

  const isDrawer = variant === 'drawer'

  return (
    <div className={isDrawer ? 'audit-traffic' : 'shell audit-traffic'}>
      <div className="ga4-detail__top">
        {isDrawer ? (
          <span className="muted small">{site.short}</span>
        ) : (
          <Link className="back" href={back}>
            <ArrowLeftIcon size={14} aria-hidden /> Traffic
          </Link>
        )}
        <span className="muted small">
          last {days} days
          {channel !== GA4_ALL_CHANNELS && ` · ${channel} only`}
        </span>
      </div>

      <header className="ga4-detail__head">
        <h1 className="text-2xl font-bold">{path}</h1>
        <a
          className="muted small hover:underline ga4-detail__url"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {url} <ExternalLinkIcon size={12} aria-hidden />
        </a>
      </header>

      {/* The join this hub existed to make: how the page is built, beside how it
          performs. Absent when the page has never been scanned, which is itself
          worth seeing next to a page that gets real traffic. */}
      <div className="ga4-detail__audit card">
        {audit ? (
          <>
            <span className="stat-label">SEO audit</span>
            <span className="stat-value tnum">
              {audit.overall === null ? '—' : Math.round(audit.overall)}
            </span>
            <span className="stat-sub muted">{audit.status ?? 'No status'}</span>
            <Link
              className="btn btn-sm"
              href={auditPath({
                screen: 'page-detail',
                trackerId: audit.trackerId,
                from: { screen: 'dashboard', tab: 'completed' },
              })}
            >
              Open report
            </Link>
          </>
        ) : (
          <>
            <span className="muted small">
              This page has never been scanned by the Audit Hub — it has traffic but no SEO report.
            </span>
            {/* Hands the page straight to triage: the query marks and filters
                to the row, the fragment jumps to it. */}
            <Link className="btn btn-sm btn-primary" href={contentPreCheckForPath(site.domain, path)}>
              Check content
            </Link>
          </>
        )}
      </div>

      {!hasProperty && (
        <p className="muted">No GA4 property is connected for {site.short}.</p>
      )}
      {error && <p className="muted">Could not load page traffic: {error}</p>}
      {/* A property exists and the request worked, but GA has nothing for this
          path. Said plainly, because it is an answer — the page really had no
          traffic in the window — not a failure, and the two look identical if
          the screen simply renders empty. */}
      {hasProperty && !error && !data && (
        <p className="muted">
          No GA4 data for this page in the last {days} days. It may be new, unpublished, or
          never visited — or its URL may differ from the one GA4 records.
        </p>
      )}

      {data && (
        <>
          <section className="audit-summary audit-summary--six" data-cols={isDrawer ? '3' : '6'}>
            <Stat label="Views" value={fmt(data.detail.views)} delta={deltaOf(data.detail.views, data.detail.prevViews)} />
            <Stat
              label="Active Users"
              value={fmt(data.detail.activeUsers)}
              delta={deltaOf(data.detail.activeUsers, data.detail.prevActiveUsers)}
            />
            <Stat label="New Users" value={fmt(data.detail.newUsers)} />
            <Stat
              label="Sessions"
              value={fmt(data.detail.sessions)}
              delta={deltaOf(data.detail.sessions, data.detail.prevSessions)}
            />
            <Stat label="Engagement" value={pct(data.detail.engagementRate)} />
            <Stat
              label="Key Events"
              value={fmt(data.detail.keyEvents)}
              delta={deltaOf(data.detail.keyEvents, data.detail.prevKeyEvents)}
            />
          </section>

          <Trend rows={data.daily} />

          <div className={isDrawer ? 'ga4-splits ga4-splits--stacked' : 'ga4-splits'}>
            <Split title="By channel" rows={data.byChannel} note="always all traffic" />
            <Split title="By device" rows={data.byDevice} />
            <Split title="By country" rows={data.byCountry} />
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Views per day, as bars with their numbers above them.
 *
 * Bars rather than a line: the window can be 7 days or 365, and a polyline over
 * 365 points in a short box is noise.
 *
 * The numbers live in their own flex row above the bars, not inside each
 * column. Both rows use the same `flex: 1 1 0` children and the same gap, so
 * the columns line up — and the bars keep resolving their percentage heights
 * against the full track instead of against whatever a label left over.
 *
 * They are dropped past a month: 90 or 365 numbers in this width is a grey
 * smear, and an unreadable label is worse than none.
 */
const MAX_LABELLED_DAYS = 31

function Trend({ rows }: { rows: Ga4Split[] }) {
  if (rows.length === 0) return null
  const max = Math.max(...rows.map((r) => r.views), 1)
  const showValues = rows.length <= MAX_LABELLED_DAYS

  return (
    <section className="card ga4-trend">
      <p className="eyebrow">Views per day</p>

      {showValues && (
        <div className="ga4-trend__nums" aria-hidden>
          {rows.map((r) => (
            <span key={r.label} className="ga4-trend__num tnum">
              {r.views.toLocaleString('en-AU')}
            </span>
          ))}
        </div>
      )}

      <div
        className="ga4-trend__bars"
        role="img"
        aria-label={`Views per day across ${rows.length} days, peak ${fmt(max)}`}
      >
        {rows.map((r) => (
          <div
            key={r.label}
            className="ga4-trend__bar"
            style={{ height: `${Math.max((r.views / max) * 100, 1)}%` }}
            title={`${r.label}: ${fmt(r.views)} views, ${fmt(r.activeUsers)} users`}
          />
        ))}
      </div>

      <div className="ga4-trend__axis muted small">
        <span>{rows[0]?.label}</span>
        <span>peak {fmt(max)}</span>
        <span>{rows[rows.length - 1]?.label}</span>
      </div>
    </section>
  )
}

function Split({ title, rows, note }: { title: string; rows: Ga4Split[]; note?: string }) {
  const total = rows.reduce((a, r) => a + r.views, 0)
  return (
    <section className="card ga4-split">
      <p className="eyebrow">
        {title}
        {note && <span className="muted"> · {note}</span>}
      </p>
      {rows.length === 0 ? (
        <p className="muted small">No data.</p>
      ) : (
        <table className="ga4-split__table">
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td className="ga4-split__label" title={r.label}>
                  {r.label}
                </td>
                <td className="ga4-split__bar">
                  <span
                    className="bar-fill"
                    style={{ width: `${total > 0 ? (r.views / total) * 100 : 0}%` }}
                  />
                </td>
                <td className="tnum ga4-split__value">{fmt(r.views)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function Stat({ label, value, delta }: { label: string; value: string; delta?: number | null }) {
  return (
    <div className="card stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value tnum">{value}</span>
      <span className="stat-sub">
        {delta === undefined || delta === null ? (
          <span className="muted">&nbsp;</span>
        ) : (
          <>
            <span className={`ga4-delta ${delta >= 0 ? 'ga4-delta--up' : 'ga4-delta--down'}`}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}%
            </span>{' '}
            <span className="muted">vs previous</span>
          </>
        )}
      </span>
    </div>
  )
}

function fmt(n: number): string {
  return n.toLocaleString('en-AU')
}

function pct(v: number | null): string {
  return v === null ? '—' : `${(v * 100).toFixed(1)}%`
}

function deltaOf(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return ((current - previous) / previous) * 100
}

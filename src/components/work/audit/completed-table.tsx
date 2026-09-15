'use client'

/**
 * Completed — every page signed off as Done, with its current score, the
 * keyphrase WordPress has on it, and a Re-Run.
 *
 * The Dashboard's Completed tab shows the same pages inside the tab strip;
 * this screen is the standalone view, and it carries the keyword column and
 * the stat cards the tab does not.
 */
import { Loader2, RefreshCw, Star } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { refreshWordPress, trackAgentRun } from '@/app/audit/actions'
import { useAuditFavourites } from '@/hooks/use-audit-favourites'
import { SITES, type Site } from '@/lib/audit-config'
import type { CompletedTableRow } from '@/lib/audit-completed'
import type { AuditStats } from '@/lib/audit-data'
import { auditPath, DEFAULT_DASHBOARD_TAB } from '@/lib/audit-route'
import { TYPE_LABELS, type Assignee } from '@/lib/audit-types'

import { ScorePill } from './audit-chips'

type Sort = 'score-desc' | 'score-asc' | 'keyword-desc' | 'title-asc' | 'audited-desc'

const SORT_LABELS: Record<Sort, string> = {
  'score-desc': 'Score — Highest',
  'score-asc': 'Score — Lowest',
  'keyword-desc': 'Keyword — Highest',
  'title-asc': 'Title — A→Z',
  'audited-desc': 'Audited — Newest',
}

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'

export function CompletedTable({
  site,
  rows,
  stats,
  roster,
  loadError,
}: {
  site: Site
  rows: CompletedTableRow[]
  stats: AuditStats
  roster: Assignee[]
  loadError: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const { favourites, toggle: toggleFavourite } = useAuditFavourites(site.domain)

  const [search, setSearch] = useState('')
  const [onlyTop, setOnlyTop] = useState(false)
  const [assignedFilter, setAssignedFilter] = useState('all')
  const [sort, setSort] = useState<Sort>('score-desc')
  const [busyUrl, setBusyUrl] = useState<string | null>(null)

  const setDomain = (domain: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('domain', domain)
    router.push(`${auditPath({ screen: 'completed' })}?${params}`)
  }

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows
      .filter((row) => {
        if (onlyTop && !favourites.has(row.url)) return false
        if (
          needle &&
          !row.title.toLowerCase().includes(needle) &&
          !row.path.toLowerCase().includes(needle)
        ) {
          return false
        }
        if (assignedFilter === 'unassigned') return !row.assigned.length
        if (assignedFilter !== 'all') return row.assigned.includes(assignedFilter)
        return true
      })
      .sort((a, b) => {
        switch (sort) {
          case 'score-desc':
            return (b.overall ?? -1) - (a.overall ?? -1)
          case 'score-asc':
            return (a.overall ?? 101) - (b.overall ?? 101)
          case 'keyword-desc':
            return (b.keywordScore ?? -1) - (a.keywordScore ?? -1)
          case 'title-asc':
            return a.title.localeCompare(b.title)
          case 'audited-desc':
            return (b.ranAt ? Date.parse(b.ranAt) : 0) - (a.ranAt ? Date.parse(a.ranAt) : 0)
        }
      })
  }, [rows, search, onlyTop, favourites, assignedFilter, sort])

  function reRun(row: CompletedTableRow) {
    setBusyUrl(row.url)
    startTransition(async () => {
      const result = await trackAgentRun({ url: row.url, domain: site.domain, agentKind: 'full' })
      setBusyUrl(null)
      if (!result.ok) toast.error(result.error)
      else {
        toast.success('Queued for a fresh full scan.')
        router.refresh()
      }
    })
  }

  return (
    <div className="audit-completed shell">
      <header className="audit-completed__header mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">CTG Audit Hub</p>
          <h1 className="text-2xl font-bold">Completed</h1>
        </div>
        <div className="audit-toolbar flex flex-wrap items-center gap-2">
          <select
            className="input w-auto"
            value={site.domain}
            onChange={(e) => setDomain(e.target.value)}
            aria-label="Site"
          >
            {SITES.map((s) => (
              <option key={s.domain} value={s.domain}>
                {s.short}
              </option>
            ))}
          </select>
          <Link
            className="btn btn-sm"
            href={auditPath({ screen: 'dashboard', tab: DEFAULT_DASHBOARD_TAB })}
          >
            Dashboard
          </Link>
          <Link className="btn btn-sm" href={auditPath({ screen: 'domain-list' })}>
            Domain List
          </Link>
          <button
            type="button"
            className="btn btn-sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await refreshWordPress(site.domain)
                router.refresh()
              })
            }
          >
            <RefreshCw size={13} aria-hidden /> Refresh
          </button>
        </div>
      </header>

      {loadError && (
        <div className="audit-alert audit-alert--warn card mb-4 p-4">
          <p className="small">
            WordPress could not be read, so titles and keyword scores are missing. Scores below are
            still current. <span className="muted">{loadError}</span>
          </p>
        </div>
      )}

      <section className="audit-summary mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Box name="tracked" label="Tracked" value={stats.tracked} />
        <Box name="review" label="In review" value={stats.onReview} />
        <Box name="done" label="Done" value={stats.done} tone="good" />
        <Box name="above" label="Scoring 85+" value={stats.above90} tone="good" />
      </section>

      <div className="audit-table-wrap card">
        <table className="audit-table text-sm">
          {/* One header row — a filterable column *is* its control. */}
          <thead className="audit-table__head">
            <tr className="audit-table__labels">
              <th className="audit-th audit-th--star">
                <button
                  type="button"
                  className={`audit-row__star${onlyTop ? ' is-active' : ''}`}
                  title="Show only pages you have starred"
                  aria-pressed={onlyTop}
                  aria-label="Show only Top pages"
                  onClick={() => setOnlyTop((v) => !v)}
                >
                  <Star
                    size={14}
                    aria-hidden
                    fill={onlyTop ? 'var(--score-warn)' : 'none'}
                    color={onlyTop ? 'var(--score-warn)' : 'var(--ink-3)'}
                  />
                </button>
              </th>

              <th className="audit-th audit-th--page">
                <span className="th-label">Page</span>
                <span className="th-sort">
                  <input
                    type="search"
                    title="Filter by page title or path"
                    placeholder="Search…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Filter pages by title or path"
                  />
                </span>
                <span className="th-sort">
                  <select
                    title="Sort pages by score, keyword or title"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as Sort)}
                    aria-label="Sort"
                  >
                    {(Object.keys(SORT_LABELS) as Sort[]).map((srt) => (
                      <option key={srt} value={srt}>
                        {SORT_LABELS[srt]}
                      </option>
                    ))}
                  </select>
                </span>
              </th>

              <th className="audit-th audit-th--type">
                <span className="th-label">Type</span>
              </th>

              <th className="audit-th audit-th--keyphrase">
                <span className="th-sort">
                  <select
                    title="Filter by who the page is assigned to"
                    value={assignedFilter}
                    onChange={(e) => setAssignedFilter(e.target.value)}
                    aria-label="Filter by assignee"
                  >
                    <option value="all">Anyone</option>
                    <option value="unassigned">Unassigned</option>
                    {roster.map((person) => (
                      <option key={person.email} value={person.email}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                </span>
              </th>

              <th className="audit-th audit-th--keyword">
                <span
                  className="th-tip"
                  data-tip="Keyword AIOSEO Score — how well the page is optimised for its AIOSEO focus keyphrase (0–100). N/A means no keyphrase is set or it scored 0. Click to sort."
                >
                  KAS
                </span>
              </th>
              <th className="audit-th audit-th--score">
                <span className="th-label">Score</span>
              </th>
              <th className="audit-th audit-th--audited">
                <span className="th-label">Audited</span>
              </th>
              <th className="audit-th audit-th--actions">
                <span className="th-label">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="audit-table__body">
            {visible.map((row) => (
              <tr key={row.trackerId} className="audit-row" data-url={row.url}>
                <td className="audit-td audit-td--star">
                  <button
                    type="button"
                    className="audit-row__star"
                    onClick={() => toggleFavourite(row.url)}
                    aria-label={favourites.has(row.url) ? 'Remove from Top' : 'Add to Top'}
                  >
                    <Star
                      size={15}
                      aria-hidden
                      fill={favourites.has(row.url) ? 'var(--score-warn)' : 'none'}
                      color={favourites.has(row.url) ? 'var(--score-warn)' : 'var(--ink-3)'}
                    />
                  </button>
                </td>
                <td className="audit-td audit-td--page">
                  <div className="audit-row__title font-semibold">{row.title}</div>
                  <a
                    className="audit-row__path muted small hover:underline"
                    href={row.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {row.path}
                  </a>
                </td>
                <td className="audit-td audit-td--type muted small">
                  {row.type ? TYPE_LABELS[row.type] : '—'}
                </td>
                <td className="audit-td audit-td--keyphrase small">
                  {row.keyphrase ?? <span className="muted">—</span>}
                </td>
                <td className="audit-td audit-td--keyword">
                  <ScorePill score={row.keywordScore} />
                </td>
                <td className="audit-td audit-td--score">
                  <ScorePill score={row.overall} />
                </td>
                <td className="audit-td audit-td--audited small tnum">
                  {fmtDate(row.ranAt)}
                  {row.lastUpdatedAt && (
                    <div className="muted text-[11px]">
                      re-scanned {row.lastRescanDim ? `${row.lastRescanDim} ` : ''}
                      {fmtDate(row.lastUpdatedAt)}
                    </div>
                  )}
                </td>
                <td className="audit-td audit-td--actions">
                  <div className="audit-row__actions flex flex-wrap gap-1.5">
                    <Link
                      className="audit-action audit-action--report btn btn-sm"
                      href={auditPath({
                        screen: 'page-detail',
                        trackerId: row.trackerId,
                        from: { screen: 'completed' },
                      })}
                    >
                      Report
                    </Link>
                    <button
                      type="button"
                      className="audit-action audit-action--rerun btn btn-sm"
                      disabled={pending && busyUrl === row.url}
                      onClick={() => reRun(row)}
                    >
                      {pending && busyUrl === row.url && (
                        <Loader2 className="animate-spin" size={13} aria-hidden />
                      )}
                      Re-Run
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!visible.length && (
              <tr className="audit-row audit-row--empty">
                <td className="audit-td audit-td--empty muted py-8 text-center" colSpan={8}>
                  No completed pages match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Box({
  name,
  label,
  value,
  tone,
}: {
  name: string
  label: string
  value: number
  tone?: 'good'
}) {
  return (
    <div className={`audit-summary__box audit-summary__box--${name} card p-4`}>
      <p className="audit-summary__label eyebrow">{label}</p>
      <p
        className="audit-summary__value tnum text-2xl font-bold"
        style={tone ? { color: `var(--score-${tone})` } : undefined}
      >
        {value}
      </p>
    </div>
  )
}

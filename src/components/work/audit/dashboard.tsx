'use client'

/**
 * The Dashboard: one page list, four tabs.
 *
 *   Content Pre-Check   every page on the domain, against the content_audits
 *                       triage queue. The only tab that can queue a content audit.
 *   Full SEO Page Scan  pages that have a tracker row, i.e. ones Content promoted.
 *   Archived            content_audits rows with archived = true.
 *   Completed           Full Scan rows whose tracker status is Done.
 *
 * Rows arrive already joined from the server (lib/audit-dashboard.ts); this
 * component owns only what the user manipulates — filters, sort, and the tick
 * boxes. The tab and the domain live in the URL so a view is linkable; the
 * filters stay local, because routing a server round-trip per keystroke would
 * make the search box unusable.
 *
 * Column filters live in a second header row, each in the `<th>` of the column
 * it narrows, so the control and the data it affects share a column.
 *
 * Two invariants carried over from the portal, both easy to break:
 *   - the summary boxes count *visible* rows, so every active filter applies;
 *   - bulk actions only ever touch rows that are both ticked AND visible, so
 *     narrowing the list can never queue something you cannot see.
 */
import { Loader2, Star } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

import {
  cancelScheduledScan,
  queueSiteContentAudit,
  refreshWordPress,
  setContentAuditArchived,
  stageFullScanRow,
  trackAgentRun,
  updateTrackerStatus,
  revertToContent,
  type ActionResult,
} from '@/app/audit/actions'
import { useAuditFavourites } from '@/hooks/use-audit-favourites'
import { useContentAuditPoll } from '@/hooks/use-content-audit-poll'
import { SITES, type Site } from '@/lib/audit-config'
import type { DashboardRow } from '@/lib/audit-dashboard'
import {
  auditPath,
  DASHBOARD_TABS,
  DASHBOARD_TAB_LABELS,
  type DashboardTab,
} from '@/lib/audit-route'
import {
  AGENT_KIND_LABELS,
  RUNNABLE_AGENT_KINDS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TYPE_LABELS,
  teamOf,
  type AgentKind,
  type Assignee,
  type ContentType,
  type TaskStatus,
} from '@/lib/audit-types'

import { AssignMenu } from './assign-menu'
import { ContentSummaryDialog } from './content-summary-dialog'
import { DecisionHelp } from './decision-help'
import {
  AUDIT_STATUSES,
  AUDIT_STATUS_LABELS,
  AuditStatusChip,
  DECISION_LABELS,
  DecisionChip,
  ExpiryChip,
  ScanTypeChip,
  ScorePill,
  TaskStatusChip,
  type AuditStatus,
} from './audit-chips'

type Sort =
  | 'published-desc'
  | 'published-asc'
  | 'wp-updated-desc'
  | 'wp-updated-asc'
  | 'title-asc'
  | 'title-desc'

const SORT_LABELS: Record<Sort, string> = {
  'published-desc': 'Published — Newest',
  'published-asc': 'Published — Oldest',
  'wp-updated-desc': 'WP Updated — Newest',
  'wp-updated-asc': 'WP Updated — Oldest',
  'title-asc': 'Title — A→Z',
  'title-desc': 'Title — Z→A',
}

const TAB_TIPS: Record<DashboardTab, string> = {
  'content-pre-check': 'Content audit queue — the E-E-A-T triage in content_audits',
  'full-seo-page-scan': 'Full scan queue — the agent runs in seo_agent_tracker',
  archived: 'Archived content_audits rows',
  completed: 'Full scan rows marked Done',
}

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—'

export function AuditDashboard({
  tab,
  site,
  rows,
  roster,
  loadError,
}: {
  tab: DashboardTab
  site: Site
  rows: DashboardRow[]
  roster: Assignee[]
  loadError: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const { favourites, toggle: toggleFavourite } = useAuditFavourites(site.domain)

  const [onlyTop, setOnlyTop] = useState(false)
  const [typeFilter, setTypeFilter] = useState<ContentType | 'all'>('all')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [auditFilter, setAuditFilter] = useState<AuditStatus | 'all'>('all')
  const [decisionFilter, setDecisionFilter] = useState('all')
  const [assignedFilter, setAssignedFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [sort, setSort] = useState<Sort>('published-desc')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkAgent, setBulkAgent] = useState<AgentKind>('full')
  // The Completed tab offers a scan type per row, so a re-run can differ from
  // the bulk picker without changing it.
  const [rowAgent, setRowAgent] = useState<Record<string, AgentKind>>({})
  const [busyUrls, setBusyUrls] = useState<Set<string>>(new Set())
  /** The row whose summary_report is on screen — null when the dialog is shut. */
  const [summaryRow, setSummaryRow] = useState<{ id: string; url: string } | null>(null)

  const { watch, watching } = useContentAuditPoll(() => router.refresh())

  // A tab or domain change invalidates a selection made against a different list.
  useEffect(() => {
    setSelected(new Set())
  }, [tab, site.domain])

  const setDomain = (domain: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('domain', domain)
    router.push(`${auditPath({ screen: 'dashboard', tab })}?${params}`)
  }

  /**
   * Which columns this tab shows. Scores only mean something once a page has
   * actually been scanned, so KAS and Score are Completed-only — on the three
   * queue tabs they were a column of dashes.
   */
  const showContentColumns = tab === 'content-pre-check' || tab === 'archived'
  const showScanType = tab === 'full-seo-page-scan'
  const showAssigned = tab === 'full-seo-page-scan' || tab === 'completed'
  const showScores = tab === 'completed'
  // Every Completed row is Done by definition, so the progress column carries no
  // information there — drop the column outright, header, filter and cells.
  const showProgress = tab !== 'completed'

  // The list seg is one control over two filters: 'top' is the star filter,
  // anything else is the type filter, and 'all' clears both. Deriving it keeps
  // the row predicate below unchanged.
  const LIST_TABS: { key: string; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'top', label: '★ Top' },
    ...site.types.map((t) => ({ key: t, label: TYPE_LABELS[t] })),
  ]
  const listTab = onlyTop ? 'top' : typeFilter
  const setListTab = (key: string) => {
    setOnlyTop(key === 'top')
    setTypeFilter(key === 'top' || key === 'all' ? 'all' : (key as ContentType))
  }

  // select, star, page, type, updated, actions — plus the optional ones.
  const columnCount =
    6 +
    (showProgress ? 1 : 0) +
    (showContentColumns ? 2 : 0) +
    (showScanType ? 1 : 0) +
    (showAssigned ? 1 : 0) +
    // KAS, Score and Run Type all arrive with Completed.
    (showScores ? 3 : 0)

  /** Rows belonging to this tab, before the user's filters. */
  const tabRows = useMemo(() => {
    switch (tab) {
      case 'content-pre-check':
        return rows.filter((r) => !r.archived)
      case 'full-seo-page-scan':
        // The run queue, so a page leaves it the moment it is closed out —
        // Done rows live on the Completed tab. Keeping them here showed the
        // same finished page in two places and made the queue look longer
        // than the work left in it.
        return rows.filter((r) => r.trackerId && !r.archived && r.status !== 'done')
      case 'archived':
        return rows.filter((r) => r.archived)
      case 'completed':
        return rows.filter((r) => r.status === 'done')
    }
  }, [rows, tab])

  const years = useMemo(() => {
    const set = new Set<string>()
    for (const r of tabRows) if (r.modifiedAt) set.add(r.modifiedAt.slice(0, 4))
    return [...set].sort().reverse()
  }, [tabRows])

  const decisions = useMemo(() => {
    // Dedupe on the rendered label: two decision keys share one chip.
    const seen = new Map<string, string>()
    for (const r of tabRows) {
      if (!r.decision) continue
      const label = DECISION_LABELS[r.decision] ?? r.decision
      if (!seen.has(label)) seen.set(label, r.decision)
    }
    return [...seen.entries()]
  }, [tabRows])

  /** Everything the current filters leave on screen. Actions and boxes both read this. */
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const filtered = tabRows.filter((r) => {
      if (onlyTop && !favourites.has(r.url)) return false
      if (typeFilter !== 'all' && r.type !== typeFilter) return false
      if (
        needle &&
        !r.title.toLowerCase().includes(needle) &&
        !r.path.toLowerCase().includes(needle)
      ) {
        return false
      }
      if (showProgress && statusFilter !== 'all' && (r.status ?? 'not-started') !== statusFilter)
        return false
      if (auditFilter !== 'all' && r.contentStatus !== auditFilter) return false
      if (decisionFilter !== 'all' && r.decision !== decisionFilter) return false
      if (yearFilter !== 'all' && r.modifiedAt?.slice(0, 4) !== yearFilter) return false

      if (assignedFilter === 'unassigned') {
        if (r.assigned.length) return false
      } else if (assignedFilter !== 'all' && !r.assigned.includes(assignedFilter)) {
        return false
      }
      return true
    })

    const byDate = (a: string | null, b: string | null, dir: number) =>
      dir * ((b ? Date.parse(b) : 0) - (a ? Date.parse(a) : 0))

    return filtered.sort((a, b) => {
      switch (sort) {
        case 'published-desc':
          return byDate(a.publishedAt, b.publishedAt, 1)
        case 'published-asc':
          return byDate(a.publishedAt, b.publishedAt, -1)
        case 'wp-updated-desc':
          return byDate(a.modifiedAt, b.modifiedAt, 1)
        case 'wp-updated-asc':
          return byDate(a.modifiedAt, b.modifiedAt, -1)
        case 'title-asc':
          return a.title.localeCompare(b.title)
        case 'title-desc':
          return b.title.localeCompare(a.title)
      }
    })
  }, [
    tabRows,
    onlyTop,
    favourites,
    typeFilter,
    search,
    showProgress,
    statusFilter,
    auditFilter,
    decisionFilter,
    yearFilter,
    assignedFilter,
    sort,
  ])

  /**
   * Only rows that are ticked *and* still visible. Anything else would let a
   * filter hide a page that a bulk action then operates on anyway.
   */
  const actionable = useMemo(() => visible.filter((r) => selected.has(r.url)), [visible, selected])

  /** Portal parity: one box per decision bucket, in this order, with the same
   *  caption and colour. `keys` groups the two rewrite decisions into one box,
   *  exactly as the chip and the decision filter already group them. */
  const DECISION_BOXES: { label: string; keys: string[]; sub: string; color: string }[] = [
    {
      label: 'Publish As Is',
      keys: ['publish_as_is'],
      sub: 'No changes needed',
      color: 'var(--score-good)',
    },
    { label: 'Revision', keys: ['needs_revision'], sub: 'Minor edits', color: 'var(--sev-low)' },
    {
      label: 'Rewrite - Expired',
      keys: ['needs_major_rewrite', 'expired_needs_refresh'],
      sub: 'Needs a rewrite',
      color: 'var(--score-warn)',
    },
    {
      label: 'Unpublish / Noindex',
      keys: ['unpublish_or_noindex'],
      sub: 'Remove or noindex',
      color: 'var(--sev-critical)',
    },
  ]

  /** Whether any user-set filter is narrowing the list — captions the boxes.
   *  Reads the filters themselves, not the row count, so a tab's own built-in
   *  exclusions (archived rows, untracked pages) don't read as a filter. */
  const filtersActive =
    listTab !== 'all' ||
    search.trim() !== '' ||
    statusFilter !== 'all' ||
    auditFilter !== 'all' ||
    decisionFilter !== 'all' ||
    yearFilter !== 'all' ||
    assignedFilter !== 'all'

  const scopeSub = filtersActive ? 'In the current filter' : 'Across this tab'

  const summary = useMemo(() => {
    let open = 0
    let done = 0
    let scored = 0
    let scoreTotal = 0
    let aboveCount = 0
    for (const row of visible) {
      if (row.counts) {
        // Whose findings count depends on who the page is assigned to: a page
        // split across both teams, or unassigned, counts everything.
        const team = teamOf(row.assigned, roster)
        if (team === 'marketing') {
          open += row.counts.openMarketing
          done += row.counts.doneMarketing
        } else if (team === 'it') {
          open += row.counts.open - row.counts.openMarketing
          done += row.counts.done - row.counts.doneMarketing
        } else {
          open += row.counts.open
          done += row.counts.done
        }
      }
      if (typeof row.done?.overall === 'number') {
        scored++
        scoreTotal += row.done.overall
        if (row.done.overall > 85) aboveCount++
      }
    }
    // Content/Archived boxes: how many rows finished their content audit, and
    // how the finished ones split across the decision buckets.
    const scanned = visible.filter((r) => r.contentStatus === 'done').length
    const byDecision = new Map<string, number>()
    for (const r of visible) {
      if (r.decision) byDecision.set(r.decision, (byDecision.get(r.decision) ?? 0) + 1)
    }

    // Full Scan boxes: a page is pending while anything is open, completed once
    // everything of its own is done. A page with no findings at all is neither.
    let pendingPages = 0
    let completedPages = 0
    let openTotal = 0
    for (const r of visible) {
      if (!r.counts) continue
      // The portal's `total` is every finding on the page, open or closed.
      const total = r.counts.open + r.counts.done
      if (r.counts.open > 0) pendingPages += 1
      else if (total > 0) completedPages += 1
      openTotal += total
    }

    return {
      pages: visible.length,
      open,
      done,
      average: scored ? Math.round(scoreTotal / scored) : null,
      scanned,
      byDecision,
      pendingPages,
      completedPages,
      openTotal,
      scored,
      above85: aboveCount,
    }
  }, [visible, roster])

  const run = useCallback(
    (url: string | null, fn: () => Promise<ActionResult>) => {
      if (url) setBusyUrls((s) => new Set(s).add(url))
      startTransition(async () => {
        const result = await fn()
        if (url) {
          setBusyUrls((s) => {
            const next = new Set(s)
            next.delete(url)
            return next
          })
        }
        if (!result.ok) toast.error(result.error)
        else router.refresh()
      })
    },
    [router],
  )

  function toggleRow(url: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(url)) next.delete(url)
      else next.add(url)
      return next
    })
  }

  const allVisibleTicked = visible.length > 0 && visible.every((r) => selected.has(r.url))
  const toggleAll = () =>
    setSelected(allVisibleTicked ? new Set() : new Set(visible.map((r) => r.url)))

  /** Run one action across every ticked-and-visible row, reporting once. */
  function bulk(label: string, fn: (row: DashboardRow) => Promise<ActionResult>) {
    if (!actionable.length) return
    const targets = [...actionable]
    startTransition(async () => {
      const results = await Promise.all(targets.map(fn))
      const failed = results.filter((r) => !r.ok).length
      if (failed) toast.error(`${label}: ${failed} of ${results.length} pages failed.`)
      else toast.success(`${label}: ${results.length} page${results.length === 1 ? '' : 's'}.`)
      setSelected(new Set())
      router.refresh()
    })
  }

  function queueContentAudit() {
    // Nothing ticked still means "sweep the whole domain", as it always has.
    const targets = actionable.length ? actionable : visible
    const urls = targets.map((r) => r.url)
    if (!urls.length) return
    startTransition(async () => {
      const result = await queueSiteContentAudit(urls, site.domain)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`Queued ${urls.length} page${urls.length === 1 ? '' : 's'} for content audit.`)
      setSelected(new Set())
      watch(urls)
      router.refresh()
    })
  }

  return (
    <div className="audit-dashboard shell">
      {/* No page head: the mode switch in the toolbar is the heading. */}
      {/* Boxes above the table, per tab — Content/Archived get the scanned count
          plus the decision split, Full Scan its findings queue, Completed its
          scores. All read `visible`, so every active filter is already applied. */}
      {showContentColumns ? (
        <section className="audit-summary" data-cols="5">
          <SummaryBox
            name="scanned"
            label="Scanned"
            value={summary.scanned}
            of={summary.pages}
            sub={scopeSub}
            color={
              summary.scanned === summary.pages && summary.pages > 0
                ? 'var(--score-good)'
                : 'var(--sev-high)'
            }
          />
          {DECISION_BOXES.map((box) => {
            const n = box.keys.reduce((sum, k) => sum + (summary.byDecision.get(k) ?? 0), 0)
            return (
              <SummaryBox
                key={box.label}
                name="decision"
                label={box.label}
                value={n}
                of={summary.pages}
                sub={box.sub}
                color={n ? box.color : 'var(--ink-3)'}
              />
            )
          })}
        </section>
      ) : tab === 'completed' ? (
        <section className="audit-summary" data-cols="3">
          <SummaryBox
            name="pages"
            label="Pages"
            value={summary.pages}
            sub={scopeSub}
            color={summary.pages ? 'var(--score-good)' : 'var(--ink-3)'}
          />
          <SummaryBox
            name="average"
            label="Avg Score"
            value={summary.average ?? '—'}
            sub={
              summary.scored
                ? `Over ${summary.scored} scored ${summary.scored === 1 ? 'page' : 'pages'}`
                : 'No scored runs yet'
            }
          />
          <SummaryBox
            name="above"
            label="Above 85"
            value={summary.above85}
            of={summary.scored}
            sub="Full audit, score > 85"
            color={summary.above85 ? 'var(--score-good)' : 'var(--ink-3)'}
          />
        </section>
      ) : (
        <section className="audit-summary" data-cols="3">
          <SummaryBox
            name="pending"
            label="Pages Pending"
            value={summary.pendingPages}
            of={summary.pages}
            sub={scopeSub}
            color={summary.pendingPages ? 'var(--sev-high)' : 'var(--score-good)'}
          />
          <SummaryBox
            name="open"
            label="Pending Task"
            value={summary.open}
            of={summary.openTotal}
            sub="Findings still open"
            color={summary.open ? 'var(--sev-high)' : 'var(--score-good)'}
          />
          <SummaryBox
            name="done"
            label="Completed"
            value={summary.completedPages}
            of={summary.pages}
            sub="Every finding marked done"
            color={summary.completedPages ? 'var(--score-good)' : 'var(--ink-3)'}
          />
        </section>
      )}

      {/* One toolbar, two rows, following the portal's list-toolbar structure:
          the tab row says which queue you are looking at and what you are
          looking for inside it; the controls row holds everything that acts on
          it — the site it is scoped to, then the bulk actions. */}
      <div className="audit-toolbar mb-4">
        <div className="audit-toolbar__tabs">
          <nav className="audit-tabs seg seg-mode">
            {DASHBOARD_TABS.map((t) => (
              <Link
                key={t}
                href={`${auditPath({ screen: 'dashboard', tab: t })}?domain=${site.domain}`}
                className={`audit-tab seg-btn${t === tab ? ' seg-on' : ''}`}
                title={TAB_TIPS[t]}
                aria-current={t === tab ? 'page' : undefined}
              >
                {DASHBOARD_TAB_LABELS[t]}
              </Link>
            ))}
          </nav>

          <span className="audit-toolbar__count small muted tnum">
            {visible.length} of {rows.length}
            {watching > 0 && (
              <>
                {' · '}
                <Loader2 className="inline animate-spin" size={12} aria-hidden /> watching{' '}
                {watching} audit{watching === 1 ? '' : 's'}
              </>
            )}
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
        </div>

        <div className="audit-toolbar__controls">
          <div className="audit-toolbar__scope">
            <select
              className="audit-toolbar__site input w-auto"
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
          </div>

          {/* All / ★ Top / one per content type — the portal's second seg. It
              owns both the star filter and the type filter, so exactly one of
              them can be on at a time. */}
          <nav className="audit-listtabs seg">
            {LIST_TABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`seg-btn${listTab === key ? ' seg-on' : ''}`}
                aria-pressed={listTab === key}
                onClick={() => setListTab(key)}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Progress on the content queues, Status on Full Scan, nothing on
              Completed — every row there is Done. */}
          {showContentColumns ? (
            <select
              className="audit-toolbar__filter input w-auto"
              title="Filter by the content audit's progress"
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value as AuditStatus | 'all')}
              aria-label="Filter by progress"
            >
              <option value="all">All Progress</option>
              {AUDIT_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {AUDIT_STATUS_LABELS[st]}
                </option>
              ))}
            </select>
          ) : (
            showProgress && (
              <select
                className="audit-toolbar__filter input w-auto"
                title="Filter by the full scan's status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')}
                aria-label="Filter by status"
              >
                <option value="all">All Statuses</option>
                {/* Done is not offered: this tab holds the queue, and a page
                    leaves it once it is done, so the option could only ever
                    empty the table. */}
                {TASK_STATUSES.filter((st) => st !== 'done').map((st) => (
                  <option key={st} value={st}>
                    {TASK_STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
            )
          )}

          {showContentColumns && (
            <select
              className="audit-toolbar__filter input w-auto"
              title="Filter by the content audit's editorial decision"
              value={decisionFilter}
              onChange={(e) => setDecisionFilter(e.target.value)}
              aria-label="Filter by decision"
            >
              <option value="all">All Decisions</option>
              {decisions.map(([label, key]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          )}

          {showAssigned && (
            <select
              className="audit-toolbar__filter input w-auto"
              title="Filter by who the page is assigned to"
              value={assignedFilter}
              onChange={(e) => setAssignedFilter(e.target.value)}
              aria-label="Filter by assignee"
            >
              <option value="all">All Assignees</option>
              <option value="unassigned">Unassigned</option>
              {roster.map((person) => (
                <option key={person.email} value={person.email}>
                  {person.name}
                </option>
              ))}
            </select>
          )}

          <div className="audit-bulkbar__actions">
            {showContentColumns && (
              <>
                <button
                  type="button"
                  className="audit-bulkbar__btn audit-bulkbar__btn--content btn btn-primary btn-sm"
                  disabled={pending}
                  onClick={queueContentAudit}
                >
                  {pending && <Loader2 className="animate-spin" size={13} aria-hidden />}
                  Run Content Audit{actionable.length ? ` (${actionable.length})` : ''}
                </button>

                {/* Same selection model as Run Content Audit — ticked and visible
                  only — so the three buttons can't disagree about their target. */}
                <button
                  type="button"
                  className="audit-bulkbar__btn audit-bulkbar__btn--fullscan btn btn-sm"
                  disabled={pending || !actionable.length}
                  onClick={() =>
                    bulk('Staged for full scan', (row) => stageFullScanRow(row.url, site.domain))
                  }
                >
                  Full Scan{actionable.length ? ` (${actionable.length})` : ''}
                </button>

                {tab === 'content-pre-check' ? (
                  <button
                    type="button"
                    className="audit-bulkbar__btn audit-bulkbar__btn--archive btn btn-sm"
                    disabled={pending || !actionable.length}
                    onClick={() =>
                      bulk('Archived', (row) => setContentAuditArchived(row.url, site.domain, true))
                    }
                  >
                    Archive{actionable.length ? ` (${actionable.length})` : ''}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="audit-bulkbar__btn audit-bulkbar__btn--unarchive btn btn-sm"
                    disabled={pending || !actionable.length}
                    onClick={() =>
                      bulk('Unarchived', (row) =>
                        setContentAuditArchived(row.url, site.domain, false),
                      )
                    }
                  >
                    Unarchive{actionable.length ? ` (${actionable.length})` : ''}
                  </button>
                )}
              </>
            )}

            {(showScanType || tab === 'completed') && (
              <>
                <select
                  className="audit-bulkbar__agent input w-auto"
                  value={bulkAgent}
                  onChange={(e) => setBulkAgent(e.target.value as AgentKind)}
                  aria-label="Scan type"
                >
                  {RUNNABLE_AGENT_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {AGENT_KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="audit-bulkbar__btn audit-bulkbar__btn--run btn btn-primary btn-sm"
                  disabled={pending || !actionable.length}
                  onClick={() =>
                    bulk('Queued', (row) =>
                      trackAgentRun({ url: row.url, domain: site.domain, agentKind: bulkAgent }),
                    )
                  }
                >
                  {pending && <Loader2 className="animate-spin" size={13} aria-hidden />}
                  Run{actionable.length ? ` (${actionable.length})` : ''}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {loadError && (
        <div className="audit-alert audit-alert--error card mb-4 p-4">
          <p className="audit-alert__title font-semibold">WordPress could not be read</p>
          <p className="audit-alert__detail muted small mt-1">{loadError}</p>
          <button
            type="button"
            className="audit-alert__retry btn btn-sm mt-3"
            onClick={() => run(null, () => refreshWordPress(site.domain))}
          >
            Retry
          </button>
        </div>
      )}

      <div className="audit-table-wrap card">
        <table className={`audit-table audit-table--${tab} text-sm`}>
          {/* Labels only, plus the two controls the portal keeps in the head:
              the Page sort and the WP Updated year. Every other filter lives in
              the toolbar, where you can see them all at once. */}
          <thead className="audit-table__head">
            <tr className="audit-table__labels">
              <Th name="select">
                <input
                  type="checkbox"
                  className="audit-select-all"
                  checked={allVisibleTicked}
                  onChange={toggleAll}
                  aria-label="Select all visible rows"
                />
              </Th>

              <Th name="star">
                <Star size={14} aria-hidden color="var(--ink-3)" />
              </Th>

              <Th name="page">
                <span className="th-label">Page</span>
                <span className="th-sort">
                  <select
                    title="Sort pages by publish date or title"
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
              </Th>

              <Th name="type">
                <span className="th-label">Type</span>
              </Th>

              <Th name="updated">
                <span className="th-sort">
                  <select
                    title="Filter by the year the page was last updated in WordPress"
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    aria-label="Filter by WP updated year"
                  >
                    <option value="all">All Years</option>
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </span>
              </Th>

              {showProgress && (
                <Th name="progress">
                  <span className="th-label">Progress</span>
                </Th>
              )}

              {showContentColumns && (
                <Th name="status">
                  <span className="th-label">Status</span>
                </Th>
              )}

              {showContentColumns && (
                <Th name="decision">
                  <span className="th-label">Decision</span>
                  <DecisionHelp />
                </Th>
              )}

              {showScanType && (
                <Th name="scantype">
                  <span className="th-label">Scan Type</span>
                </Th>
              )}

              {showAssigned && (
                <Th name="assigned">
                  <span className="th-label">Assigned</span>
                </Th>
              )}

              {showScores && (
                <Th name="kas">
                  <span
                    className="th-tip"
                    data-tip="Keyword AIOSEO Score — how well the page is optimised for its AIOSEO focus keyphrase (0–100). N/A means no keyphrase is set or it scored 0."
                  >
                    KAS
                  </span>
                </Th>
              )}

              {showScores && (
                <Th name="score">
                  <span className="th-label">Score</span>
                </Th>
              )}

              {showScores && (
                <Th name="runtype">
                  <span className="th-label">Run Type</span>
                </Th>
              )}

              <Th name="actions">
                <span className="th-label">Actions</span>
              </Th>
            </tr>
          </thead>

          <tbody className="audit-table__body">
            {visible.map((row) => {
              const busy = busyUrls.has(row.url)
              const isSelected = selected.has(row.url)
              return (
                <tr
                  key={row.id}
                  className={`audit-row${isSelected ? ' audit-row--selected' : ''}${busy ? ' audit-row--busy' : ''}`}
                  data-url={row.url}
                >
                  <Td name="select">
                    <input
                      type="checkbox"
                      className="audit-row__select"
                      checked={isSelected}
                      onChange={() => toggleRow(row.url)}
                      aria-label={`Select ${row.title}`}
                    />
                  </Td>
                  <Td name="star">
                    <button
                      type="button"
                      className="audit-row__star"
                      onClick={() => toggleFavourite(row.url)}
                      aria-label={favourites.has(row.url) ? 'Remove from Top' : 'Add to Top'}
                      aria-pressed={favourites.has(row.url)}
                    >
                      <Star
                        size={15}
                        aria-hidden
                        fill={favourites.has(row.url) ? 'var(--score-warn)' : 'none'}
                        color={favourites.has(row.url) ? 'var(--score-warn)' : 'var(--ink-3)'}
                      />
                    </button>
                  </Td>
                  <Td name="page">
                    <div className="audit-row__title font-semibold">{row.title}</div>
                    <a
                      className="audit-row__path muted small hover:underline"
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {row.path}
                    </a>
                  </Td>
                  <Td name="type" className="muted small">
                    {TYPE_LABELS[row.type]}
                  </Td>
                  <Td name="updated" className="small tnum">
                    {fmtDate(row.modifiedAt)}
                  </Td>
                  {showProgress && (
                    <Td name="progress">
                      {showContentColumns ? (
                        <AuditStatusChip status={row.contentStatus} />
                      ) : (
                        <TaskStatusChip
                          status={row.status ?? 'not-started'}
                          label={TASK_STATUS_LABELS[row.status ?? 'not-started']}
                        />
                      )}
                    </Td>
                  )}
                  {showContentColumns && (
                    <Td name="status">
                      <ExpiryChip hasSummary={row.hasContentSummary} isExpired={row.isExpired} />
                    </Td>
                  )}
                  {showContentColumns && (
                    <Td name="decision">
                      <DecisionChip
                        decision={row.decision}
                        hasSummary={row.hasContentSummary}
                        onOpen={
                          row.contentAuditId
                            ? () =>
                                setSummaryRow({ id: row.contentAuditId!, url: row.url })
                            : undefined
                        }
                      />
                    </Td>
                  )}
                  {showScanType && (
                    <Td name="scantype">
                      <ScanTypeChip fullScan={!!row.fullScan} semrush={!!row.semrush} />
                    </Td>
                  )}
                  {showAssigned && (
                    <Td name="assigned">
                      {row.trackerId ? (
                        <AssignMenu
                          trackerId={row.trackerId}
                          assigned={row.assigned}
                          roster={roster}
                          disabled={pending}
                        />
                      ) : (
                        <span className="muted small">—</span>
                      )}
                    </Td>
                  )}
                  {showScores && (
                    <Td name="kas">
                      <ScorePill score={row.keywordScore} />
                    </Td>
                  )}

                  {showScores && (
                    <Td name="score">
                      <ScorePill score={row.done?.overall ?? null} />
                    </Td>
                  )}

                  {showScores && (
                    <Td name="runtype">
                      {row.done?.runType ? (
                        <span className="badge type-badge">{row.done.runType}</span>
                      ) : (
                        <span className="tnum muted">—</span>
                      )}
                    </Td>
                  )}
                  <Td name="actions">
                    <div className="audit-row__actions row-actions">
                      {busy && <Loader2 className="animate-spin" size={14} aria-hidden />}

                      {/*
                        Two different reports, and each belongs to exactly one
                        queue:

                          Report  the content triage in content_audits, on the
                                  Content and Archived tabs — and the full
                                  scan in audit_runs, on the Full Scan tab
                                  (rendered below, status-gated); View on
                                  Completed

                        Both carry the same label because no row ever offers
                        both: the content one is gated on showContentColumns
                        (Content/Archived) and the full-scan one on the Full
                        Scan tab. They are different documents about the same
                        page, and the tab says which one you are on.
                      */}
                      {showContentColumns && row.hasContentReport && row.contentAuditId && (
                        <Link
                          className="audit-action audit-action--report btn btn-sm"
                          title="Open the content audit report"
                          href={auditPath({
                            screen: 'content-audit',
                            contentAuditId: row.contentAuditId,
                            from: { screen: 'dashboard', tab },
                          })}
                        >
                          Report
                        </Link>
                      )}

                      {tab === 'content-pre-check' && (
                        <>
                          <button
                            type="button"
                            className="audit-action audit-action--fullscan btn btn-sm"
                            disabled={busy || pending}
                            onClick={() =>
                              run(row.url, () => stageFullScanRow(row.url, site.domain))
                            }
                          >
                            Full Scan
                          </button>
                          <button
                            type="button"
                            className="audit-action audit-action--archive btn btn-sm"
                            disabled={busy || pending}
                            onClick={() =>
                              run(row.url, () =>
                                setContentAuditArchived(row.url, site.domain, true),
                              )
                            }
                          >
                            Archive
                          </button>
                        </>
                      )}

                      {tab === 'archived' && (
                        <button
                          type="button"
                          className="audit-action audit-action--unarchive btn btn-sm"
                          disabled={busy || pending}
                          onClick={() =>
                            run(row.url, () => setContentAuditArchived(row.url, site.domain, false))
                          }
                        >
                          Unarchive
                        </button>
                      )}

                      {/*
                        Full Scan's actions depend entirely on where the page is
                        in the run, matching the portal:

                          not-started  Full Scan · + SemRush · Revert
                          scheduled    Cancel
                          in-progress  nothing — the worker has it
                          in-review    Report · Done
                          error        Full Scan · + SemRush

                        In-progress deliberately offers nothing: the worker is
                        mid-fetch, and every control here would either fight it
                        or lie about what it did.

                        There is no `done` line because Done is the exit: the
                        tab filters those rows out, and they show up on
                        Completed.
                      */}
                      {tab === 'full-seo-page-scan' && (
                        <>
                          {(row.status === 'not-started' || row.status === 'error') && (
                            <>
                              <button
                                type="button"
                                className="audit-action audit-action--fullscan btn btn-sm"
                                disabled={busy || pending}
                                onClick={() =>
                                  run(row.url, () =>
                                    trackAgentRun({
                                      url: row.url,
                                      domain: site.domain,
                                      agentKind: 'full',
                                    }),
                                  )
                                }
                              >
                                Full Scan
                              </button>
                              <button
                                type="button"
                                className="audit-action audit-action--semrush btn btn-sm"
                                title="Queue this page's Full Scan with the SemRush agent included (agent_semrush = Yes)"
                                disabled={busy || pending}
                                onClick={() =>
                                  run(row.url, () =>
                                    trackAgentRun({
                                      url: row.url,
                                      domain: site.domain,
                                      agentKind: 'full-agent',
                                    }),
                                  )
                                }
                              >
                                + SemRush
                              </button>
                            </>
                          )}

                          {/* Only at Not Started: once a scan is scheduled,
                              running, done or errored there is a run to
                              account for. */}
                          {row.status === 'not-started' && (
                            <button
                              type="button"
                              className="audit-action audit-action--revert btn btn-sm"
                              title="Move this page back to Content — removes it from Full Scan"
                              disabled={busy || pending}
                              onClick={() =>
                                run(row.url, () => revertToContent(row.url, site.domain))
                              }
                            >
                              Revert
                            </button>
                          )}

                          {row.status === 'scheduled' && (
                            <button
                              type="button"
                              className="audit-action audit-action--cancel btn btn-sm"
                              title="Cancel this scheduled scan — stays in Full Scan as Not Started"
                              disabled={busy || pending}
                              onClick={() =>
                                run(row.url, () => cancelScheduledScan(row.url, site.domain))
                              }
                            >
                              Cancel
                            </button>
                          )}

                          {row.status === 'in-review' && row.trackerId && (
                              <Link
                                className="audit-action audit-action--full-report btn btn-sm"
                                title="Open the full scan report"
                                href={auditPath({
                                  screen: 'page-detail',
                                  trackerId: row.trackerId,
                                  from: { screen: 'dashboard', tab },
                                })}
                              >
                                Report
                              </Link>
                            )}

                          {row.status === 'in-review' && (
                            <button
                              type="button"
                              className="audit-action audit-action--done btn btn-sm btn-primary"
                              disabled={busy || pending}
                              onClick={() =>
                                run(row.url, () =>
                                  updateTrackerStatus(row.url, site.domain, 'done'),
                                )
                              }
                            >
                              Done
                            </button>
                          )}
                        </>
                      )}

                      {tab === 'completed' && (
                        <>
                          {row.trackerId && (
                            <Link
                              className="audit-action audit-action--view btn btn-sm"
                              title="View the audit report"
                              href={auditPath({
                                screen: 'page-detail',
                                trackerId: row.trackerId,
                                from: { screen: 'dashboard', tab },
                              })}
                            >
                              View
                            </Link>
                          )}
                          <select
                            className="audit-action audit-action--agent input"
                            value={rowAgent[row.url] ?? 'full'}
                            onChange={(e) =>
                              setRowAgent((m) => ({
                                ...m,
                                [row.url]: e.target.value as AgentKind,
                              }))
                            }
                            aria-label={`Scan type for ${row.title}`}
                          >
                            {RUNNABLE_AGENT_KINDS.map((kind) => (
                              <option key={kind} value={kind}>
                                {AGENT_KIND_LABELS[kind]}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="audit-action audit-action--rerun btn btn-sm btn-primary"
                            title="Re-run the selected scan now"
                            disabled={busy || pending}
                            onClick={() =>
                              run(row.url, () =>
                                trackAgentRun({
                                  url: row.url,
                                  domain: site.domain,
                                  agentKind: rowAgent[row.url] ?? 'full',
                                }),
                              )
                            }
                          >
                            Re-Run
                          </button>
                        </>
                      )}
                    </div>
                  </Td>
                </tr>
              )
            })}

            {!visible.length && (
              <tr className="audit-row audit-row--empty">
                <Td name="empty" className="muted p-8 text-center" colSpan={columnCount}>
                  {loadError
                    ? 'Nothing to show — WordPress could not be read.'
                    : 'No pages match these filters.'}
                </Td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ContentSummaryDialog
        contentAuditId={summaryRow?.id ?? null}
        url={summaryRow?.url ?? null}
        onClose={() => setSummaryRow(null)}
      />
    </div>
  )
}

/** One stat card. Both text lines are clipped to a single line so every box is
 *  the same height on every tab; the `title` carries the full text at the narrow
 *  widths where one gets ellipsed. */
function SummaryBox({
  name,
  label,
  value,
  of,
  sub,
  color,
}: {
  name: string
  label: string
  value: number | string
  of?: number
  sub: string
  color?: string
}) {
  return (
    <div className={`audit-summary__box audit-summary__box--${name} card stat`}>
      <div className="stat-label" title={label}>
        {label}
      </div>
      <div className="stat-value tnum" style={color ? { color } : undefined}>
        {value}
        {of != null && <span className="stat-of">/{of}</span>}
      </div>
      <div className="stat-sub" title={sub}>
        {sub}
      </div>
    </div>
  )
}

function Th({ name, children }: { name: string; children?: React.ReactNode }) {
  // Column widths live in audit.css, keyed off the same name — the markup
  // says which column this is, the stylesheet says how wide it gets.
  return <th className={`audit-th audit-th--${name}`}>{children}</th>
}

function Td({
  name,
  children,
  className,
  colSpan,
}: {
  name: string
  children?: React.ReactNode
  className?: string
  colSpan?: number
}) {
  return (
    <td className={`audit-td audit-td--${name} ${className ?? ''}`} colSpan={colSpan}>
      {children}
    </td>
  )
}

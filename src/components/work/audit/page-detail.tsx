'use client'

/**
 * Page Detail — one audit run, rendered as a score hero, dimension bars, and a
 * severity-grouped finding list with a per-card Done control.
 *
 * Fed by either report source: `audit_runs.report` for a full scan, or
 * `content_audits.report` translated into the same shape by
 * recordFromContentAuditReport. The screen does not know which it got, which is
 * why the two adapters exist.
 */
import { Check, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { updateIssueDone, updateTrackerStatusById } from '@/app/audit/actions'
import type { AuditRecord, DimensionScore } from '@/lib/audit-report'
import { originLabel, originPath, type DetailOrigin } from '@/lib/audit-route'
import type { IssueRow, RunHistoryEntry } from '@/lib/audit-data'
import {
  MARKETING_DIMS,
  SCORE_COLOR,
  TASK_STATUS_LABELS,
  fmtAuditDate,
  band,
  teamOf,
  type Assignee,
  type TaskStatus,
} from '@/lib/audit-types'

import { AssignMenu } from './assign-menu'
import { SeverityChip, TaskStatusChip, severityToken, type Severity } from './audit-chips'

const SEV_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info']

const DIM_LABELS: Record<string, string> = {
  content_quality: 'Content Quality',
  technical_seo: 'Technical SEO',
  on_page_seo: 'On-Page SEO',
  performance_cwv: 'Performance (CWV)',
  ai_search_readiness: 'AI Search Readiness (GEO)',
  schema_structured_data: 'Schema / Structured Data',
  competitive_intelligence: 'Competitive Intelligence',
  ai_citation_readiness: 'AI Citation Readiness',
  content_issues: 'Content Issues',
  content_recommendations: 'Recommendations',
}

function dimLabel(key: string): string {
  return DIM_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** GEO is the dimension this hub exists to move, so its bar gets its own panel. */
function isGeoDim(key: string): boolean {
  return key.includes('ai_search') || key.includes('geo')
}

/** The word under the gauge. Same three bands the ring colour uses. */
function bandLabel(score: number | null): string {
  if (score == null) return 'Not scored'
  return score >= 80 ? 'Good' : score >= 50 ? 'Needs work' : 'Poor'
}

/** What a run actually re-scanned, for the score-history list. */
function scannedLabel(run: RunHistoryEntry): string {
  if (run.runType === 'full') return 'Full scan'
  return run.agentsRun.length ? `Re-ran ${run.agentsRun.map(dimLabel).join(', ')}` : 'Re-run'
}

/**
 * Who a finding lands on. Marketing is what can be fixed inside the WordPress
 * UI; IT is the exact complement — everything needing backend or template work.
 */
type AudienceView = 'all' | 'marketing' | 'it'

/** Whether a dimension belongs to the selected audience view. */
function inViewFor(view: AudienceView, dimension: string | null): boolean {
  if (view === 'all') return true
  const marketing = MARKETING_DIMS.has(dimension ?? '')
  return view === 'marketing' ? marketing : !marketing
}

export function PageDetail({
  record,
  issues,
  history,
  trackerId,
  status,
  assigned,
  markable,
  roster,
  from,
}: {
  record: AuditRecord
  issues: IssueRow[]
  history: RunHistoryEntry[]
  trackerId: string | null
  status: TaskStatus | null
  assigned: string[]
  /** False for a content audit — its findings have no row to write back to. */
  markable: boolean
  roster: Assignee[]
  from: DetailOrigin
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  /**
   * The team the page is handed to, from its assignees. `teamOf` returns a
   * team only when every assignee is on it — a page split across both, or
   * unassigned, comes back null. Same rule the Dashboard's counts use, so the
   * number in the box matches the cards here.
   */
  const assignedTeam = useMemo(() => teamOf(assigned, roster), [assigned, roster])

  /**
   * Which findings the report opens on. A page assigned to Marketing opens on
   * the marketing findings and one assigned to IT on the rest, because that is
   * the only half the person opening it can act on; both teams, or nobody,
   * opens on All. A manual pick from the dropdown wins from then on — the
   * effect below only re-runs when the assignment itself changes.
   */
  const [view, setView] = useState<AudienceView>(() => assignedTeam ?? 'all')
  const [sevOff, setSevOff] = useState<Set<Severity>>(new Set())
  const [dimFilter, setDimFilter] = useState('all')
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [localDone, setLocalDone] = useState<Record<string, string | null>>({})

  useEffect(() => {
    const next = assignedTeam ?? 'all'
    setView(next)
    // The dimension filter is scoped to a view; reassigning the page can leave
    // it pointing at a dimension the new view does not cover, which empties
    // the list with a filter still showing.
    setDimFilter((d) => (d === 'all' || inViewFor(next, d) ? d : 'all'))
  }, [assignedTeam])

  const dimensions = useMemo(
    () => Object.entries(record.dimensions ?? {}) as [string, DimensionScore][],
    [record.dimensions],
  )

  const inView = (dimension: string | null) => inViewFor(view, dimension)

  const visibleIssues = useMemo(
    () =>
      issues.filter((issue) => {
        if (!inView(issue.dimension)) return false
        if (sevOff.has(severityToken(issue.priority))) return false
        if (dimFilter !== 'all' && issue.dimension !== dimFilter) return false
        return true
      }),
    [issues, view, sevOff, dimFilter],
  )

  const grouped = useMemo(() => {
    const buckets = new Map<Severity, IssueRow[]>()
    for (const sev of SEV_ORDER) buckets.set(sev, [])
    for (const issue of visibleIssues) buckets.get(severityToken(issue.priority))!.push(issue)
    return [...buckets.entries()].filter(([, list]) => list.length)
  }, [visibleIssues])

  const doneAt = (issue: IssueRow) => (issue.id in localDone ? localDone[issue.id]! : issue.doneAt)

  function toggleDone(issue: IssueRow) {
    const next = doneAt(issue) ? null : new Date().toISOString()
    setSaving((s) => new Set(s).add(issue.id))
    // Optimistic: closing out a list of findings one by one should feel
    // immediate, and a rejected write rolls this entry back on its own.
    setLocalDone((d) => ({ ...d, [issue.id]: next }))
    startTransition(async () => {
      const result = await updateIssueDone(issue.id, next !== null)
      setSaving((s) => {
        const copy = new Set(s)
        copy.delete(issue.id)
        return copy
      })
      if (!result.ok) {
        setLocalDone((d) => {
          const copy = { ...d }
          delete copy[issue.id]
          return copy
        })
        toast.error(result.error)
      }
    })
  }

  function markPageDone() {
    if (!trackerId) return
    startTransition(async () => {
      const result = await updateTrackerStatusById(trackerId, 'done')
      if (!result.ok) toast.error(result.error)
      else {
        toast.success('Page marked as done.')
        router.push(originPath(from))
      }
    })
  }

  function exportCsv() {
    const rows = [
      ['Priority', 'Dimension', 'Title', 'Recommendation', 'Done at'],
      ...visibleIssues.map((i) => [
        i.priority ?? '',
        i.dimension ?? '',
        i.title ?? '',
        i.recommendation ?? '',
        doneAt(i) ?? '',
      ]),
    ]
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-${record.domain}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const cwv = record.pageReport?.core_web_vitals
  const scoreBand = band(record.overall)
  const scoreColor = SCORE_COLOR[scoreBand]
  const urgent = visibleIssues.filter(
    (i) => severityToken(i.priority) === 'critical' || severityToken(i.priority) === 'high',
  ).length
  const sevCounts = useMemo(() => {
    const counts = {} as Record<Severity, number>
    for (const issue of issues) {
      const sev = severityToken(issue.priority)
      counts[sev] = (counts[sev] ?? 0) + 1
    }
    return counts
  }, [issues])

  /** Dimensions the current view covers — the dropdown never offers a filter
   *  that would empty the list the view has already narrowed. */
  const filterDims = useMemo(
    () => [...new Set(issues.map((i) => i.dimension ?? 'other'))].filter(inView),
    [issues, view],
  )

  return (
    <div className="audit-detail shell">
      <Link className="back" href={originPath(from)}>
        ← Back to {originLabel(from)}
      </Link>

      <section className="hero card">
        <div className="hero-gauge">
          <ScoreGauge score={record.overall} color={scoreColor} />
          <div className="hero-band" style={{ color: scoreColor }}>
            {bandLabel(record.overall)}
          </div>
        </div>
        <div className="hero-body min-w-0 flex-1">
          <span className="badge type-badge">{record.type}</span>
          {status && (
            <span className="ml-2 inline-block align-middle">
              <TaskStatusChip status={status} label={TASK_STATUS_LABELS[status]} />
            </span>
          )}
          <h1 className="hero-title mt-2.5 font-bold">{record.title}</h1>
          <a className="hero-url" href={record.url} target="_blank" rel="noopener noreferrer">
            {record.url} ↗
          </a>
          <div className="hero-meta">
            <span>Audited {fmtAuditDate(record.auditedAt)}</span>
            {record.truseo != null && (
              <span className="hero-truseo">
                AIOSEO TruSEO <b className="tnum">{record.truseo}</b>
              </span>
            )}
            {cwv?.lcp_ms != null && (
              <span>
                LCP <b className="tnum">{(cwv.lcp_ms / 1000).toFixed(1)}s</b> · INP{' '}
                <b className="tnum">{cwv.inp_ms ?? '—'}ms</b> · CLS{' '}
                <b className="tnum">{cwv.cls ?? '—'}</b>
              </span>
            )}
          </div>
          {trackerId && (
            <div className="hero-assigned">
              <span>Assigned to</span>
              <AssignMenu
                trackerId={trackerId}
                assigned={assigned}
                roster={roster}
                disabled={pending}
              />
            </div>
          )}
          <div className="hero-actions">
            {trackerId && status === 'in-review' && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={pending}
                onClick={markPageDone}
              >
                {pending ? <Loader2 className="animate-spin" size={14} aria-hidden /> : '✓'} Mark as
                Done
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="detail-grid">
        <div className="col-left">
          <section className="card panel">
            <div className="panel-head">
              <h2 className="panel-title">Dimension breakdown</h2>
            </div>
            <div className="bars">
              {dimensions.length === 0 && (
                <p className="muted small">No dimension scores in this report.</p>
              )}
              {dimensions.map(([key, dim]) => {
                const geo = isGeoDim(key)
                const head = (
                  <span className="bar-dim">
                    {dimLabel(key)}
                    {geo && <span className="geo-tag">Focus area</span>}
                  </span>
                )
                // The routine writes the key with a null value when it could
                // not score the dimension — say so rather than hiding the gap.
                if (!dim) {
                  return (
                    <div key={key} className={`bar-row ${geo ? 'bar-geo' : ''}`}>
                      <div className="bar-head">
                        {head}
                        <span className="bar-meta">
                          <span className="muted small">Not scored</span>
                        </span>
                      </div>
                      <div className="bar-track" />
                    </div>
                  )
                }
                const b = band(dim.score)
                return (
                  <div key={key} className={`bar-row ${geo ? 'bar-geo' : ''}`}>
                    <div className="bar-head">
                      {head}
                      <span className="bar-meta">
                        <span className="bar-weight">
                          {Math.round((dim.weight ?? 0) * 100)}% weight
                        </span>
                        <span className="bar-score tnum" style={{ color: SCORE_COLOR[b] }}>
                          {dim.score}
                        </span>
                      </span>
                    </div>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ width: `${dim.score}%`, background: SCORE_COLOR[b] }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="card panel">
            <div className="panel-head">
              <h2 className="panel-title">Score history</h2>
              <span className="muted small">
                {history.length || 1} run{(history.length || 1) > 1 ? 's' : ''}
              </span>
            </div>
            <div className="history-row">
              <div>
                <div className="hs-now tnum" style={{ color: scoreColor }}>
                  {(history[0]?.overall ?? record.overall) ?? '—'}
                </div>
                <div className="muted small">latest run</div>
              </div>
              {history.length ? (
                <div className="hs-list">
                  {history.map((run) => (
                    <div key={run.runId} className="hs-run">
                      <span className="hs-run-meta">
                        <span className="hs-run-when">{run.ranAt ? fmtAuditDate(run.ranAt) : '—'}</span>
                        <span className="muted small">{scannedLabel(run)}</span>
                      </span>
                      {run.delta != null && run.delta !== 0 && (
                        <span
                          className="hs-delta tnum"
                          style={{
                            color: run.delta > 0 ? 'var(--score-good)' : 'var(--score-bad)',
                          }}
                        >
                          {run.delta > 0 ? `+${run.delta}` : run.delta}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="muted small" style={{ maxWidth: 200 }}>
                  Re-audit this page to start tracking score history.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="col-right">
          <section className="card panel">
            <div className="issues-head">
              <div>
                <h2 className="panel-title">Issues &amp; recommendations</h2>
                <p className="muted small mt-[3px]">
                  {visibleIssues.length} {visibleIssues.length === 1 ? 'finding' : 'findings'} ·{' '}
                  <b style={{ color: 'var(--sev-critical)' }}>{urgent}</b> need attention
                </p>
              </div>
              <button type="button" className="btn btn-sm" onClick={exportCsv}>
                ↓ Export CSV
              </button>
            </div>

            <div className="filters">
              <div className="filter-left">
                <div className="filter-sevs">
                  {SEV_ORDER.filter((sev) => (sevCounts[sev] ?? 0) > 0).map((sev) => {
                    const on = !sevOff.has(sev)
                    return (
                      <button
                        key={sev}
                        type="button"
                        className="sev-toggle"
                        aria-pressed={on}
                        style={
                          on
                            ? {
                                color: `var(--sev-${sev})`,
                                background: `var(--sev-${sev}-soft)`,
                                borderColor: 'transparent',
                              }
                            : undefined
                        }
                        onClick={() =>
                          setSevOff((s) => {
                            const next = new Set(s)
                            if (next.has(sev)) next.delete(sev)
                            else next.add(sev)
                            return next
                          })
                        }
                      >
                        {sev[0]!.toUpperCase() + sev.slice(1)}{' '}
                        <span className="tnum">{sevCounts[sev]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="filter-right">
                <select
                  className="input dim-select"
                  value={dimFilter}
                  onChange={(e) => setDimFilter(e.target.value)}
                  aria-label="Dimension"
                >
                  <option value="all">All dimensions</option>
                  {filterDims.map((key) => (
                    <option key={key} value={key}>
                      {dimLabel(key)}
                    </option>
                  ))}
                </select>
                <select
                  className="input dim-select"
                  value={view}
                  title="Show only the findings one team can act on"
                  onChange={(e) => {
                    const next = e.target.value as AudienceView
                    setView(next)
                    // Drop a dimension the new view does not cover, or the
                    // list silently empties with a filter still showing.
                    setDimFilter((d) => (d === 'all' || inViewFor(next, d) ? d : 'all'))
                  }}
                  aria-label="View"
                >
                  <option value="all">All views</option>
                  <option value="marketing">Marketing view</option>
                  <option value="it">IT view</option>
                </select>
              </div>
            </div>

            <div className="issue-list">
              {!grouped.length && <p className="muted small">No issues match the current filters.</p>}
              {grouped.map(([sev, list]) => (
                <div key={sev} className="sev-group">
                  <div className="sev-group-head">
                    <span className="sev-dot" style={{ background: `var(--sev-${sev})` }} />
                    <span className="sev-name">{sev}</span>
                    <span className="sev-count tnum">{list.length}</span>
                  </div>
                  {list.map((issue) => {
                    const done = doneAt(issue)
                    return (
                      <article
                        key={issue.id}
                        className={`issue ${done ? 'issue-done' : ''}`}
                        style={{ borderLeftColor: `var(--sev-${severityToken(issue.priority)})` }}
                      >
                        <header className="issue-top">
                          <SeverityChip priority={issue.priority} />
                          <span className="issue-dim">{dimLabel(issue.dimension ?? '')}</span>
                        </header>
                        <h3 className="issue-title">{issue.title}</h3>
                        {issue.recommendation && (
                          <div className="rec">
                            <div className="rec-label">Recommendation</div>
                            <p className="rec-text">{issue.recommendation}</p>
                          </div>
                        )}
                        {markable && (
                          <div className="issue-actions">
                            {done && (
                              <span className="issue-done-stamp">✓ Done {fmtAuditDate(done)}</span>
                            )}
                            <button
                              type="button"
                              className={`btn btn-sm ${done ? '' : 'btn-primary'}`}
                              disabled={saving.has(issue.id)}
                              onClick={() => toggleDone(issue)}
                            >
                              {saving.has(issue.id) ? (
                                <Loader2 className="animate-spin" size={13} aria-hidden />
                              ) : (
                                <Check size={13} aria-hidden />
                              )}
                              {done ? 'Undo' : 'Mark as Done'}
                            </button>
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

/**
 * The score ring. An SVG rather than a conic-gradient so the rounded cap on
 * the arc survives, which is what stops a low score reading as a hairline.
 */
function ScoreGauge({ score, color }: { score: number | null; color: string }) {
  const circumference = 2 * Math.PI * 68.5
  const arc = score == null ? 0 : (score / 100) * circumference
  return (
    <svg width="148" height="148" viewBox="0 0 148 148" role="img" aria-label={`Score ${score ?? 'not available'} out of 100`}>
      <circle cx="74" cy="74" r="68.5" fill="none" stroke="var(--border)" strokeWidth="11" />
      <circle
        cx="74"
        cy="74"
        r="68.5"
        fill="none"
        stroke={color}
        strokeWidth="11"
        strokeLinecap="round"
        strokeDasharray={`${arc.toFixed(1)} ${circumference.toFixed(1)}`}
        transform="rotate(-90 74 74)"
      />
      <text x="74" y="80" textAnchor="middle" fontSize="40" fontWeight="700" fill={color}>
        {score ?? '—'}
      </text>
      <text x="74" y="100" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--ink-3)">
        /100
      </text>
    </svg>
  )
}

/**
 * Report shapes, and the pure adapters from stored jsonb to a Page Detail
 * record.
 *
 * Scans are not launched by this app: the `seo-page-agents` routine and the
 * site-content-audit worker write `audit_runs.report` and
 * `content_audits.report` straight into Supabase, and everything the UI shows
 * is read back from there. These adapters are the only thing that understands
 * those blobs, and they are pure — no fetching, no DOM — so both the server
 * components and the client detail view can call them.
 */

import { numOrNull } from './audit-types'

export interface PageIssue {
  id?: string
  /** critical | high | medium | low | info */
  priority?: string
  dimension?: string
  reported_by?: string[]
  title?: string
  detail?: string
  location?: string
  recommendation?: string
}

/**
 * One dimension's score. Null when the routine wrote the dimension key but
 * couldn't score it (e.g. a Full Scan + SemRush run where Semrush returned
 * nothing) — callers must handle the null, not assume a score.
 */
export type DimensionScore = { score: number; weight: number } | null

export interface PageReport {
  meta?: {
    url?: string
    page_type?: string
    audited_at?: string
    notes?: string
    specialists_run?: string[]
  }
  scores?: {
    overall?: number
    truseo_estimated?: number
    dimensions?: Record<string, DimensionScore>
  }
  issue_counts?: Record<string, number>
  issues?: PageIssue[]
  core_web_vitals?: {
    lcp_ms?: number
    inp_ms?: number
    cls?: number
    source?: string
    note?: string
  }
}

export interface AuditRecord {
  url: string
  domain: string
  title: string
  type: string
  overall: number | null
  truseo: number | null
  critical: number | null
  high: number | null
  medium?: number | null
  low?: number | null
  summary: string | null
  dimensions?: Record<string, DimensionScore> | null
  pageReport?: PageReport | null
  report: string
  auditedAt: string
}

/** Raw JSON emitted by the seo-site-content-audit skill, stored verbatim as
 *  `content_audits.report` — one blob, same pattern as `audit_runs.report`. */
export interface ContentAuditReport {
  url?: string
  page_type?: string
  /** e.g. "38/100" */
  content_quality_score?: string
  eeat_breakdown?: { factor?: string; weight?: string; score?: string; notes?: string }[]
  ai_citation_readiness?: { score?: string; notes?: string }
  issues_found?: { severity?: string; issue?: string }[]
  recommendations?: { priority?: string; recommendation?: string }[]
}

/** Raw JSON stored verbatim as `content_audits.summary_report` — the same
 *  worker's condensed, decision-oriented pass over one page. */
export interface SummaryReport {
  url?: string
  expiry?: {
    signals?: string[]
    confidence?: string
    is_expired?: boolean
  }
  summary?: string
  decision?: string
  decision_reason?: string
  action_summary?: { action?: string; priority?: string }[]
  /** e.g. "49/100" */
  content_quality_score?: string
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

function countBySeverity(issues: PageIssue[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const i of issues) {
    const p = i.priority ?? 'info'
    counts[p] = (counts[p] ?? 0) + 1
  }
  return counts
}

function scoreFraction(v: unknown): number | null {
  if (typeof v !== 'string') return null
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

function weightFraction(v: unknown): number {
  if (typeof v !== 'string') return 0
  const n = parseFloat(v)
  return Number.isFinite(n) ? n / 100 : 0
}

/**
 * Fold the triage report's two parallel lists into single issue cards, so a
 * content audit reads like every other Page Detail finding — the problem on the
 * card, its fix in the card's Recommendation block — instead of "Content
 * Issues" and "Recommendations" as two disconnected stacks.
 *
 * The skill emits `issues_found` and `recommendations` severity-ordered and
 * topically aligned, but not always the same length (one recommendation
 * sometimes answers two low-severity issues). Pairing is therefore done
 * positionally *within* a severity bucket, which keeps a critical fix off a
 * low-severity issue. Anything left over survives on its own card rather than
 * being dropped: an unmatched issue simply has no recommendation, an unmatched
 * recommendation stays under the Recommendations label.
 */
function pairIssuesWithRecommendations(report: ContentAuditReport): PageIssue[] {
  const recsBySeverity = new Map<string, string[]>()
  for (const r of report.recommendations ?? []) {
    const sev = r.priority ?? 'info'
    const bucket = recsBySeverity.get(sev) ?? []
    bucket.push(r.recommendation ?? '(recommendation)')
    recsBySeverity.set(sev, bucket)
  }

  const issues: PageIssue[] = (report.issues_found ?? []).map((i) => {
    const sev = i.severity ?? 'info'
    return {
      priority: sev,
      dimension: 'content_issues',
      title: i.issue ?? '(untitled issue)',
      recommendation: recsBySeverity.get(sev)?.shift(),
    }
  })

  // Recommendations with no issue at their severity — keep them visible on their own.
  for (const [sev, leftover] of recsBySeverity) {
    for (const rec of leftover) {
      issues.push({ priority: sev, dimension: 'content_recommendations', title: rec })
    }
  }
  return issues
}

/**
 * Build a Page Detail record from a stored `audit_runs.report` (jsonb). The
 * report JSON already matches PageReport, so the detail screen renders it
 * directly.
 */
export function recordFromReport(
  report: PageReport,
  hints: { url?: string; title?: string; type?: string } = {},
): AuditRecord {
  const url = report.meta?.url ?? hints.url ?? ''
  const counts = report.issue_counts ?? countBySeverity(report.issues ?? [])
  return {
    url,
    domain: hostOf(url),
    title: hints.title || url,
    type: hints.type || report.meta?.page_type || 'page',
    overall: numOrNull(report.scores?.overall),
    truseo: numOrNull(report.scores?.truseo_estimated),
    critical: counts.critical ?? null,
    high: counts.high ?? null,
    medium: counts.medium ?? null,
    low: counts.low ?? null,
    summary: null,
    dimensions: report.scores?.dimensions ?? null,
    pageReport: report,
    report: JSON.stringify(report, null, 2),
    auditedAt: report.meta?.audited_at ?? new Date().toISOString(),
  }
}

/**
 * Build a Page Detail record from a stored `content_audits.report` (the
 * lightweight E-E-A-T triage skill's JSON) by translating it into the same
 * PageReport shape `recordFromReport` already knows how to render — the detail
 * screen (hero gauge, dimension bars, issue cards) is fully reused, just fed a
 * different report source.
 */
export function recordFromContentAuditReport(
  report: ContentAuditReport,
  hints: { url?: string; finishedAt?: string | null } = {},
): AuditRecord {
  const url = report.url ?? hints.url ?? ''
  const dimensions: Record<string, DimensionScore> = {}
  for (const f of report.eeat_breakdown ?? []) {
    const score = scoreFraction(f.score)
    if (!f.factor || score == null) continue
    dimensions[f.factor.toLowerCase().replace(/\s+/g, '_')] = {
      score,
      weight: weightFraction(f.weight),
    }
  }
  const aiScore = scoreFraction(report.ai_citation_readiness?.score)
  if (aiScore != null) dimensions.ai_citation_readiness = { score: aiScore, weight: 0 }

  return recordFromReport(
    {
      meta: { url, page_type: report.page_type, audited_at: hints.finishedAt ?? undefined },
      scores: {
        overall: scoreFraction(report.content_quality_score) ?? undefined,
        dimensions,
      },
      issues: pairIssuesWithRecommendations(report),
    },
    { url, type: report.page_type },
  )
}

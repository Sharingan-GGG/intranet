/**
 * Shared vocabulary for the Audit Hub: content types, score bands, agent kinds,
 * task statuses, and the Marketing/IT dimension split.
 *
 * Deliberately free of `next/*` and server-only imports so the same definitions
 * serve the server components that query Supabase and the client components that
 * render the result.
 */

/**
 * Column-level vocabulary of the `audit` schema.
 *
 * The eight `agent_*` flags and "Full Scan" are enum columns holding the literal
 * strings 'Yes' / 'No', not booleans, and status is stored as its display
 * string. Both are preserved verbatim because the external workers read and
 * write these columns; the data layer converts at the boundary and nothing
 * above it should see a YesNo.
 */
export type YesNo = 'Yes' | 'No'

export type ScheduleType = 'Bi-Weekly' | 'Monthly' | 'Quarterly'

export type StatusType =
  'Not Yet Started' | 'Scheduled' | 'In Progress' | 'Done' | 'In Review' | 'Error'

export type ContentAuditStatus = 'queued' | 'running' | 'done' | 'error'

export type ContentType = 'post' | 'page' | 'deal'

export const TYPE_LABELS: Record<ContentType, string> = {
  post: 'Posts',
  page: 'Pages',
  deal: 'Deals',
}

/** Subset of AIOSEO meta exposed on the public WordPress REST API. */
export interface AioseoMetaData {
  title: string | null
  description: string | null
  keyphrases: {
    focus: {
      keyphrase: string
      score: number
    } | null
    additional?: unknown[]
  } | null
}

/** Raw WordPress REST item — the fields we request via `_fields`. */
export interface WpItem {
  id: number
  link: string
  /** Publish date in the site's timezone (ISO 8601), null if unset. */
  date: string | null
  /** Last-updated timestamp in UTC (ISO 8601), null if unset. */
  modified_gmt: string | null
  title: { rendered: string }
  aioseo_meta_data?: AioseoMetaData | null
}

/** Normalized view model for one Completed table row. */
export interface CompletedRow {
  id: number
  title: string
  url: string
  path: string
  type: ContentType
  keywordScore: number | null
  keyphrase: string | null
  /** WP publish date (ISO), for sorting and display. */
  publishedAt: string | null
  /** WP last-updated date, UTC (ISO), for sorting and display. */
  modifiedAt: string | null
}

export type Tab = 'all' | 'top' | ContentType

export type SortDir = 'asc' | 'desc'

export type ScoreBand = 'good' | 'warn' | 'bad' | 'none'

export function band(score: number | null): ScoreBand {
  if (score == null) return 'none'
  return score >= 80 ? 'good' : score >= 50 ? 'warn' : 'bad'
}

/**
 * Ink and background per band. Every screen that paints a score reads these, so a
 * band means the same colour on the Dashboard boxes, the Completed table and Page
 * Detail. The names are a contract with the tokens in `audit.css` — renaming one
 * there without changing it here fails silently, painting nothing.
 */
export const SCORE_COLOR: Record<ScoreBand, string> = {
  good: 'var(--score-good)',
  warn: 'var(--score-warn)',
  bad: 'var(--score-bad)',
  none: 'var(--score-none)',
}

export const SCORE_SOFT: Record<ScoreBand, string> = {
  good: 'var(--score-good-soft)',
  warn: 'var(--score-warn-soft)',
  bad: 'var(--score-bad-soft)',
  none: 'var(--score-none-soft)',
}

/** Per-type published counts for one site (Domain List screen). */
export type TypeCounts = Partial<Record<ContentType, number>>

/** What the Dashboard's Run dropdown can trigger for a page. */
export type AgentKind =
  | 'full'
  | 'full-agent'
  | 'semrush'
  | 'content'
  | 'schema'
  | 'technical'
  | 'performance'
  | 'geo'
  | 'sxo'
  | 'drift'

export const AGENT_KIND_LABELS: Record<AgentKind, string> = {
  full: 'Full Scan',
  'full-agent': '+ SemRush',
  semrush: 'Semrush Agent',
  content: 'Content Agent',
  schema: 'Schema Agent',
  technical: 'Technical Agent',
  performance: 'Performance Agent',
  geo: 'GEO Agent',
  sxo: 'SXO Agent',
  drift: 'Drift Agent',
}

export const AGENT_KINDS: AgentKind[] = [
  'full',
  'full-agent',
  'semrush',
  'content',
  'schema',
  'technical',
  'performance',
  'geo',
  'sxo',
  'drift',
]

/** Agent kinds offered in the Run / Re-Run dropdown — full scans only. */
export const RUNNABLE_AGENT_KINDS: AgentKind[] = ['full', 'full-agent']

/** Status shown per-row on the Dashboard — synced from `audit.seo_agent_tracker`. */
export type TaskStatus =
  'not-started' | 'scheduled' | 'in-progress' | 'in-review' | 'done' | 'error'

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  'not-started': 'Not Started',
  scheduled: 'Scheduled',
  'in-progress': 'In Progress',
  'in-review': 'In Review',
  done: 'Done',
  error: 'Error',
}

export const TASK_STATUSES: TaskStatus[] = [
  'not-started',
  'scheduled',
  'in-progress',
  'in-review',
  'done',
  'error',
]

export type Team = 'marketing' | 'it'

export const TEAM_LABELS: Record<Team, string> = {
  marketing: 'Marketing',
  it: 'IT',
}

/**
 * One assignable person. The standalone portal hardcoded two arrays of first
 * names; the roster is now derived from Payload's Marketing and IT departments
 * (see `audit-roster.ts`), and assignments are stored as emails rather than
 * names so they survive someone changing their display name.
 */
export interface Assignee {
  id: string
  name: string
  email: string
  team: Team
}

/**
 * Dimensions Marketing can act on inside the WordPress UI (content + AIOSEO
 * fields); everything else (technical, CWV, schema, competitive) needs
 * IT/backend work, so IT is the exact complement. Shared by the Page Detail view
 * picker and the Dashboard's per-team finding counts, which must agree on the
 * split.
 */
export const MARKETING_DIMS = new Set([
  'content_quality',
  'on_page_seo',
  'ai_search_readiness',
  'ai_citation_readiness',
  'content_issues',
  'content_recommendations',
])

/**
 * Which team a set of assignees belongs to — null when it's nobody, or a mix of
 * both, in which case all findings are theirs rather than one team's slice.
 *
 * Takes the roster as an argument rather than closing over a module-level
 * constant: the roster is a database read now, and a stale copy here would
 * silently mis-split every finding count on the Dashboard.
 */
export function teamOf(
  assignedEmails: readonly string[],
  roster: readonly Assignee[],
): Team | null {
  if (!assignedEmails.length) return null
  const teams = new Set<Team>()
  for (const email of assignedEmails) {
    const member = roster.find((r) => r.email === email)
    // An assignee who has left the department no longer narrows the split.
    if (!member) return null
    teams.add(member.team)
  }
  return teams.size === 1 ? [...teams][0]! : null
}

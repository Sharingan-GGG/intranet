/**
 * Shared vocabulary for the Audit Hub: content types, score bands, agent kinds,
 * task statuses, and the Marketing/IT dimension split.
 *
 * Deliberately free of `next/*` and server-only imports so the same definitions
 * serve the server components that query Supabase and the client components that
 * render the result.
 */

/**
 * The hub's one date format — "15 Sep 2026".
 *
 * One helper because it was three, and one of the three quietly used en-NZ
 * while the others used en-AU. Same output for these options, but the next
 * option added to one copy would not have reached the others.
 */
export const fmtAuditDate = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—'

/**
 * `numeric` columns come back from pg as strings, not numbers — `overall` and
 * `delta` both — and the report blobs carry them as strings too. Every read of
 * a score goes through here so one never reaches the UI as "76" and sorts as
 * a string.
 *
 * Lives here rather than beside the pool: `audit-report.ts` needs it and is a
 * pure adapter, so importing it from the server-only db module would drag
 * `pg` into a module the client imports types from.
 */
export function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n) : null
}

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

// --- GA4 traffic -----------------------------------------------------------

export const GA4_RANGES = [7, 28, 90, 365] as const
export type Ga4RangeDays = (typeof GA4_RANGES)[number]

/**
 * The window every GA4 screen opens on, and the fallback for an unrecognised
 * `?days=`. Only a default: Traffic's seg buttons and the Dashboard's GA4
 * Views header both move it, and the Dashboard drawer follows whatever is
 * picked.
 */
export const DEFAULT_GA4_RANGE: Ga4RangeDays = 28

/**
 * How each range is written in the UI.
 *
 * Shared rather than spelled out per screen: Traffic and the Dashboard's GA4
 * Views column offer the same four windows, and two copies would eventually
 * disagree about whether 365 is "12 months" or "1 year".
 */
export const GA4_RANGE_LABELS: Record<Ga4RangeDays, string> = {
  7: '7 days',
  28: '28 days',
  90: '90 days',
  365: '12 months',
}

/**
 * The same window, compact — for the Dashboard's GA4 Views header, where the
 * select *is* the column heading and has to fit a table column rather than a
 * row of seg buttons.
 */
export function ga4RangeShort(days: Ga4RangeDays): string {
  return days === 365 ? '12M' : `${days}D`
}

export function resolveGa4Range(raw: string | undefined): Ga4RangeDays {
  const n = Number(raw)
  return (GA4_RANGES as readonly number[]).includes(n) ? (n as Ga4RangeDays) : DEFAULT_GA4_RANGE
}

export type Ga4PageEngagement = {
  pageTitle: string
  /** Host-relative path, for the link under the title. Empty if GA had none. */
  pagePath: string
  views: number
  activeUsers: number
  newUsers: number
  sessions: number
  engagedSessions: number
  /** Derived over the window, never averaged. Null with no sessions. */
  engagementRate: number | null
  /** Seconds per active user — GA4's "average engagement time". Null with no users. */
  avgEngagementTime: number | null
  /** Views per active user, the other half of GA4's Pages report. */
  viewsPerUser: number | null
}

/**
 * The sentinel for "don't filter by channel".
 *
 * A value rather than an absent param so the select always has something
 * selected, and so the URL says plainly which of the two the screen is showing.
 */
export const GA4_ALL_CHANNELS = 'all'

export type Ga4ChannelTotals = {
  channel: string
  sessions: number
  activeUsers: number
  share: number
  /**
   * The same share over the window before this one, so a card can say which
   * way the mix is moving. Zero when the previous window had no sessions at
   * all — a delta against nothing is not a rise, and `ga4DeltaOf` drops it.
   */
  prevShare: number
}

/**
 * The six summary figures.
 *
 * Four respond to the channel filter; `organicShare` and `aiAssistant` do not —
 * they describe how the site's traffic is *composed*, which is a property fact,
 * not a fact about the slice you are looking at. Their cards say so.
 */
export type Ga4Cards = {
  /** Organic Search as a fraction of all sessions. Property-wide. */
  organicShare: number | null
  prevOrganicShare: number | null
  /** Sessions referred by ChatGPT, Gemini, Perplexity and friends. Property-wide. */
  aiAssistant: number
  prevAiAssistant: number
  keyEvents: number
  prevKeyEvents: number
  bounceRate: number
  prevBounceRate: number
  viewsPerSession: number
  prevViewsPerSession: number
  sessionsPerUser: number
  prevSessionsPerUser: number
}

export type Ga4PageDetail = {
  views: number
  prevViews: number
  activeUsers: number
  prevActiveUsers: number
  newUsers: number
  sessions: number
  prevSessions: number
  keyEvents: number
  prevKeyEvents: number
  /** Derived over the window, never averaged. Null with no sessions. */
  engagementRate: number | null
  /** Seconds per active user. Null with no users. */
  avgEngagementTime: number | null
}

export type Ga4Split = { label: string; views: number; activeUsers: number; sessions: number }

/** The SEO side of the hub, for the same URL — the reason both screens exist. */
export type Ga4PageAudit = {
  trackerId: string
  overall: number | null
  status: string | null
}

/** Thousands separators, the one way every audit screen writes a count. */
export function fmtNum(n: number): string {
  return n.toLocaleString('en-AU')
}

/**
 * One spelling for a page path, so three sources can be compared.
 *
 * WordPress gives `/deals/`, GA4 reports `/deals`, and the tracker holds both.
 * Client-safe because the Dashboard matches rows against a GA4 path set in the
 * browser.
 */
export function normaliseAuditPath(path: string): string {
  return path.replace(/\/+$/, '').toLowerCase()
}

/**
 * Views for one page path over the Dashboard's window.
 *
 * An array of pairs rather than a Map: it crosses the server/client boundary,
 * and the Dashboard rebuilds the lookup it wants on arrival. `path` is already
 * normalised, so the rows can be matched without re-normalising the whole list
 * on every render.
 */
export type Ga4PathViews = { path: string; views: number }

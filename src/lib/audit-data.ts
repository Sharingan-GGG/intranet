import 'server-only'

/**
 * Every read the Audit Hub does against the `audit` schema.
 *
 * Plain SQL over a direct Postgres connection — see audit-db.ts for why this is
 * not supabase-js. Two things the PostgREST version had to be clever about are
 * simply easier here:
 *
 *   - "only the page's newest run counts" was a client-side dedupe repeated in
 *     four places; it is now `distinct on` in the query that needs it.
 *   - the per-team finding counts were one request aliasing the same embed four
 *     times with per-alias filters; they are now four `count(*) filter (...)`
 *     expressions over a single join.
 *
 * The jsonb projection is kept: the content-audit list reads one boolean and
 * two fields out of documents totalling ~2.3 MB per domain, so those paths are
 * projected in the select list rather than shipping the documents.
 *
 * Reads throw. The portal swallowed every failure into an empty result so
 * tracking could never block the UI, but on the server an empty table and a
 * broken query look identical to the user — an error boundary is the honest
 * outcome. Writes (app/audit/actions.ts) still return a result to toast.
 */
import { auditQuery } from './audit-db'
import type { ContentAuditReport, PageReport, SummaryReport } from './audit-report'
import {
  MARKETING_DIMS,
  numOrNull,
  type ContentAuditStatus,
  type StatusType,
  type TaskStatus,
} from './audit-types'

const DB_STATUS_TO_TASK: Record<string, TaskStatus> = {
  'Not Yet Started': 'not-started',
  Scheduled: 'scheduled',
  'In Progress': 'in-progress',
  'In Review': 'in-review',
  Done: 'done',
  Error: 'error',
}

export const TASK_TO_DB_STATUS: Record<TaskStatus, StatusType> = {
  'not-started': 'Not Yet Started',
  scheduled: 'Scheduled',
  'in-progress': 'In Progress',
  'in-review': 'In Review',
  done: 'Done',
  error: 'Error',
}

const toTaskStatus = (status: string | null): TaskStatus =>
  DB_STATUS_TO_TASK[status ?? ''] ?? 'not-started'

/**
 * The SQL spelling of `normaliseAuditPath`, for the `distinct on` keys.
 * `rtrim(url, '/')` strips every trailing slash, matching that function's
 * regex; the two must agree or a lookup keyed in JS misses the row the query
 * returned.
 */
const NORM_URL = `lower(rtrim(url, '/'))`

/** Domains are matched with LIKE %domain% on the stored url, as the portal did. */
const like = (domain: string) => `%${domain}%`

// ---------------------------------------------------------------------------
// Tracker
// ---------------------------------------------------------------------------

export interface TrackedRow {
  id: string
  status: TaskStatus
  /** The "Full Scan" column = 'Yes' — a scan has actually been queued. */
  fullScan: boolean
  /**
   * agent_semrush = 'Yes' — queued with the SemRush agent included (the
   * 'full-agent' kind). With fullScan this drives the Scan Type column.
   */
  semrush: boolean
  /** Emails assigned to this page; null in the column, [] here. */
  assigned: string[]
}

/** Latest tracked row per URL for a domain — the Dashboard Status column's source. */
export async function fetchLatestStatuses(domain: string): Promise<Record<string, TrackedRow>> {
  const rows = await auditQuery<{
    id: string
    url: string
    status: string | null
    agent_semrush: string | null
    assigned: string[] | null
    full_scan: string | null
  }>(
    `select distinct on (url)
            id, url, status, agent_semrush, assigned, "Full Scan" as full_scan
       from audit.seo_agent_tracker
      where "Domain" = $1 and url is not null
      order by url, created_at desc`,
    [domain],
  )

  const latest: Record<string, TrackedRow> = {}
  for (const row of rows) {
    latest[row.url] = {
      id: row.id,
      status: toTaskStatus(row.status),
      fullScan: row.full_scan === 'Yes',
      semrush: row.agent_semrush === 'Yes',
      assigned: row.assigned ?? [],
    }
  }
  return latest
}

/**
 * One tracker row's assignees and status, from the id a Page Detail deep link
 * carries. Status comes back too because a deep link has no dashboard state to
 * inherit it from, and both Assign and Mark as Done are gated on In Review.
 */
export interface TrackerMeta {
  assigned: string[]
  status: TaskStatus | null
}

export async function fetchTrackerMeta(id: string): Promise<TrackerMeta> {
  const rows = await auditQuery<{ assigned: string[] | null; status: string | null }>(
    `select assigned, status from audit.seo_agent_tracker where id = $1`,
    [id],
  )
  const row = rows[0]
  if (!row) return { assigned: [], status: null }
  return { assigned: row.assigned ?? [], status: toTaskStatus(row.status) }
}

/** This URL+domain's existing tracker row, so runs upsert instead of duplicating. */
export async function findTrackerRowId(url: string, domain: string): Promise<string | null> {
  const rows = await auditQuery<{ id: string }>(
    `select id from audit.seo_agent_tracker
      where url = $1 and "Domain" = $2
      order by created_at desc
      limit 1`,
    [url, domain],
  )
  return rows[0]?.id ?? null
}

// ---------------------------------------------------------------------------
// Stats and the Completed table
// ---------------------------------------------------------------------------



export interface DoneAudit {
  trackerId: string
  /** The tracker's stored url — re-run against this so the same row updates. */
  url: string
  /** Current merged score — reflects any single-dimension re-scans. */
  overall: number | null
  /** The baseline (last FULL scan) — not overridden by single re-runs. */
  runType: string | null
  ranAt: string | null
  /** Latest run of any type, when newer than the full scan (else null). */
  lastUpdatedAt: string | null
  /** Dimension of the most recent single re-run, if that is the newest run. */
  lastRescanDim: string | null
}

/**
 * Pages whose current tracker status is Done, keyed by normalized url, joined
 * to their newest run and their newest *full* run.
 *
 * Both are needed and they are not the same thing: the full run is the baseline
 * (Run Type and the Audited date), while the newest run of any type drives the
 * current score and the "re-scanned" indicator.
 */
export async function fetchDoneAudits(domain: string): Promise<Record<string, DoneAudit>> {
  const rows = await auditQuery<{
    key: string
    tracker_id: string
    url: string
    overall: string | null
    newest_ran_at: string | null
    newest_run_type: string | null
    agents_run: string[] | null
    base_run_type: string | null
    base_ran_at: string | null
  }>(
    `with latest_tracker as (
       select distinct on (${NORM_URL}) id, url, status, ${NORM_URL} as key
         from audit.seo_agent_tracker
        where "Domain" = $1 and url is not null
        order by ${NORM_URL}, created_at desc
     ),
     done as (select * from latest_tracker where status = 'Done'),
     newest as (
       select distinct on (tracker_id) tracker_id, overall, run_type, ran_at, agents_run
         from audit.audit_runs
        where tracker_id in (select id from done)
        order by tracker_id, ran_at desc
     ),
     newest_full as (
       select distinct on (tracker_id) tracker_id, run_type, ran_at
         from audit.audit_runs
        where tracker_id in (select id from done) and run_type = 'full'
        order by tracker_id, ran_at desc
     )
     select d.key, d.id as tracker_id, d.url,
            n.overall, n.ran_at as newest_ran_at, n.run_type as newest_run_type, n.agents_run,
            coalesce(f.run_type, n.run_type) as base_run_type,
            coalesce(f.ran_at,   n.ran_at)   as base_ran_at
       from done d
       left join newest      n on n.tracker_id = d.id
       left join newest_full f on f.tracker_id = d.id`,
    [domain],
  )

  const result: Record<string, DoneAudit> = {}
  for (const row of rows) {
    // A run newer than the last full one exists.
    const rescanned = !!row.newest_ran_at && row.newest_ran_at !== row.base_ran_at
    result[row.key] = {
      trackerId: row.tracker_id,
      url: row.url,
      overall: numOrNull(row.overall),
      runType: row.base_run_type,
      ranAt: row.base_ran_at,
      lastUpdatedAt: rescanned ? row.newest_ran_at : null,
      lastRescanDim:
        rescanned && row.newest_run_type === 'single' ? (row.agents_run?.[0] ?? null) : null,
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Runs and findings
// ---------------------------------------------------------------------------

/** One persisted finding — carries the uuid needed to mark it done. */
export interface IssueRow {
  id: string
  priority: string | null
  dimension: string | null
  title: string | null
  recommendation: string | null
  /** null while the finding is still open. */
  doneAt: string | null
}

export interface RunDetail {
  runId: string
  report: PageReport
  issues: IssueRow[]
}

/** Most recent run (report + findings) for a tracker row — null if none yet. */
export async function fetchLatestRunDetail(trackerId: string): Promise<RunDetail | null> {
  const rows = await auditQuery<{ id: string; report: PageReport | null }>(
    `select id, report from audit.audit_runs
      where tracker_id = $1
      order by ran_at desc
      limit 1`,
    [trackerId],
  )
  const run = rows[0]
  if (!run) return null
  return { runId: run.id, report: run.report ?? {}, issues: await fetchIssues(run.id) }
}

async function fetchIssues(runId: string): Promise<IssueRow[]> {
  const rows = await auditQuery<{
    id: string
    priority: string | null
    dimension: string | null
    title: string | null
    recommendation: string | null
    done_at: string | null
  }>(
    `select id, priority, dimension, title, recommendation, done_at
       from audit.audit_issues
      where run_id = $1`,
    [runId],
  )
  return rows.map((r) => ({
    id: r.id,
    priority: r.priority,
    dimension: r.dimension,
    title: r.title,
    recommendation: r.recommendation,
    doneAt: r.done_at,
  }))
}

export interface RunHistoryEntry {
  runId: string
  runType: string | null
  agentsRun: string[]
  overall: number | null
  /** overall − previous run's overall. */
  delta: number | null
  ranAt: string | null
}

export async function fetchRunHistory(trackerId: string): Promise<RunHistoryEntry[]> {
  const rows = await auditQuery<{
    id: string
    run_type: string | null
    agents_run: string[] | null
    overall: string | null
    delta: string | null
    ran_at: string | null
  }>(
    `select id, run_type, agents_run, overall, delta, ran_at
       from audit.audit_runs
      where tracker_id = $1
      order by ran_at desc`,
    [trackerId],
  )
  return rows.map((r) => ({
    runId: r.id,
    runType: r.run_type,
    agentsRun: r.agents_run ?? [],
    overall: numOrNull(r.overall),
    delta: numOrNull(r.delta),
    ranAt: r.ran_at,
  }))
}

/**
 * Findings per tracker row — the Dashboard's Full Scan boxes.
 *
 * Only the page's newest run counts, and that rule lives in the `latest` CTE.
 * Page Detail renders that run's findings and nothing else, so summing every
 * run made the box impossible to reconcile against the cards: a page scanned
 * five times showed 151 open against 12 on screen.
 *
 * `*Marketing` is the marketing-dimension slice of each total; IT's slice is
 * the remainder, since the two teams split the dimensions exactly.
 */
export interface IssueCounts {
  open: number
  openMarketing: number
  done: number
  doneMarketing: number
}

export async function fetchIssueCounts(domain: string): Promise<Record<string, IssueCounts>> {
  const rows = await auditQuery<{
    tracker_id: string
    open: string
    open_mkt: string
    done: string
    done_mkt: string
  }>(
    `with latest as (
       select distinct on (tracker_id) id, tracker_id
         from audit.audit_runs
        where tracker_id is not null and url like $1
        order by tracker_id, ran_at desc
     )
     select l.tracker_id,
            count(i.id) filter (where i.done_at is null)::text                                as open,
            count(i.id) filter (where i.done_at is null     and i.dimension = any($2))::text  as open_mkt,
            count(i.id) filter (where i.done_at is not null)::text                            as done,
            count(i.id) filter (where i.done_at is not null and i.dimension = any($2))::text  as done_mkt
       from latest l
       left join audit.audit_issues i on i.run_id = l.id
      group by l.tracker_id`,
    [like(domain), [...MARKETING_DIMS]],
  )

  const byTracker: Record<string, IssueCounts> = {}
  for (const r of rows) {
    byTracker[r.tracker_id] = {
      open: Number(r.open),
      openMarketing: Number(r.open_mkt),
      done: Number(r.done),
      doneMarketing: Number(r.done_mkt),
    }
  }
  return byTracker
}


// ---------------------------------------------------------------------------
// Site content audit (lightweight E-E-A-T triage, separate from the tracker)
// ---------------------------------------------------------------------------

export interface ContentAuditRow {
  id: string
  url: string
  status: ContentAuditStatus
  report: ContentAuditReport | null
  summaryReport: SummaryReport | null
  error: string | null
  finishedAt: string | null
  archived: boolean
}

export interface ContentAuditListRow {
  id: string
  url: string
  status: ContentAuditStatus
  /** Whether `report` holds a document — never the document itself. */
  hasReport: boolean
  /**
   * Whether a summary_report exists at all. Distinct from `decision` being
   * null: a summary can exist without one, and the Status and Decision columns
   * show a muted placeholder for "not audited yet" rather than "audited, no
   * decision".
   */
  hasSummary: boolean
  decision: string | null
  expiry: SummaryReport['expiry'] | null
  error: string | null
  finishedAt: string | null
  archived: boolean
}

/**
 * Latest content_audits row per URL for a domain.
 *
 * `report` and `summary_report` run to ~2.3 MB per domain and this screen reads
 * one boolean and two fields out of them, so the jsonb paths are projected in
 * the select list: 3.8 MB down to ~320 KB for RAT AU's 553 rows. `report->>'url'`
 * is the existence probe — this table's report has no `meta` key (that is
 * PageReport, the other report shape) but every row carries `url`.
 */
export async function fetchContentAudits(
  domain: string,
): Promise<Record<string, ContentAuditListRow>> {
  const rows = await auditQuery<{
    id: string
    url: string
    status: ContentAuditStatus
    has_report: boolean
    has_summary: boolean
    decision: string | null
    expiry: SummaryReport['expiry'] | null
    error: string | null
    finished_at: string | null
    archived: boolean
  }>(
    `select id, url, status, error, finished_at, archived,
            (report ->> 'url') is not null   as has_report,
            summary_report is not null       as has_summary,
            summary_report ->> 'decision'    as decision,
            summary_report ->  'expiry'      as expiry
       from audit.content_audits
      where domain = $1`,
    [domain],
  )

  const byUrl: Record<string, ContentAuditListRow> = {}
  for (const r of rows) {
    byUrl[r.url] = {
      id: r.id,
      url: r.url,
      status: r.status,
      hasReport: r.has_report,
      hasSummary: r.has_summary,
      decision: r.decision,
      expiry: r.expiry ?? null,
      error: r.error,
      finishedAt: r.finished_at,
      archived: r.archived,
    }
  }
  return byUrl
}

/** One content_audits row by id — hydrates a deep-linked content audit report. */
export async function fetchContentAuditById(id: string): Promise<ContentAuditRow | null> {
  const rows = await auditQuery<{
    id: string
    url: string
    status: ContentAuditStatus
    report: ContentAuditReport | null
    summary_report: SummaryReport | null
    error: string | null
    finished_at: string | null
    archived: boolean
  }>(
    `select id, url, status, report, summary_report, error, finished_at, archived
       from audit.content_audits
      where id = $1`,
    [id],
  )
  const r = rows[0]
  if (!r) return null
  return {
    id: r.id,
    url: r.url,
    status: r.status,
    report: r.report,
    summaryReport: r.summary_report,
    error: r.error,
    finishedAt: r.finished_at,
    archived: r.archived,
  }
}

/**
 * Terminal-state probe for the content-audit poll: `url -> status` only, so an
 * eight-second poll costs a few hundred bytes rather than the whole table.
 */
export async function fetchContentAuditStatusesByUrl(
  urls: string[],
): Promise<Record<string, ContentAuditStatus>> {
  if (!urls.length) return {}
  const rows = await auditQuery<{ url: string; status: ContentAuditStatus }>(
    `select url, status from audit.content_audits where url = any($1)`,
    [urls],
  )
  return Object.fromEntries(rows.map((r) => [r.url, r.status]))
}

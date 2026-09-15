import 'server-only'

/**
 * Loaders for the Page Detail screen, which serves two different report
 * sources through one component.
 */
import {
  fetchContentAuditById,
  fetchLatestRunDetail,
  fetchRunHistory,
  fetchTrackerMeta,
  type IssueRow,
  type RunHistoryEntry,
} from './audit-data'
import {
  recordFromContentAuditReport,
  recordFromReport,
  type AuditRecord,
  type ContentAuditReport,
} from './audit-report'
import type { TaskStatus } from './audit-types'

export type PageDetailData = {
  record: AuditRecord
  issues: IssueRow[]
  history: RunHistoryEntry[]
  trackerId: string | null
  status: TaskStatus | null
  assigned: string[]
  /**
   * Whether each finding is a row in `audit_issues` that can be written back
   * to. False for a content audit, whose findings only exist inside the report
   * blob — the screen drops the per-card controls rather than offering a Done
   * with nothing behind it.
   */
  markable: boolean
}

/** A full scan: the newest run's report jsonb plus its relational findings. */
export async function loadPageDetail(trackerId: string): Promise<PageDetailData | null> {
  const [run, history, meta] = await Promise.all([
    fetchLatestRunDetail(trackerId),
    fetchRunHistory(trackerId),
    fetchTrackerMeta(trackerId),
  ])
  if (!run) return null

  return {
    record: recordFromReport(run.report),
    issues: run.issues,
    history,
    trackerId,
    status: meta.status,
    assigned: meta.assigned,
    markable: true,
  }
}

/**
 * A content triage row. Its findings live inside the report blob rather than in
 * `audit_issues`, so they are adapted into the same card shape — but they have
 * no row of their own to mark done. Their ids are synthesised to key the list,
 * and `markable: false` tells the screen not to offer controls that would have
 * nothing to write to. The portal made the same call from a null id.
 */
export async function loadContentAuditDetail(id: string): Promise<PageDetailData | null> {
  const row = await fetchContentAuditById(id)
  if (!row?.report) return null

  const record = recordFromContentAuditReport(row.report as ContentAuditReport, {
    url: row.url,
    finishedAt: row.finishedAt,
  })

  const issues: IssueRow[] = (record.pageReport?.issues ?? []).map((issue, index) => ({
    // Synthetic and stable within one render — there is no audit_issues row
    // behind a content-audit finding.
    id: `content-${id}-${index}`,
    priority: issue.priority ?? null,
    dimension: issue.dimension ?? null,
    title: issue.title ?? null,
    recommendation: issue.recommendation ?? null,
    doneAt: null,
  }))

  return {
    record,
    issues,
    history: [],
    trackerId: null,
    status: null,
    assigned: [],
    markable: false,
  }
}

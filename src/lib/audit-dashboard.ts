import 'server-only'

/**
 * Assembles one Dashboard row per WordPress page by joining the four sources
 * the screen draws on: WordPress itself, the tracker, the content-audit queue,
 * and the per-run finding counts.
 *
 * The portal did this join inside its render function, against four
 * module-level `Record`s that each render had to stay in sync with. Doing it
 * once on the server means the client component receives plain serializable
 * rows and only has to filter and sort them.
 */
import { fetchAllContent } from './audit-wordpress'
import {
  fetchContentAudits,
  fetchDoneAudits,
  fetchIssueCounts,
  fetchLatestStatuses,
  normUrl,
  type ContentAuditListRow,
  type DoneAudit,
  type IssueCounts,
  type TrackedRow,
} from './audit-data'
import type { Site } from './audit-config'
import type { ContentType, TaskStatus } from './audit-types'

export type DashboardRow = {
  /** WordPress post id — unique within a domain, used as the React key. */
  id: number
  title: string
  url: string
  path: string
  type: ContentType
  publishedAt: string | null
  modifiedAt: string | null
  /** AIOSEO focus-keyphrase score (KAS), 0-100, null when no keyphrase is set. */
  keywordScore: number | null
  keyphrase: string | null

  /** Tracker row, when this page has ever been queued for a full scan. */
  trackerId: string | null
  status: TaskStatus | null
  fullScan: boolean
  semrush: boolean
  assigned: string[]

  /** Content-audit queue row, when one exists. */
  contentAuditId: string | null
  contentStatus: 'none' | 'queued' | 'running' | 'done' | 'error'
  hasContentReport: boolean
  /** A summary_report exists — the Status and Decision columns need this to
   *  tell "not audited yet" from "audited, no decision". */
  hasContentSummary: boolean
  decision: string | null
  isExpired: unknown
  archived: boolean
  contentError: string | null

  /** Findings on the page's newest run only. */
  counts: IssueCounts | null
  /** Latest-run summary, present once the page is Done. */
  done: DoneAudit | null
}

export type DashboardData = {
  rows: DashboardRow[]
  /** Set when WordPress could not be read; the screen offers a retry. */
  error: string | null
}

export async function loadDashboard(site: Site): Promise<DashboardData> {
  const [statuses, contentAudits, issueCounts, doneAudits] = await Promise.all([
    fetchLatestStatuses(site.domain),
    fetchContentAudits(site.domain),
    fetchIssueCounts(site.domain),
    fetchDoneAudits(site.domain),
  ])

  /**
   * WordPress is the one source that can be down independently — it's three
   * third-party sites, not our database. A failure there shouldn't take the
   * whole screen out with an error boundary when every Supabase read
   * succeeded, so it degrades to an empty list plus a message.
   */
  let wpRows
  try {
    wpRows = await fetchAllContent(site)
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : 'WordPress is unreachable.' }
  }

  const rows = wpRows.map((row): DashboardRow => {
    const tracker: TrackedRow | undefined = statuses[row.url]
    const content: ContentAuditListRow | undefined = contentAudits[row.url]
    return {
      id: row.id,
      title: row.title,
      url: row.url,
      path: row.path,
      type: row.type,
      publishedAt: row.publishedAt,
      modifiedAt: row.modifiedAt,
      keywordScore: row.keywordScore,
      keyphrase: row.keyphrase,

      trackerId: tracker?.id ?? null,
      status: tracker?.status ?? null,
      fullScan: tracker?.fullScan ?? false,
      semrush: tracker?.semrush ?? false,
      assigned: tracker?.assigned ?? [],

      contentAuditId: content?.id ?? null,
      contentStatus: content?.status ?? 'none',
      hasContentReport: content?.hasReport ?? false,
      hasContentSummary: content?.hasSummary ?? false,
      decision: content?.decision ?? null,
      isExpired: content?.expiry?.is_expired ?? null,
      archived: content?.archived ?? false,
      contentError: content?.error ?? null,

      counts: tracker ? (issueCounts[tracker.id] ?? null) : null,
      done: doneAudits[normUrl(row.url)] ?? null,
    }
  })

  return { rows, error: null }
}

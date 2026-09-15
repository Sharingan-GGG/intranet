import 'server-only'

/**
 * The Completed table: every page whose tracker status is Done, joined back to
 * WordPress for its title and focus keyphrase.
 *
 * Unlike the Dashboard this does not list the whole domain — the page list
 * comes from the tracker, so WordPress is queried by slug for just those URLs
 * rather than paged through in full.
 */
import {
  fetchAssignedByUrl,
  fetchAuditStats,
  fetchDoneAudits,
  normUrl,
  type AuditStats,
} from './audit-data'
import { fetchRowsForUrls } from './audit-wordpress'
import type { Site } from './audit-config'
import type { CompletedRow, ContentType } from './audit-types'

export type CompletedTableRow = {
  trackerId: string
  url: string
  title: string
  path: string
  type: ContentType | null
  keywordScore: number | null
  keyphrase: string | null
  modifiedAt: string | null
  overall: number | null
  runType: string | null
  ranAt: string | null
  lastUpdatedAt: string | null
  lastRescanDim: string | null
  assigned: string[]
}

export type CompletedData = {
  rows: CompletedTableRow[]
  stats: AuditStats
  error: string | null
}

export async function loadCompleted(site: Site): Promise<CompletedData> {
  const [done, stats, assignedByUrl] = await Promise.all([
    fetchDoneAudits(site.domain),
    fetchAuditStats(site.domain),
    fetchAssignedByUrl(site.domain),
  ])

  const entries = Object.entries(done)
  if (!entries.length) return { rows: [], stats, error: null }

  // WordPress is third-party and can be down on its own; the scores still mean
  // something without a title, so degrade to the URL rather than erroring out.
  let wpByUrl = new Map<string, CompletedRow>()
  let error: string | null = null
  try {
    wpByUrl = await fetchRowsForUrls(
      site,
      entries.map(([, d]) => d.url),
    )
  } catch (err) {
    error = err instanceof Error ? err.message : 'WordPress is unreachable.'
  }

  const rows = entries.map(([key, audit]): CompletedTableRow => {
    const wp = wpByUrl.get(audit.url)
    return {
      trackerId: audit.trackerId,
      url: audit.url,
      title: wp?.title ?? audit.url,
      path: wp?.path ?? audit.url,
      type: wp?.type ?? null,
      keywordScore: wp?.keywordScore ?? null,
      keyphrase: wp?.keyphrase ?? null,
      modifiedAt: wp?.modifiedAt ?? null,
      overall: audit.overall,
      runType: audit.runType,
      ranAt: audit.ranAt,
      lastUpdatedAt: audit.lastUpdatedAt,
      lastRescanDim: audit.lastRescanDim,
      assigned: assignedByUrl[normUrl(audit.url)] ?? [],
    }
  })

  return { rows, stats, error }
}

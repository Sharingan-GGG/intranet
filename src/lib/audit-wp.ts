import 'server-only'

import { createHash } from 'node:crypto'

import { auditQuery } from './audit-db'
import { SITES, type Site } from './audit-config'
import { auditPath, contentPreCheckForPath } from './audit-route'
import type { ContentAuditStatus, StatusType } from './audit-types'

/**
 * The intranet side of the Audit Hub WordPress plugin.
 *
 * The plugin's server (PHP) calls `/api/audit/wp/*` with
 * `Authorization: Bearer <key>`. The key identifies the site: its sha256 is
 * looked up in `audit.wp_connections`, and that row's `domain` is the only
 * domain the request may touch. Status flows back the other way through the
 * database trigger in `supabase/database/schemas/audit/functions/
 * wp_notify_status.sql`, which signs with the same row's `webhook_secret`.
 *
 * Keys are issued per site and per environment by `scripts/audit-wp-key.mjs`.
 */

export type WpConnection = { domain: string; site: Site; webhookSecret: string }

export const hashWpKey = (key: string) => createHash('sha256').update(key).digest('hex')

/**
 * The site a request's bearer key belongs to, or null.
 *
 * Also refuses a connection whose domain is no longer one of the Audit Hub's
 * sites — `siteByDomain` would quietly fall back to RAT AU, and a key must
 * never be able to write rows under a domain it was not issued for.
 */
export async function authenticateWpRequest(req: Request): Promise<WpConnection | null> {
  const auth = req.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(\S+)$/.exec(auth)
  if (!match) return null

  const rows = await auditQuery<{ domain: string; webhook_secret: string }>(
    `update audit.wp_connections
        set last_seen_at = now()
      where key_hash = $1 and enabled
      returning domain, webhook_secret`,
    [hashWpKey(match[1]!)],
  )
  const row = rows[0]
  if (!row) return null
  const site = SITES.find((s) => s.domain === row.domain)
  if (!site) return null
  return { domain: row.domain, site, webhookSecret: row.webhook_secret }
}

/**
 * Whether `url` is a page on this connection's site.
 *
 * Host must be the bare domain or its www form. The URL itself is used as-is
 * afterwards: the audit tables match on the exact permalink string, so it is
 * not normalised here.
 */
export function urlBelongsTo(url: unknown, domain: string): url is string {
  if (typeof url !== 'string' || url.length > 2048) return false
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    const host = u.hostname.toLowerCase()
    return host === domain || host === `www.${domain}`
  } catch {
    return false
  }
}

const AUDIT_LABELS: Record<ContentAuditStatus | 'none', string> = {
  none: 'Not Started',
  queued: 'Queued',
  running: 'Auditing',
  done: 'Done',
  error: 'Failed',
}

const SCAN_STATUS: Record<StatusType, { key: string; label: string }> = {
  'Not Yet Started': { key: 'not-started', label: 'Not Started' },
  Scheduled: { key: 'scheduled', label: 'Scheduled' },
  'In Progress': { key: 'in-progress', label: 'In Progress' },
  'In Review': { key: 'in-review', label: 'In Review' },
  Done: { key: 'done', label: 'Done' },
  Error: { key: 'error', label: 'Error' },
}

export type WpPageStatus = {
  url: string
  audit: { status: ContentAuditStatus | 'none'; label: string; at: string | null; error: string | null }
  fullScan: {
    /** The page has a tracker row, i.e. it sits on the Full Scan tab. */
    inList: boolean
    status: string
    label: string
    at: string | null
    error: string | null
  }
  /** Path on the intranet (the plugin prefixes its configured base URL). */
  hubPath: string
  /** Where to move a page onto the Full Scan list. */
  fullScanListPath: string
}

const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null)

/** Current Audit / Full Scan state for each url, in one query per table. */
export async function fetchWpPageStatuses(
  urls: string[],
  domain: string,
): Promise<Record<string, WpPageStatus>> {
  if (!urls.length) return {}

  const [audits, trackers] = await Promise.all([
    auditQuery<{
      id: string
      url: string
      status: ContentAuditStatus
      queued_at: Date
      started_at: Date | null
      finished_at: Date | null
      error: string | null
    }>(
      `select id, url, status, queued_at, started_at, finished_at, error
         from audit.content_audits
        where url = any($1) and domain = $2`,
      [urls, domain],
    ),
    // Newest tracker row per url, matching findTrackerRowId. Its last run date
    // comes from audit_runs when the tracker's own finished_at was reset by a
    // re-queue.
    auditQuery<{
      id: string
      url: string
      status: StatusType
      created_at: Date
      started_at: Date | null
      finished_at: Date | null
      error: string | null
      last_ran_at: Date | null
    }>(
      `select distinct on (t.url)
              t.id, t.url, t.status, t.created_at, t.started_at, t.finished_at, t.error,
              (select max(r.ran_at) from audit.audit_runs r where r.tracker_id = t.id) as last_ran_at
         from audit.seo_agent_tracker t
        where t.url = any($1) and t."Domain" = $2
        order by t.url, t.created_at desc`,
      [urls, domain],
    ),
  ])

  const auditByUrl = new Map(audits.map((a) => [a.url, a]))
  const trackerByUrl = new Map(trackers.map((t) => [t.url, t]))
  const fullScanListPath = `${auditPath({ screen: 'dashboard', tab: 'full-seo-page-scan' })}?${new URLSearchParams({ domain })}`

  const out: Record<string, WpPageStatus> = {}
  for (const url of urls) {
    const a = auditByUrl.get(url)
    const t = trackerByUrl.get(url)
    const scan = t ? (SCAN_STATUS[t.status] ?? SCAN_STATUS['Not Yet Started']) : null

    let hubPath: string
    if (t) {
      hubPath = auditPath({
        screen: 'page-detail',
        trackerId: t.id,
        from: { screen: 'dashboard', tab: 'full-seo-page-scan' },
      })
    } else if (a?.status === 'done') {
      hubPath = auditPath({
        screen: 'content-audit',
        contentAuditId: a.id,
        from: { screen: 'dashboard', tab: 'content-pre-check' },
      })
    } else {
      let path = url
      try {
        path = new URL(url).pathname
      } catch {}
      hubPath = contentPreCheckForPath(domain, path)
    }

    out[url] = {
      url,
      audit: {
        status: a?.status ?? 'none',
        label: AUDIT_LABELS[a?.status ?? 'none'],
        at: a ? iso(a.finished_at ?? a.started_at ?? a.queued_at) : null,
        error: a?.error ?? null,
      },
      fullScan: {
        inList: !!t,
        status: scan ? scan.key : 'none',
        label: scan ? scan.label : 'Not in Full Scan',
        at: t ? iso(t.finished_at ?? t.last_ran_at ?? t.started_at ?? t.created_at) : null,
        error: t?.error ?? null,
      },
      hubPath,
      fullScanListPath,
    }
  }
  return out
}

/** Busy states — a second click while one of these is showing is refused. */
export const AUDIT_BUSY = new Set(['queued', 'running'])
export const SCAN_BUSY = new Set(['scheduled', 'in-progress'])

export type WpConnectionSummary = { connected: boolean; lastSeenAt: string | null }

/**
 * Plugin state per domain, for the Domain List's "Plugin connected" badge.
 *
 * Connected = an enabled key whose plugin has registered its webhook endpoint
 * (i.e. Test connection has succeeded at least once). Never throws: before the
 * wp_connections table exists in an environment, the badge is just absent.
 */
export async function fetchWpConnectionSummaries(): Promise<Record<string, WpConnectionSummary>> {
  try {
    const rows = await auditQuery<{ domain: string; connected: boolean; last_seen_at: Date | null }>(
      `select domain, (enabled and webhook_url is not null) as connected, last_seen_at
         from audit.wp_connections`,
    )
    return Object.fromEntries(
      rows.map((r) => [r.domain, { connected: r.connected, lastSeenAt: iso(r.last_seen_at) }]),
    )
  } catch {
    return {}
  }
}

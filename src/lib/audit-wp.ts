import 'server-only'

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

import { auditQuery, auditTransaction } from './audit-db'
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

// ---------------------------------------------------------------------------
// The plugin's Connect button
// ---------------------------------------------------------------------------
//
// Settings → Audit Hub → Connect sends the browser to /audit/wp-connect with
// the WordPress site, a return URL, a CSRF `state` and a PKCE `challenge`.
// Someone signed into the intranet with Audit Hub access approves; the browser
// goes back to WordPress with a one-time code; WordPress's server trades code +
// verifier for a site key at /api/audit/wp/exchange. The key is minted at that
// moment and only ever travels server to server.

const CODE_TTL_MINUTES = 10

const b64url = (buf: Buffer) => buf.toString('base64url')

/** The Audit Hub site a WordPress host belongs to (bare or www), or null. */
export function siteForHost(host: unknown): Site | null {
  if (typeof host !== 'string') return null
  const bare = host.toLowerCase().replace(/^www\./, '')
  return SITES.find((s) => s.domain === bare) ?? null
}

/**
 * Where the plugin wants the browser sent back, if it is safe to send it there:
 * https, on the site's own domain, and WordPress's admin-post endpoint. The
 * code rides on this redirect, so it must never point anywhere else.
 */
export function safeReturnUrl(raw: unknown, site: Site): URL | null {
  if (typeof raw !== 'string' || raw.length > 2048) return null
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:') return null
    if (u.username || u.password) return null
    if (!urlBelongsTo(u.toString(), site.domain)) return null
    if (!u.pathname.endsWith('/wp-admin/admin-post.php')) return null
    return u
  } catch {
    return null
  }
}

/** A PKCE S256 challenge: 43 base64url characters. */
export const isChallenge = (v: unknown): v is string =>
  typeof v === 'string' && /^[A-Za-z0-9_-]{43}$/.test(v)

/** Mint a one-time connect code for `domain`, approved by `createdBy`. */
export async function issueConnectCode(
  domain: string,
  challenge: string,
  createdBy: string,
): Promise<string> {
  const code = `ahc_${b64url(randomBytes(32))}`
  await auditQuery(
    `insert into audit.wp_connect_codes (code_hash, domain, challenge, created_by, expires_at)
     values ($1, $2, $3, $4, now() + make_interval(mins => $5))`,
    [hashWpKey(code), domain, challenge, createdBy, CODE_TTL_MINUTES],
  )
  // Expired codes are useless; sweep them here rather than on a schedule.
  await auditQuery(`delete from audit.wp_connect_codes where expires_at < now() - interval '1 day'`)
  return code
}

export type ExchangeResult =
  | { ok: true; key: string; domain: string; site: string; connectedBy: string }
  | { ok: false; error: string }

/**
 * Trade a connect code + PKCE verifier for a new site key.
 *
 * Single use, inside one transaction: the code row is locked, checked and
 * spent, and the site's key and webhook secret are replaced in the same commit
 * — so a second exchange of the same code, or a race between two, gets nothing.
 * Replacing the key is the point (it is how Connect rotates), so the old key
 * stops working the moment this succeeds.
 */
export async function exchangeConnectCode(code: string, verifier: string): Promise<ExchangeResult> {
  if (!/^ahc_[A-Za-z0-9_-]{43}$/.test(code) || !/^[A-Za-z0-9_-]{43,128}$/.test(verifier)) {
    return { ok: false, error: 'Malformed code or verifier.' }
  }

  return auditTransaction(async (q) => {
    const rows = await q<{ domain: string; challenge: string; created_by: string }>(
      `select domain, challenge, created_by from audit.wp_connect_codes
        where code_hash = $1 and used_at is null and expires_at > now()
        for update`,
      [hashWpKey(code)],
    )
    const row = rows[0]
    if (!row) return { ok: false, error: 'This connect code is invalid, used or expired. Click Connect again.' }

    const expected = Buffer.from(row.challenge)
    const actual = Buffer.from(b64url(createHash('sha256').update(verifier).digest()))
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return { ok: false, error: 'The connect code does not match this request.' }
    }

    const site = SITES.find((s) => s.domain === row.domain)
    if (!site) return { ok: false, error: 'This site is no longer in the Audit Hub.' }

    await q(`update audit.wp_connect_codes set used_at = now() where code_hash = $1`, [hashWpKey(code)])

    const key = `ahk_${b64url(randomBytes(32))}`
    await q(
      `insert into audit.wp_connections (domain, key_hash, webhook_secret, connected_by)
       values ($1, $2, $3, $4)
       on conflict (domain) do update
         set key_hash = excluded.key_hash,
             webhook_secret = excluded.webhook_secret,
             connected_by = excluded.connected_by,
             enabled = true`,
      [row.domain, hashWpKey(key), b64url(randomBytes(32)), row.created_by],
    )
    return { ok: true, key, domain: row.domain, site: site.label, connectedBy: row.created_by }
  })
}

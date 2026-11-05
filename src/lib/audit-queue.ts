import 'server-only'

import { auditQuery, auditTransaction } from './audit-db'
import { findTrackerRowId } from './audit-data'
import type { AgentKind, YesNo } from './audit-types'

/**
 * The queue writes behind "Run Content Audit" and "Full Scan", with no access
 * check of their own.
 *
 * Two callers gate them differently: the server actions in
 * `src/app/audit/actions.ts` check the signed-in user's `route:audit` access,
 * and the WordPress plugin routes under `/api/audit/wp/*` check the site's key.
 * Keeping the SQL here means a run queued from WordPress is byte-for-byte the
 * run the Audit Hub button would have queued.
 */
export type QueueResult = { ok: true } | { ok: false; error: string }

const AGENT_FIELDS = [
  'content',
  'schema',
  'technical',
  'performance',
  'geo',
  'sxo',
  'drift',
  'semrush',
] as const

/**
 * Queue a scan for a page, creating its tracker row if this is the first time.
 *
 * Full Scan / Full Scan + SemRush are queued for the worker to pick up, so they
 * land as Scheduled; the worker flips them to In Progress once it actually
 * starts fetching. Single-agent kinds go straight to In Progress.
 */
export async function queueAgentRun(row: {
  url: string
  domain: string
  agentKind: AgentKind
}): Promise<QueueResult> {
  const isFull = row.agentKind === 'full' || row.agentKind === 'full-agent'

  // Which agent_* flags this kind turns on. 'full' is everything except
  // semrush; 'full-agent' is everything; a single kind is just itself.
  const on = new Set<string>()
  if (row.agentKind === 'full') AGENT_FIELDS.forEach((f) => f !== 'semrush' && on.add(f))
  else if (row.agentKind === 'full-agent') AGENT_FIELDS.forEach((f) => on.add(f))
  else if ((AGENT_FIELDS as readonly string[]).includes(row.agentKind)) on.add(row.agentKind)

  const flag = (field: string): YesNo => (on.has(field) ? 'Yes' : 'No')
  const values = [
    row.url,
    row.domain,
    isFull ? 'Yes' : 'No',
    ...AGENT_FIELDS.map((f) => flag(f)),
    isFull ? 'Scheduled' : 'In Progress',
    new Date().toISOString().slice(0, 10),
  ]

  try {
    const id = await findTrackerRowId(row.url, row.domain)
    if (id) {
      await auditQuery(
        `update audit.seo_agent_tracker set
           "Full Scan" = $1, agent_content = $2, agent_schema = $3, agent_technical = $4,
           agent_performance = $5, agent_geo = $6, agent_sxo = $7, agent_drift = $8,
           agent_semrush = $9, status = $10, executed_date = $11,
           schedule = 'Monthly',
           -- Reset the worker's bookkeeping on every (re)queue. Otherwise the
           -- previous run's started_at lingers and the worker's
           -- "started_at is null" unclaimed-work filter skips a page that was
           -- just re-queued.
           started_at = null, finished_at = null, error = null
         where id = $12`,
        [...values.slice(2), id],
      )
    } else {
      await auditQuery(
        `insert into audit.seo_agent_tracker
           (url, "Domain", "Full Scan", agent_content, agent_schema, agent_technical,
            agent_performance, agent_geo, agent_sxo, agent_drift, agent_semrush,
            status, executed_date, schedule)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'Monthly')`,
        values,
      )
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not queue the scan.' }
  }

  // The row is queued either way; the worker also polls, so a failed nudge
  // delays the run rather than losing it.
  return fireFullScanWorker()
}

/**
 * Queue every given URL for a lightweight content-only triage pass, then nudge
 * the worker once for the whole batch (not once per URL).
 */
export async function queueContentAudits(urls: string[], domain: string): Promise<QueueResult> {
  if (!urls.length) return { ok: true }

  try {
    // One statement for the whole batch via unnest, rather than a round trip
    // per URL — a whole-domain sweep is ~550 rows.
    await auditTransaction((q) =>
      q(
        `insert into audit.content_audits (url, domain, status, queued_at)
         select u, $2, 'queued', now() from unnest($1::text[]) as u
         on conflict (url) do update set
           status = 'queued',
           queued_at = now(),
           -- Reset bookkeeping on every re-queue, same reason as queueAgentRun.
           started_at = null,
           finished_at = null,
           error = null`,
        [urls, domain],
      ),
    )
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not queue the audits.' }
  }

  return fireContentAuditWorker()
}

/**
 * Nudge an external worker to drain its queue.
 *
 * The portal did this through a Supabase Edge Function
 * (`fire-site-content-audit`) whose source lived nowhere in the repo, reading
 * its target URL and token from an `app_secrets` table. Both are gone: the URL
 * and token are env vars, and the outbound POST happens here, after the caller
 * has already done its own access check.
 *
 * A failed nudge is reported but not fatal — the row is queued regardless and
 * the workers also poll, so the run is delayed rather than lost.
 */
/**
 * How a routine trigger token authenticates.
 *
 * Routine trigger tokens are OAuth tokens (`sk-ant-oat…`), which must go in
 * `Authorization: Bearer` — sent as `x-api-key` they get a 401
 * "Authentication failed" (found 2026-11-05: every production content-audit
 * nudge was being refused this way). Plain API keys (`sk-ant-api…`) keep
 * using `x-api-key`.
 */
function authHeader(token: string): Record<string, string> {
  return token.startsWith('sk-ant-oat')
    ? { Authorization: `Bearer ${token}` }
    : { 'x-api-key': token }
}

async function fireWorker(
  url: string | undefined,
  token: string | undefined,
  label: string,
): Promise<QueueResult> {
  if (!url) return { ok: true }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // These endpoints are Claude Code routine triggers on api.anthropic.com.
        ...(token ? { ...authHeader(token), 'anthropic-version': '2023-06-01' } : {}),
      },
      cache: 'no-store',
    })
    if (!res.ok) {
      return { ok: false, error: `Queued, but the ${label} worker did not accept the nudge.` }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: `Queued, but the ${label} worker could not be reached.` }
  }
}

const fireContentAuditWorker = () =>
  fireWorker(
    process.env.AUDIT_CONTENT_FIRE_URL,
    process.env.AUDIT_CONTENT_FIRE_TOKEN,
    'content audit',
  )

const fireFullScanWorker = () =>
  fireWorker(
    process.env.AUDIT_FULL_SCAN_FIRE_URL,
    process.env.AUDIT_FULL_SCAN_FIRE_TOKEN,
    'full scan',
  )

'use server'

/**
 * Every write the Audit Hub makes.
 *
 * The standalone portal did these as PATCH/POST/DELETE straight from the
 * browser with the anon key, which is why its RLS had to grant anon update and
 * delete on the tracker. Here they are server actions: the anon role has no
 * grants on the `audit` schema at all, each action re-checks `route:audit`
 * access rather than trusting the caller, and each ends in a `revalidatePath`
 * so the server components re-render with the new rows — replacing the manual
 * refetch-and-repaint the portal did after every click.
 *
 * They deliberately return a result object instead of throwing. A failed write
 * should surface as a toast next to the button that caused it, not replace the
 * whole dashboard with an error boundary — which is what reads in
 * `audit-data.ts` do, and should.
 */
import { revalidatePath, updateTag } from 'next/cache'

import { auditQuery, auditTransaction } from '@/lib/audit-db'
import {
  GA4_DASHBOARD_TAG,
  ingestGa4,
  loadGa4PageAudit,
  loadGa4PageDetail,
  loadGa4PropertyForDomain,
} from '@/lib/audit-ga4'
import {
  fetchContentAuditById,
  fetchContentAuditStatusesByUrl,
  findTrackerRowId,
  TASK_TO_DB_STATUS,
} from '@/lib/audit-data'
import type { SummaryReport } from '@/lib/audit-report'
import {
  resolveGa4Range,
  type AgentKind,
  type ContentAuditStatus,
  type TaskStatus,
  type YesNo,
} from '@/lib/audit-types'
import { getAuditSession } from '@/lib/audit-user'

export type ActionResult = { ok: true } | { ok: false; error: string }

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
 * Refuse the write unless the caller still has `route:audit`.
 *
 * Server actions are reachable by anyone who can guess the action id, so this
 * is the real access gate — the check on the page only decides what gets
 * rendered.
 */
async function requireAccess(): Promise<ActionResult> {
  const { user, canAccess } = await getAuditSession()
  if (!user) return { ok: false, error: 'Not signed in.' }
  if (!canAccess) return { ok: false, error: 'You do not have access to the Audit Hub.' }
  return { ok: true }
}

/** Every Audit Hub route reads the same tables, so one call covers the lot. */
function revalidateAudit() {
  revalidatePath('/audit', 'layout')
}

const no: YesNo = 'No'
const yes: YesNo = 'Yes'

/**
 * Queue a scan for a page, creating its tracker row if this is the first time.
 *
 * Full Scan / Full Scan + SemRush are queued for the worker to pick up, so they
 * land as Scheduled; the worker flips them to In Progress once it actually
 * starts fetching. Single-agent kinds go straight to In Progress.
 */
export async function trackAgentRun(row: {
  url: string
  domain: string
  agentKind: AgentKind
}): Promise<ActionResult> {
  const gate = await requireAccess()
  if (!gate.ok) return gate

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

  const fired = await fireFullScanWorker()
  revalidateAudit()
  // The row is queued either way; the worker also polls, so a failed nudge
  // delays the run rather than losing it.
  return fired.ok ? { ok: true } : fired
}

/**
 * Land a page on the Full Scan tab without scheduling a run — creates (or
 * resets) its tracker row as Not Yet Started, so it shows up there but nothing
 * is queued until that row's own Full Scan button is clicked.
 *
 * `clearAgents` also blanks the run selection — every agent_* flag plus the
 * "Full Scan" column back to 'No'. Cancel passes it, so a cancelled scan leaves
 * nothing marked for the worker; plain staging from the Content tab doesn't,
 * since there is no selection to undo.
 */
export async function stageFullScanRow(
  url: string,
  domain: string,
  { clearAgents = false } = {},
): Promise<ActionResult> {
  const gate = await requireAccess()
  if (!gate.ok) return gate

  const clearFlags = clearAgents
    ? `, "Full Scan" = 'No', ${AGENT_FIELDS.map((f) => `agent_${f} = 'No'`).join(', ')}`
    : ''

  try {
    const id = await findTrackerRowId(url, domain)
    if (id) {
      await auditQuery(
        `update audit.seo_agent_tracker
            set status = 'Not Yet Started',
                started_at = null, finished_at = null, error = null${clearFlags}
          where id = $1`,
        [id],
      )
    } else {
      await auditQuery(
        `insert into audit.seo_agent_tracker (url, "Domain", status)
         values ($1, $2, 'Not Yet Started')`,
        [url, domain],
      )
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not stage the page.' }
  }

  revalidateAudit()
  return { ok: true }
}

/**
 * Cancel a scheduled scan by resetting the page's tracker row.
 *
 * The portal deleted the row outright. That is no longer safe: `audit_runs`
 * references the tracker with NO ACTION precisely so a cancel cannot take a
 * page's audit history with it, and on a page that has ever been scanned the
 * delete would now fail on the foreign key. Resetting to Not Yet Started
 * produces the same visible result — the page reappears on the Full Scan tab
 * unqueued — and keeps the history.
 */
export async function cancelScheduledScan(url: string, domain: string): Promise<ActionResult> {
  return stageFullScanRow(url, domain, { clearAgents: true })
}

/**
 * Send a page back to Content-only — it leaves the Full Scan tab entirely.
 *
 * "Is this page in Full Scan" means "does it have a tracker row", so the revert
 * is a delete. `audit_runs.tracker_id` is NO ACTION rather than CASCADE
 * precisely so a delete here cannot take the page's audit history with it, so
 * the runs are detached first: they keep their `url` and stay queryable, and
 * the tracker row goes. Both in one transaction — a detach without the delete
 * would orphan the history for nothing.
 */
export async function revertToContent(url: string, domain: string): Promise<ActionResult> {
  const gate = await requireAccess()
  if (!gate.ok) return gate

  const id = await findTrackerRowId(url, domain)
  if (!id) return { ok: true }

  try {
    await auditTransaction(async (q) => {
      await q(`update audit.audit_runs set tracker_id = null where tracker_id = $1`, [id])
      await q(`delete from audit.seo_agent_tracker where id = $1`, [id])
    })
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not move the page back to Content.',
    }
  }

  revalidateAudit()
  return { ok: true }
}

/** Update a tracker row's status by its id (Page Detail already knows it). */
export async function updateTrackerStatusById(
  id: string,
  status: TaskStatus,
): Promise<ActionResult> {
  const gate = await requireAccess()
  if (!gate.ok) return gate
  try {
    await auditQuery(`update audit.seo_agent_tracker set status = $1 where id = $2`, [
      TASK_TO_DB_STATUS[status],
      id,
    ])
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not update the status.' }
  }
  revalidateAudit()
  return { ok: true }
}

/** Update a tracker row's status, looked up by url + domain. */
export async function updateTrackerStatus(
  url: string,
  domain: string,
  status: TaskStatus,
): Promise<ActionResult> {
  const gate = await requireAccess()
  if (!gate.ok) return gate

  const id = await findTrackerRowId(url, domain)
  if (!id) return { ok: false, error: 'No tracker row for this page yet — run it once first.' }
  return updateTrackerStatusById(id, status)
}

/**
 * Set (or clear) who is assigned to a tracker row.
 *
 * Stored as emails, not the bare first names the portal used — see
 * `audit-roster.ts`. An empty list is stored as null, so "nobody" has one
 * representation in the database.
 */
export async function updateTrackerAssigned(
  id: string,
  assignedEmails: string[],
): Promise<ActionResult> {
  const gate = await requireAccess()
  if (!gate.ok) return gate
  try {
    // An empty list is stored as null, so "nobody" has one representation.
    await auditQuery(`update audit.seo_agent_tracker set assigned = $1 where id = $2`, [
      assignedEmails.length ? assignedEmails : null,
      id,
    ])
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not save the assignment.',
    }
  }
  revalidateAudit()
  return { ok: true }
}

/** Mark one finding done, or reopen it. */
export async function updateIssueDone(issueId: string, done: boolean): Promise<ActionResult> {
  const gate = await requireAccess()
  if (!gate.ok) return gate
  try {
    await auditQuery(`update audit.audit_issues set done_at = $1 where id = $2`, [
      done ? new Date().toISOString() : null,
      issueId,
    ])
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not update the finding.',
    }
  }
  revalidateAudit()
  return { ok: true }
}

/**
 * Archive (or restore) a page's content_audits row by url.
 *
 * Upserts, so it works for a page with no content_audits row yet;
 * merge-duplicates only touches `archived`, leaving an existing row's
 * report and status alone.
 */
export async function setContentAuditArchived(
  url: string,
  domain: string,
  archived: boolean,
): Promise<ActionResult> {
  const gate = await requireAccess()
  if (!gate.ok) return gate
  try {
    // Upsert, so this works for a page with no content_audits row yet; the
    // conflict branch touches only `archived`, leaving an existing row's
    // report and status alone.
    await auditQuery(
      `insert into audit.content_audits (url, domain, archived, status)
       values ($1, $2, $3, 'queued')
       on conflict (url) do update set archived = excluded.archived`,
      [url, domain, archived],
    )
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not archive the page.' }
  }
  revalidateAudit()
  return { ok: true }
}

/**
 * Queue every given URL for a lightweight content-only triage pass, then nudge
 * the worker once for the whole batch (not once per URL).
 */
export async function queueSiteContentAudit(urls: string[], domain: string): Promise<ActionResult> {
  const gate = await requireAccess()
  if (!gate.ok) return gate
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
           -- Reset bookkeeping on every re-queue, same reason as trackAgentRun.
           started_at = null,
           finished_at = null,
           error = null`,
        [urls, domain],
      ),
    )
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not queue the audits.' }
  }

  const fired = await fireContentAuditWorker()
  revalidateAudit()
  return fired.ok ? { ok: true } : fired
}

/**
 * Nudge an external worker to drain its queue.
 *
 * The portal did this through a Supabase Edge Function
 * (`fire-site-content-audit`) whose source lived nowhere in the repo, reading
 * its target URL and token from an `app_secrets` table. Both are gone: the URL
 * and token are env vars, and the outbound POST happens here, where it is
 * already behind the same access check as the write that triggered it.
 *
 * A failed nudge is reported but not fatal — the row is queued regardless and
 * the workers also poll, so the run is delayed rather than lost.
 */
async function fireWorker(
  url: string | undefined,
  token: string | undefined,
  label: string,
): Promise<ActionResult> {
  if (!url) return { ok: true }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // These endpoints are Claude Code routine triggers on api.anthropic.com
        // and the tokens are `sk-ant-` API keys, which authenticate with
        // `x-api-key` — `Authorization: Bearer` is for OAuth tokens.
        ...(token ? { 'x-api-key': token, 'anthropic-version': '2023-06-01' } : {}),
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

/**
 * Drop the cached WordPress reads for a domain.
 *
 * Replaces the portal's `invalidate(domain)`, which cleared a per-tab `Map`.
 * The tag is set on every WordPress fetch in `audit-wordpress.ts`, so this
 * clears the shared Data Cache for everyone rather than one browser tab.
 *
 * `updateTag` rather than `revalidateTag`: this runs in a server action, and
 * updateTag gives read-your-own-writes, so the person who pressed Refresh sees
 * the new data in the same round trip instead of the render that follows.
 */
/**
 * Re-pull GA4 now.
 *
 * Unlike refreshWordPress, which only drops a fetch-cache tag, there is no
 * cache to drop here: the traffic screen reads Postgres, so refreshing means
 * actually going to Google. It calls `ingestGa4` in-process rather than POSTing
 * to the ingest route — that route exists for cron, which has no session, and a
 * self-addressed HTTP call would need the server to know its own public origin.
 *
 * `ingestGa4` shares an in-flight run, so a second click joins the first rather
 * than doubling the API spend.
 */
export async function refreshGa4(): Promise<ActionResult> {
  const gate = await requireAccess()
  if (!gate.ok) return gate
  try {
    const result = await ingestGa4({ days: 3 })
    // The Dashboard's channel list and path sets are cached for an hour; an
    // explicit refresh should not leave them an hour behind.
    updateTag(GA4_DASHBOARD_TAG)
    revalidateAudit()
    if (!result.ok) {
      return result.properties === 0
        ? { ok: false, error: 'No GA4 properties visible — check the service account\u2019s access in GA.' }
        : { ok: false, error: `Refreshed, but ${result.errors.length} property/properties failed.` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'GA4 refresh failed.' }
  }
}

export async function refreshWordPress(domain: string): Promise<ActionResult> {
  const gate = await requireAccess()
  if (!gate.ok) return gate
  updateTag(`audit-wp:${domain}`)
  revalidateAudit()
  return { ok: true }
}

/**
 * Terminal-state probe for the content-audit poll.
 *
 * A read, but exposed as a server action rather than a route handler: the
 * dashboard is the only caller, it needs the same access gate as everything
 * else here, and a route handler would be one more public surface to protect.
 * Returns only `url -> status`, so an eight-second poll costs a few hundred
 * bytes rather than the whole table.
 */
export async function getContentAuditStatuses(
  urls: string[],
): Promise<Record<string, ContentAuditStatus>> {
  const gate = await requireAccess()
  if (!gate.ok || !urls.length) return {}
  try {
    return await fetchContentAuditStatusesByUrl(urls)
  } catch {
    // The poll must not take the dashboard down; an empty map just means
    // "nothing terminal yet" and it tries again in eight seconds.
    return {}
  }
}

/**
 * One content audit's `summary_report`, for the read-only dialog behind the
 * Decision chip.
 *
 * The Dashboard's list query deliberately carries only the two fields the
 * table paints (`decision` and `expiry`) — `report` and `summary_report` run
 * to megabytes per domain, so loading them for every row to serve the handful
 * a user actually opens is the wrong trade. The dialog opens immediately and
 * this fills it in.
 */
export async function getContentAuditSummary(id: string): Promise<SummaryReport | null> {
  const gate = await requireAccess()
  if (!gate.ok) return null
  try {
    return (await fetchContentAuditById(id))?.summaryReport ?? null
  } catch {
    return null
  }
}

export type PageTrafficResult =
  | {
      ok: true
      /** False when the site has no GA4 property at all. */
      hasProperty: boolean
      /** Null when GA has nothing for this path — a real answer, not a failure. */
      data: Awaited<ReturnType<typeof loadGa4PageDetail>> | null
      audit: Awaited<ReturnType<typeof loadGa4PageAudit>>
    }
  | { ok: false; error: string }

/**
 * One page's traffic, for the Dashboard's drawer.
 *
 * A read exposed as a server action, like `getContentAuditStatuses` above: the
 * Dashboard is the only caller and it needs the same access gate.
 *
 * The Traffic screen gets this through an intercepting route instead, because
 * its drawer opens over a list cheap enough to keep mounted. The Dashboard's
 * list is WordPress plus four queries plus GA — intercepting across that
 * segment would re-run the lot — so here the drawer fetches on demand and the
 * queue behind it is never touched.
 */
export async function getPageTraffic(
  domain: string,
  path: string,
  days?: number,
): Promise<PageTrafficResult> {
  const gate = await requireAccess()
  if (!gate.ok) return { ok: false, error: gate.error }

  try {
    const propertyId = await loadGa4PropertyForDomain(domain)
    // The audit lookup is local and worth having even with no GA4 property.
    const audit = await loadGa4PageAudit(domain, path).catch(() => null)
    if (!propertyId) return { ok: true, hasProperty: false, data: null, audit }

    // Resolved here, not trusted: this is a server action, so the window is
    // client input like any other and only the four offered ranges may through.
    const data = await loadGa4PageDetail(propertyId, resolveGa4Range(days?.toString()), path)
    // No views in the window means GA genuinely has nothing for this path —
    // distinct from a request that failed, and the drawer says so.
    const empty = data.detail.views === 0 && data.daily.length === 0
    return { ok: true, hasProperty: true, data: empty ? null : data, audit }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not load page traffic.' }
  }
}

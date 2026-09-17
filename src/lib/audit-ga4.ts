import 'server-only'

/**
 * GA4 traffic for the Audit Hub: the nightly ingest, and the reads behind
 * `/audit/traffic`.
 *
 * The screen never talks to Google. A nightly job writes one row per property
 * per day into `audit.ga4_daily` and the page reads Postgres, which is what
 * makes the range selector instant and keeps a page view off Google's quota.
 * `google-analytics.ts` is the only thing in here that knows GA exists.
 *
 * Reads throw, the same as `audit-data.ts` — an empty table and a broken query
 * look identical to the user, so an error boundary is the honest outcome. The
 * ingest returns a result object instead, because a single property's 403 must
 * not cost us the other nine.
 */
import { unstable_cache } from 'next/cache'

import { auditQuery, auditTransaction, numOrNull } from './audit-db'
import {
  GA4_ALL_CHANNELS,
  type Ga4Cards,
  type Ga4ChannelTotals,
  type Ga4PageAudit,
  type Ga4PageDetail,
  type Ga4PageEngagement,
  type Ga4PropertyTotals,
  type Ga4RangeDays,
  type Ga4Split,
  GA4_DASHBOARD_DAYS,
  normaliseAuditPath,
} from './audit-types'
import {
  listGa4Properties,
  runGa4ChannelReport,
  runGa4DailyReport,
  runGa4PageBreakdown,
  runGa4PageReport,
  runGa4PageTotals,
  runGa4SummaryReport,
  type Ga4DailyRow,
} from './google-analytics'

/**
 * How many trailing days the nightly job re-pulls.
 *
 * Not 1. GA4 figures are not final for roughly 48 hours, so pulling only
 * yesterday would store provisional numbers permanently and they would drift
 * away from what the GA UI shows for the same day. Re-pulling three days every
 * night costs one extra request per property and makes the table self-healing.
 */
const DEFAULT_INGEST_DAYS = Number(process.env.GA4_INGEST_DAYS ?? 3) || 3

export type Ga4IngestResult = {
  ok: boolean
  properties: number
  rowsWritten: number
  errors: { propertyId: string; message: string }[]
}

/**
 * A run already in progress, shared rather than duplicated.
 *
 * A cron overlap or an impatient second click on Refresh would otherwise mean
 * two full passes over the estate at once, for identical data.
 */
let inFlight: Promise<Ga4IngestResult> | null = null

export async function ingestGa4(opts?: { days?: number }): Promise<Ga4IngestResult> {
  if (inFlight) return inFlight
  inFlight = runIngest(opts?.days ?? DEFAULT_INGEST_DAYS).finally(() => {
    inFlight = null
  })
  return inFlight
}

async function runIngest(rawDays: number): Promise<Ga4IngestResult> {
  const days = Math.min(Math.max(Math.trunc(rawDays), 1), 400)
  const properties = await listGa4Properties()

  if (properties.length === 0) {
    // Authenticating fine and seeing nothing is the signature of a per-property
    // grant: the Admin API only enumerates properties for an account-level
    // viewer. Said plainly here because the alternative is a screen that is
    // simply empty and blames nothing.
    console.warn(
      '[ga4-ingest] discovered 0 properties — check the service account has Viewer at the GA *account* level, not per property',
    )
    return { ok: false, properties: 0, rowsWritten: 0, errors: [] }
  }

  await auditTransaction(async (q) => {
    for (const p of properties) {
      await q(
        `insert into audit.ga4_properties
           (property_id, display_name, account_id, account_name, domain, time_zone)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (property_id) do update set
           display_name = excluded.display_name,
           account_id   = excluded.account_id,
           account_name = excluded.account_name,
           -- coalesce, not overwrite: a domain corrected by hand must survive a
           -- night when the data-stream lookup failed and returned null.
           domain       = coalesce(excluded.domain, audit.ga4_properties.domain),
           time_zone    = coalesce(excluded.time_zone, audit.ga4_properties.time_zone),
           is_active    = true,
           last_seen_at = now()`,
        [p.propertyId, p.displayName, p.accountId, p.accountName, p.domain, p.timeZone],
      )
    }
    // Flagged, never deleted: the daily rows cascade, and their history is
    // still worth reading under the name the property had.
    await q(`update audit.ga4_properties set is_active = false where property_id <> all($1)`, [
      properties.map((p) => p.propertyId),
    ])
  })

  const errors: { propertyId: string; message: string }[] = []
  let rowsWritten = 0

  // Relative tokens, not dates computed here: Google resolves them in each
  // property's own timezone, so an AU and an NZ property each get their own
  // "yesterday" instead of both getting Sydney's. `today` is excluded — a
  // partial day reads as a cliff on every trend.
  const startDate = `${days}daysAgo`
  const endDate = 'yesterday'

  for (const p of properties) {
    try {
      const rows = await runGa4DailyReport(p.propertyId, startDate, endDate)
      if (rows.length > 0) {
        await upsertDaily(p.propertyId, rows)
        rowsWritten += rows.length
      }
    } catch (err) {
      errors.push({
        propertyId: p.propertyId,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (errors.length > 0) {
    console.error(`[ga4-ingest] ${errors.length} of ${properties.length} properties failed`, errors)
  }

  return { ok: errors.length === 0, properties: properties.length, rowsWritten, errors }
}

/** All of a property's days in one round trip, via parallel arrays. */
async function upsertDaily(propertyId: string, rows: Ga4DailyRow[]): Promise<void> {
  await auditQuery(
    `insert into audit.ga4_daily
       (property_id, date, active_users, new_users, sessions, engaged_sessions,
        engagement_rate, avg_session_duration, screen_page_views, fetched_at)
     select $1, d.date, d.au, d.nu, d.s, d.es, d.er, d.asd, d.pv, now()
       from unnest($2::date[], $3::int[], $4::int[], $5::int[], $6::int[],
                   $7::numeric[], $8::numeric[], $9::int[])
         as d(date, au, nu, s, es, er, asd, pv)
     on conflict (property_id, date) do update set
       active_users         = excluded.active_users,
       new_users            = excluded.new_users,
       sessions             = excluded.sessions,
       engaged_sessions     = excluded.engaged_sessions,
       engagement_rate      = excluded.engagement_rate,
       avg_session_duration = excluded.avg_session_duration,
       screen_page_views    = excluded.screen_page_views,
       fetched_at           = now()`,
    [
      propertyId,
      rows.map((r) => r.date),
      rows.map((r) => Math.round(r.activeUsers)),
      rows.map((r) => Math.round(r.newUsers)),
      rows.map((r) => Math.round(r.sessions)),
      rows.map((r) => Math.round(r.engagedSessions)),
      rows.map((r) => r.engagementRate),
      rows.map((r) => r.averageSessionDuration),
      rows.map((r) => Math.round(r.screenPageViews)),
    ],
  )
}

// ---------------------------------------------------------------------------
// Reads
//
// The range vocabulary and the row shape live in audit-types.ts, which is free
// of server-only imports: the traffic table is a client component, and reaching
// through this module for them would drag `pg` into the browser bundle.
// ---------------------------------------------------------------------------

type TotalsRow = {
  property_id: string
  display_name: string
  domain: string | null
  active_users_total: string | null
  new_users_total: string | null
  sessions_total: string | null
  engaged_total: string | null
  engagement_rate: string | null
  avg_duration: string | null
  page_views_total: string | null
  prev_active_users: string | null
  prev_sessions: string | null
}

/**
 * One row per active property, for a window of `days` ending on the newest day
 * we hold.
 *
 * Anchored on `max(date)` rather than `current_date` so the window always lines
 * up with real data: the server clock is UTC, the dates are property-local, and
 * anchoring on "today" would otherwise open every range with an empty day.
 *
 * Note what is summed and what is not. Counts sum. `engagement_rate` and
 * `avg_session_duration` are **re-derived** from the counts — averaging daily
 * rates weights a quiet Sunday the same as a busy Monday, which is simply the
 * wrong number and an easy one to ship without noticing.
 */
export async function loadGa4Totals(days: Ga4RangeDays): Promise<Ga4PropertyTotals[]> {
  const rows = await auditQuery<TotalsRow>(
    `with anchor as (
       select coalesce((select max(date) from audit.ga4_daily), current_date - 1) as cur_end
     ),
     b as (
       select cur_end,
              cur_end - ($1::int - 1)     as cur_start,
              cur_end - $1::int           as prev_end,
              cur_end - (2 * $1::int - 1) as prev_start
         from anchor
     )
     select p.property_id,
            p.display_name,
            p.domain,
            coalesce(sum(d.active_users)      filter (where d.date >= b.cur_start), 0) as active_users_total,
            coalesce(sum(d.new_users)         filter (where d.date >= b.cur_start), 0) as new_users_total,
            coalesce(sum(d.sessions)          filter (where d.date >= b.cur_start), 0) as sessions_total,
            coalesce(sum(d.engaged_sessions)  filter (where d.date >= b.cur_start), 0) as engaged_total,
            coalesce(sum(d.screen_page_views) filter (where d.date >= b.cur_start), 0) as page_views_total,
            -- The ::numeric is load-bearing, and it has to sit on the argument:
            -- bigint/bigint is integer division, so without it an engagement
            -- rate of 0.53 comes back as exactly 0 for every property. It
            -- cannot go on the sum() instead — FILTER must follow the aggregate
            -- call directly, so casting the result is a syntax error rather
            -- than merely a wrong number.
            sum(d.engaged_sessions::numeric) filter (where d.date >= b.cur_start)
              / nullif(sum(d.sessions) filter (where d.date >= b.cur_start), 0) as engagement_rate,
            sum(d.avg_session_duration * d.sessions) filter (where d.date >= b.cur_start)
              / nullif(sum(d.sessions) filter (where d.date >= b.cur_start), 0) as avg_duration,
            coalesce(sum(d.active_users) filter (where d.date <= b.prev_end), 0) as prev_active_users,
            coalesce(sum(d.sessions)     filter (where d.date <= b.prev_end), 0) as prev_sessions
       from audit.ga4_properties p
       cross join b
       left join audit.ga4_daily d
              on d.property_id = p.property_id
             and d.date between b.prev_start and b.cur_end
      where p.is_active
      group by p.property_id, p.display_name, p.domain
      order by sessions_total desc, p.display_name asc`,
    [days],
  )

  return rows.map((r) => ({
    propertyId: r.property_id,
    displayName: r.display_name,
    domain: r.domain,
    activeUsers: int(r.active_users_total),
    newUsers: int(r.new_users_total),
    sessions: int(r.sessions_total),
    engagedSessions: int(r.engaged_total),
    engagementRate: numOrNull(r.engagement_rate),
    avgSessionDuration: numOrNull(r.avg_duration),
    screenPageViews: int(r.page_views_total),
    prevActiveUsers: int(r.prev_active_users),
    prevSessions: int(r.prev_sessions),
  }))
}

/**
 * How current the table is.
 *
 * Shown on the screen because the one way a nightly cache can mislead is by
 * looking live. `maxDate` is the newest day held; `fetchedAt` is when any of it
 * was last written, so a cron that has quietly stopped shows as an old date
 * rather than as numbers that simply stopped moving.
 */
export async function loadGa4Freshness(): Promise<{
  maxDate: string | null
  fetchedAt: string | null
  properties: number
}> {
  const rows = await auditQuery<{
    max_date: string | null
    fetched_at: string | null
    properties: string
  }>(
    `select (select max(date)::text       from audit.ga4_daily)                as max_date,
            (select max(fetched_at)::text from audit.ga4_daily)                as fetched_at,
            (select count(*) from audit.ga4_properties where is_active)::text  as properties`,
  )
  const row = rows[0]
  return {
    maxDate: row?.max_date ?? null,
    fetchedAt: row?.fetched_at ?? null,
    properties: Number(row?.properties ?? 0),
  }
}

/** `sum()` comes back as a string from pg; counts are always whole. */
function int(raw: string | null): number {
  const n = Number(raw)
  return Number.isFinite(n) ? Math.round(n) : 0
}

/**
 * Top pages for the selected property.
 *
 * The one read on this screen that goes to Google at request time rather than
 * to Postgres. Per-page rows are high-cardinality — hundreds of titles per
 * property — so storing them nightly would cost far more than it saves for a
 * table that only renders for the one site you are looking at. One page view is
 * one request against a quota of 1,440 per property per day.
 *
 * Rates are derived here, from the totals, for the same reason they are derived
 * in loadGa4Totals: GA cannot be asked for a correct rate over a window.
 */
export async function loadGa4PageEngagement(
  propertyId: string,
  days: Ga4RangeDays,
  channel?: string,
): Promise<Ga4PageEngagement[]> {
  const rows = await runGa4PageReport(propertyId, `${days}daysAgo`, 'yesterday', 50, channel)
  return rows.map((r) => ({
    pageTitle: r.pageTitle,
    pagePath: r.pagePath,
    views: Math.round(r.screenPageViews),
    activeUsers: Math.round(r.activeUsers),
    newUsers: Math.round(r.newUsers),
    sessions: Math.round(r.sessions),
    engagedSessions: Math.round(r.engagedSessions),
    engagementRate: r.sessions > 0 ? r.engagedSessions / r.sessions : null,
    avgEngagementTime: r.activeUsers > 0 ? r.userEngagementDuration / r.activeUsers : null,
    viewsPerUser: r.activeUsers > 0 ? r.screenPageViews / r.activeUsers : null,
  }))
}

/**
 * The channels this property actually saw, and the figures for each.
 *
 * Derived rather than listed from GA4's full set of default channel groups, so
 * the filter never offers a channel that would return an empty table.
 *
 * Returns the list for the select and a lookup for the cards, because both come
 * out of the one request.
 */
export async function loadGa4Channels(
  propertyId: string,
  days: Ga4RangeDays,
): Promise<{
  list: Ga4ChannelTotals[]
  composition: Pick<Ga4Cards, 'organicShare' | 'prevOrganicShare' | 'aiAssistant' | 'prevAiAssistant'>
}> {
  const rows = await runGa4ChannelReport(propertyId, days)
  const totalSessions = rows.reduce((a, r) => a + r.sessions, 0)

  const list: Ga4ChannelTotals[] = rows.map((r) => ({
    channel: r.channel,
    sessions: Math.round(r.sessions),
    activeUsers: Math.round(r.activeUsers),
    share: totalSessions > 0 ? r.sessions / totalSessions : 0,
  }))

  const prevTotal = rows.reduce((a, r) => a + r.prevSessions, 0)
  const organic = rows.find((r) => r.channel === 'Organic Search')
  const ai = rows.find((r) => r.channel === 'AI Assistant')

  const composition = {
    organicShare: totalSessions > 0 && organic ? organic.sessions / totalSessions : null,
    prevOrganicShare: prevTotal > 0 && organic ? organic.prevSessions / prevTotal : null,
    aiAssistant: Math.round(ai?.sessions ?? 0),
    prevAiAssistant: Math.round(ai?.prevSessions ?? 0),
  }

  return { list, composition }
}

/**
 * The four filter-sensitive summary figures.
 *
 * Live rather than from `audit.ga4_daily`: key events are not stored there at
 * all, and the three ratios are asked of GA rather than derived so they match
 * what the GA4 UI shows. The snapshot still backs nothing on this screen — it
 * is the historical store the ingest keeps warm.
 */
export async function loadGa4Summary(
  propertyId: string,
  days: Ga4RangeDays,
  channel?: string,
): Promise<Pick<
  Ga4Cards,
  | 'keyEvents'
  | 'prevKeyEvents'
  | 'bounceRate'
  | 'prevBounceRate'
  | 'viewsPerSession'
  | 'prevViewsPerSession'
  | 'sessionsPerUser'
  | 'prevSessionsPerUser'
>> {
  const { current, previous } = await runGa4SummaryReport(propertyId, days, channel)
  return {
    keyEvents: Math.round(current.keyEvents),
    prevKeyEvents: Math.round(previous.keyEvents),
    bounceRate: current.bounceRate,
    prevBounceRate: previous.bounceRate,
    viewsPerSession: current.viewsPerSession,
    prevViewsPerSession: previous.viewsPerSession,
    sessionsPerUser: current.sessionsPerUser,
    prevSessionsPerUser: previous.sessionsPerUser,
  }
}

/** The property row for a site, without aggregating 400 days to find it. */
export async function loadGa4PropertyForDomain(domain: string): Promise<string | null> {
  const rows = await auditQuery<{ property_id: string }>(
    `select property_id from audit.ga4_properties where domain = $1 and is_active limit 1`,
    [domain],
  )
  return rows[0]?.property_id ?? null
}

export { GA4_ALL_CHANNELS, GA4_DASHBOARD_DAYS }

/**
 * Everything the page-detail screen shows, in one go.
 *
 * Five requests rather than one: GA returns a single dimension grouping per
 * report, and these are five different groupings of the same page. They run in
 * parallel and each is small.
 */
export async function loadGa4PageDetail(
  propertyId: string,
  days: Ga4RangeDays,
  pagePath: string,
  channel?: string,
): Promise<{
  detail: Ga4PageDetail
  daily: Ga4Split[]
  byChannel: Ga4Split[]
  byDevice: Ga4Split[]
  byCountry: Ga4Split[]
}> {
  const [totals, daily, byChannel, byDevice, byCountry] = await Promise.all([
    runGa4PageTotals(propertyId, days, pagePath, channel),
    runGa4PageBreakdown(propertyId, days, pagePath, 'date', 400, channel),
    // The channel split is deliberately unfiltered by channel: filtered, it
    // would be one bar at 100% and say nothing.
    runGa4PageBreakdown(propertyId, days, pagePath, 'sessionDefaultChannelGroup', 12),
    runGa4PageBreakdown(propertyId, days, pagePath, 'deviceCategory', 6, channel),
    runGa4PageBreakdown(propertyId, days, pagePath, 'country', 10, channel),
  ])

  const { current, previous } = totals
  return {
    detail: {
      views: Math.round(current.screenPageViews),
      prevViews: Math.round(previous.screenPageViews),
      activeUsers: Math.round(current.activeUsers),
      prevActiveUsers: Math.round(previous.activeUsers),
      newUsers: Math.round(current.newUsers),
      sessions: Math.round(current.sessions),
      prevSessions: Math.round(previous.sessions),
      keyEvents: Math.round(current.keyEvents),
      prevKeyEvents: Math.round(previous.keyEvents),
      engagementRate:
        current.sessions > 0 ? current.engagedSessions / current.sessions : null,
      avgEngagementTime:
        current.activeUsers > 0 ? current.userEngagementDuration / current.activeUsers : null,
    },
    daily,
    byChannel,
    byDevice,
    byCountry,
  }
}

/**
 * The SEO audit for the same URL, if this page has ever been scanned.
 *
 * The join the hub was missing: the Dashboard knows how a page is built and
 * Traffic knows whether anyone reads it, and until now neither said so. Matched
 * on the URL tail because the tracker stores absolute URLs with and without a
 * trailing slash, and on `"Domain"` to keep two sites' identical paths apart.
 */
export async function loadGa4PageAudit(
  domain: string,
  pagePath: string,
): Promise<Ga4PageAudit | null> {
  const bare = pagePath.replace(/\/+$/, '')
  const rows = await auditQuery<{ id: string; overall: string | null; status: string | null }>(
    `select t.id, t.overall::text, t.status
       from audit.seo_agent_tracker t
      where t."Domain" = $1
        and (t.url = $2 or t.url = $3 or t.url = $4 or t.url = $5)
      order by t.created_at desc
      limit 1`,
    [
      domain,
      `https://${domain}${bare}`,
      `https://${domain}${bare}/`,
      `https://www.${domain}${bare}`,
      `https://www.${domain}${bare}/`,
    ],
  )
  const row = rows[0]
  if (!row) return null
  return { trackerId: row.id, overall: numOrNull(row.overall), status: row.status }
}

/**
 * Paths on this property that saw traffic from one channel.
 *
 * A set, for the Dashboard's GA4 filter to test each row against. The limit is
 * deliberately far above the page-table's 50: this answers "did this page get
 * any organic traffic", so a page ranked 400th by views still has to be in it
 * or the filter would quietly hide pages that do qualify.
 */
export async function loadGa4PathsForChannel(
  propertyId: string,
  channel: string,
  days: Ga4RangeDays = GA4_DASHBOARD_DAYS,
): Promise<Set<string>> {
  const rows = await runGa4PageReport(propertyId, `${days}daysAgo`, 'yesterday', 1000, channel)
  return new Set(rows.map((r) => normaliseAuditPath(r.pagePath)))
}

/**
 * Cache tag for the Dashboard's GA4 lookups.
 *
 * One tag for both, because they share a vintage: the channel list and the
 * per-channel path sets are the same 28-day window, and anything that makes one
 * stale makes the other stale too.
 */
export const GA4_DASHBOARD_TAG = 'audit-ga4-dashboard'

/**
 * How long the Dashboard's GA4 lookups are held.
 *
 * The underlying window ends *yesterday*, so the answer only really changes
 * once a day; an hour is short enough to pick the new day up promptly and long
 * enough that opening the Dashboard repeatedly — which is how it is used — does
 * not spend a GA request every time.
 */
const GA4_DASHBOARD_TTL = 3600

/**
 * The channel list for the Dashboard's filter, cached.
 *
 * Deliberately separate from `loadGa4Channels`, which the Traffic screen calls
 * uncached: there the numbers are the content and are promised live, here they
 * only populate a dropdown. Same request, two different freshness contracts.
 *
 * The arguments are closed over, so they have to appear in the key parts too —
 * otherwise every property would share one cache entry.
 */
export function loadGa4ChannelList(
  propertyId: string,
  days: Ga4RangeDays,
): Promise<Ga4ChannelTotals[]> {
  return unstable_cache(
    async () => (await loadGa4Channels(propertyId, days)).list,
    ['ga4-channel-list', propertyId, String(days)],
    { revalidate: GA4_DASHBOARD_TTL, tags: [GA4_DASHBOARD_TAG] },
  )()
}

/** The same caching for the heavier per-channel path lookup. */
export function loadGa4PathsForChannelCached(
  propertyId: string,
  channel: string,
  days: Ga4RangeDays = GA4_DASHBOARD_DAYS,
): Promise<string[]> {
  return unstable_cache(
    // A Set is not serialisable, so the cache stores the array the component
    // wants anyway and the Set is rebuilt client-side.
    async () => [...(await loadGa4PathsForChannel(propertyId, channel, days))],
    ['ga4-channel-paths', propertyId, channel, String(days)],
    { revalidate: GA4_DASHBOARD_TTL, tags: [GA4_DASHBOARD_TAG] },
  )()
}

import 'server-only'

import { createSign } from 'crypto'

/**
 * Google Analytics 4, over plain REST.
 *
 * Hand-rolled the same way as `google-sheets.ts` and `google-admin.ts` rather
 * than through `@google-analytics/data`: that client is gRPC, so it bypasses
 * `fetch` entirely — and with it every caching, revalidation and
 * instrumentation idiom this codebase has. Two REST endpoints cover the whole
 * feature, so the SDK would buy nothing and cost a transport nobody else here
 * uses.
 *
 * Auth is the *plain* service-account JWT, with no `sub` claim. The Admin SDK
 * in `google-admin.ts` needs domain-wide delegation because the Directory API
 * only answers for an impersonated Workspace admin; GA4 does not work that way.
 * The service-account email is added as a Viewer on the GA account itself, and
 * then the account's own token sees every property under it — which is what
 * makes property discovery work without re-touching GA each time one is added.
 */

const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const ADMIN_API = 'https://analyticsadmin.googleapis.com/v1beta'
const DATA_API = 'https://analyticsdata.googleapis.com/v1beta'

/**
 * The metrics the traffic screen shows, in the order it shows them.
 *
 * Exported because the ingest maps them positionally onto `metricValues` —
 * the Data API returns values in request order with no names attached, so the
 * two must not drift apart.
 */
export const GA4_METRICS = [
  'activeUsers',
  'newUsers',
  'sessions',
  'engagedSessions',
  'engagementRate',
  'averageSessionDuration',
  'screenPageViews',
] as const

export type Ga4Property = {
  propertyId: string
  displayName: string
  accountId: string
  accountName: string
  /** The property's own reporting timezone; `date` values are in it. */
  timeZone: string | null
  /** Bare hostname from the web data stream, or null for app/server streams. */
  domain: string | null
}

export type Ga4DailyRow = {
  propertyId: string
  /** ISO `YYYY-MM-DD`. */
  date: string
  activeUsers: number
  newUsers: number
  sessions: number
  engagedSessions: number
  engagementRate: number
  averageSessionDuration: number
  screenPageViews: number
}

/** Properties enriched in parallel, matching the PAGE_CONCURRENCY idiom in audit-wordpress.ts. */
const PROPERTY_CONCURRENCY = 4

let _cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (_cachedToken && _cachedToken.expiresAt > Date.now() + 30_000) {
    return _cachedToken.token
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_PRIVATE_KEY

  if (!email || !rawKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY are required')
  }

  const privateKey = rawKey.replace(/\\n/g, '\n')
  const now = Math.floor(Date.now() / 1000)

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(
    JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }),
  ).toString('base64url')

  const sign = createSign('RSA-SHA256')
  sign.update(`${header}.${payload}`)
  const sig = sign.sign(privateKey, 'base64url')
  const jwt = `${header}.${payload}.${sig}`

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Google token error ${res.status}: ${detail.slice(0, 200)}`)
  }

  const json = (await res.json()) as { access_token: string; expires_in: number }
  _cachedToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 }
  return _cachedToken.token
}

export class Ga4HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'Ga4HttpError'
  }
}

/**
 * Retry the transient failures only.
 *
 * 429 is the Data API's quota response and 5xx is Google shrugging; both clear
 * on their own. A 403 never does — it means the APIs are not enabled or the
 * service account was never granted in GA — so retrying it would only turn a
 * clear setup error into a slow one.
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const status = err instanceof Ga4HttpError ? err.status : 0
      if (status !== 429 && status < 500) throw err
      if (i === attempts - 1) break
      await new Promise((r) => setTimeout(r, 500 * 2 ** i + Math.random() * 250))
    }
  }
  throw lastErr
}

async function ga4Fetch(url: string | URL, init?: RequestInit): Promise<unknown> {
  const token = await getAccessToken()
  return withRetry(async () => {
    const res = await fetch(url, {
      ...init,
      headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Ga4HttpError(res.status, `GA4 ${res.status}: ${detail.slice(0, 300)}`)
    }
    return res.json()
  })
}

/** Run `fn` over `items` a few at a time, preserving order. */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i]!)
      }
    }),
  )
  return out
}

type AccountSummary = {
  account?: string
  displayName?: string
  propertySummaries?: { property?: string; displayName?: string }[]
}

/**
 * Every GA4 property the service account can see.
 *
 * `accountSummaries` is the only endpoint that enumerates properties without
 * already knowing an account id, which is exactly the position a service
 * account granted at account level is in.
 *
 * An empty list is not an error here, but it is almost always the symptom of
 * one: the token is valid the moment the APIs are enabled, so "authenticates
 * fine, sees nothing" means the service-account email has not been added in GA
 * Admin -> Account Access Management.
 */
export async function listGa4Properties(): Promise<Ga4Property[]> {
  const bare: Omit<Ga4Property, 'timeZone' | 'domain'>[] = []
  let pageToken: string | undefined

  do {
    const url = new URL(`${ADMIN_API}/accountSummaries`)
    url.searchParams.set('pageSize', '200')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const json = (await ga4Fetch(url)) as {
      accountSummaries?: AccountSummary[]
      nextPageToken?: string
    }

    for (const account of json.accountSummaries ?? []) {
      // Both ids arrive prefixed ("accounts/123", "properties/456"); the bare
      // number is what the Data API path and our own primary key want.
      const accountId = stripPrefix(account.account, 'accounts/')
      for (const property of account.propertySummaries ?? []) {
        const propertyId = stripPrefix(property.property, 'properties/')
        if (!propertyId) continue
        bare.push({
          propertyId,
          displayName: property.displayName ?? propertyId,
          accountId,
          accountName: account.displayName ?? '',
        })
      }
    }

    pageToken = json.nextPageToken
  } while (pageToken)

  // accountSummaries carries no timezone and no stream URI, so each property
  // needs two more calls. Bounded, and a failure on either is non-fatal: a
  // property with an unknown domain is still worth reporting traffic for.
  return mapPool(bare, PROPERTY_CONCURRENCY, async (p) => {
    const [timeZone, domain] = await Promise.all([
      fetchPropertyTimeZone(p.propertyId).catch(() => null),
      fetchPropertyDomain(p.propertyId).catch(() => null),
    ])
    return { ...p, timeZone, domain }
  })
}

async function fetchPropertyTimeZone(propertyId: string): Promise<string | null> {
  const json = (await ga4Fetch(`${ADMIN_API}/properties/${propertyId}?fields=timeZone`)) as {
    timeZone?: string
  }
  return json.timeZone ?? null
}

/**
 * The property's site hostname, from its first web data stream.
 *
 * This is what lets a GA4 property line up with an audited site without a
 * hand-maintained map. `defaultUri` is a real, validated URL on every web
 * stream, unlike the display name — which is why the mapping is derived here
 * and not guessed from `displayName`.
 */
async function fetchPropertyDomain(propertyId: string): Promise<string | null> {
  const json = (await ga4Fetch(
    `${ADMIN_API}/properties/${propertyId}/dataStreams?pageSize=50`,
  )) as { dataStreams?: { webStreamData?: { defaultUri?: string } }[] }

  for (const stream of json.dataStreams ?? []) {
    const uri = stream.webStreamData?.defaultUri
    if (!uri) continue
    try {
      return new URL(uri).hostname.replace(/^www\./, '')
    } catch {
      // A malformed defaultUri is not worth failing discovery over.
    }
  }
  return null
}

function stripPrefix(value: string | undefined, prefix: string): string {
  if (!value) return ''
  return value.startsWith(prefix) ? value.slice(prefix.length) : value
}

/**
 * Daily rows for one property over an inclusive date range.
 *
 * `startDate`/`endDate` are either `YYYY-MM-DD` or one of GA's relative tokens
 * (`yesterday`, `NdaysAgo`). The ingest passes the relative form deliberately:
 * they are resolved by Google in the *property's* own timezone, so "yesterday"
 * means yesterday for that site's audience. Computing the dates here from the
 * server clock would silently shift AU and NZ properties onto a Sydney day.
 */
export async function runGa4DailyReport(
  propertyId: string,
  startDate: string,
  endDate: string,
): Promise<Ga4DailyRow[]> {
  const json = (await ga4Fetch(`${DATA_API}/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dimensions: [{ name: 'date' }],
      metrics: GA4_METRICS.map((name) => ({ name })),
      dateRanges: [{ startDate, endDate }],
      // One row per day: far below the cap, but an explicit limit beats the
      // API's default of 10,000 silently truncating a long backfill.
      limit: 100000,
      keepEmptyRows: false,
    }),
  })) as {
    rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[]
  }

  return (json.rows ?? []).flatMap((row) => {
    const date = isoDate(row.dimensionValues?.[0]?.value)
    if (!date) return []
    const v = (i: number) => num(row.metricValues?.[i]?.value)
    return [
      {
        propertyId,
        date,
        activeUsers: v(0),
        newUsers: v(1),
        sessions: v(2),
        engagedSessions: v(3),
        engagementRate: v(4),
        averageSessionDuration: v(5),
        screenPageViews: v(6),
      },
    ]
  })
}

/** The `date` dimension comes back as `YYYYMMDD` with no separators. */
function isoDate(raw: string | undefined): string | null {
  if (!raw || !/^\d{8}$/.test(raw)) return null
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
}

function num(raw: string | undefined): number {
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

/** One page's engagement, as GA4's own Pages and screens report frames it. */
export type Ga4PageRow = {
  pageTitle: string
  /** Host-relative, e.g. "/deals/round-the-world/". No query string. */
  pagePath: string
  screenPageViews: number
  activeUsers: number
  newUsers: number
  sessions: number
  engagedSessions: number
  /** Total seconds of engagement across all users, for deriving the average. */
  userEngagementDuration: number
}

/** Requested in this order; `runGa4PageReport` reads metricValues positionally. */
const PAGE_METRICS = [
  'screenPageViews',
  'activeUsers',
  'newUsers',
  'sessions',
  'engagedSessions',
  'userEngagementDuration',
] as const

/**
 * Top pages for one property, by views.
 *
 * Grouped by title *and* path. Title alone reads better but silently merges
 * any two pages sharing one — and without the path there is nothing to link to.
 * Pairing them splits those rows apart instead, at the cost of one page
 * appearing twice if its title changed mid-window.
 *
 * `pagePath`, not `pagePathPlusQueryString`: campaign and tracking parameters
 * would otherwise shatter one page into a dozen near-identical rows.
 *
 * Totals, not averages: an engagement rate or an average engagement time can
 * only be derived correctly from the totals over the window, so the rate-shaped
 * metrics are deliberately absent here and computed by the caller.
 * `averageSessionDuration` is absent for a different reason — it is
 * session-scoped, and pairing it with a page dimension produces a number that
 * looks meaningful and is not.
 */
export async function runGa4PageReport(
  propertyId: string,
  startDate: string,
  endDate: string,
  limit = 50,
  channel?: string,
): Promise<Ga4PageRow[]> {
  const json = (await ga4Fetch(`${DATA_API}/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dimensions: [{ name: 'pageTitle' }, { name: 'pagePath' }],
      metrics: PAGE_METRICS.map((name) => ({ name })),
      dateRanges: [{ startDate, endDate }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      // Session-scoped filter on a page-scoped report: GA keeps only the page
      // rows whose sessions came through that channel, which is exactly the
      // question being asked ("which pages does organic search land on").
      ...(channel ? { dimensionFilter: channelFilter(channel) } : {}),
      limit,
      keepEmptyRows: false,
    }),
  })) as {
    rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[]
  }

  return (json.rows ?? []).map((row) => {
    const v = (i: number) => num(row.metricValues?.[i]?.value)
    return {
      // "(not set)" is GA's own placeholder for a hit with no title.
      pageTitle: row.dimensionValues?.[0]?.value || '(not set)',
      pagePath: row.dimensionValues?.[1]?.value || '',
      screenPageViews: v(0),
      activeUsers: v(1),
      newUsers: v(2),
      sessions: v(3),
      engagedSessions: v(4),
      userEngagementDuration: v(5),
    }
  })
}

function channelFilter(channel: string) {
  return {
    filter: {
      fieldName: 'sessionDefaultChannelGroup',
      stringFilter: { matchType: 'EXACT', value: channel },
    },
  }
}

/** One channel's totals for the window, plus the window before it. */
export type Ga4ChannelRow = {
  channel: string
  activeUsers: number
  newUsers: number
  sessions: number
  engagedSessions: number
  screenPageViews: number
  userEngagementDuration: number
  prevActiveUsers: number
  prevSessions: number
}

/**
 * Sessions by GA4 default channel group, for the window and the one before it.
 *
 * Serves two jobs in one request: it is the list of channels the filter offers
 * — derived, so a property is never offered a channel it has no data for — and
 * it is the summary figures for whichever one is selected.
 *
 * Asking for two named date ranges makes GA append a `dateRange` dimension and
 * return a row per (channel, range), which is where the previous-period deltas
 * come from without a second round trip.
 */
export async function runGa4ChannelReport(
  propertyId: string,
  days: number,
): Promise<Ga4ChannelRow[]> {
  const json = (await ga4Fetch(`${DATA_API}/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: PAGE_METRICS.map((name) => ({ name })),
      dateRanges: [
        { startDate: `${days}daysAgo`, endDate: 'yesterday', name: 'current' },
        { startDate: `${days * 2}daysAgo`, endDate: `${days + 1}daysAgo`, name: 'previous' },
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 50,
      keepEmptyRows: false,
    }),
  })) as {
    rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[]
  }

  const byChannel = new Map<string, Ga4ChannelRow>()
  for (const row of json.rows ?? []) {
    const channel = row.dimensionValues?.[0]?.value
    // The appended dateRange dimension, carrying the names given above.
    const range = row.dimensionValues?.[1]?.value
    if (!channel) continue

    const existing = byChannel.get(channel) ?? {
      channel,
      activeUsers: 0,
      newUsers: 0,
      sessions: 0,
      engagedSessions: 0,
      screenPageViews: 0,
      userEngagementDuration: 0,
      prevActiveUsers: 0,
      prevSessions: 0,
    }
    const v = (i: number) => num(row.metricValues?.[i]?.value)

    if (range === 'previous') {
      existing.prevActiveUsers = v(1)
      existing.prevSessions = v(3)
    } else {
      existing.screenPageViews = v(0)
      existing.activeUsers = v(1)
      existing.newUsers = v(2)
      existing.sessions = v(3)
      existing.engagedSessions = v(4)
      existing.userEngagementDuration = v(5)
    }
    byChannel.set(channel, existing)
  }

  return [...byChannel.values()].sort((a, b) => b.sessions - a.sessions)
}

/** Property-wide figures for the window, and the window before it. */
export type Ga4SummaryRow = {
  sessions: number
  activeUsers: number
  engagedSessions: number
  screenPageViews: number
  keyEvents: number
  bounceRate: number
  viewsPerSession: number
  sessionsPerUser: number
}

const SUMMARY_METRICS = [
  'sessions',
  'activeUsers',
  'engagedSessions',
  'screenPageViews',
  'keyEvents',
  'bounceRate',
  'screenPageViewsPerSession',
  'sessionsPerUser',
] as const

/**
 * The summary-card figures, undimensioned, for the window and the one before.
 *
 * Undimensioned on purpose. Adding any dimension costs sessions GA cannot
 * attribute — the channel-split total is ~1.8% under the true one — so the
 * cards ask for the plain totals and leave the splitting to the chips.
 *
 * `bounceRate`, `screenPageViewsPerSession` and `sessionsPerUser` are asked for
 * rather than derived: GA computes them against its own user and session
 * counts, and deriving them from other metrics lands a few percent off what the
 * GA4 UI shows for the same range.
 */
export async function runGa4SummaryReport(
  propertyId: string,
  days: number,
  channel?: string,
): Promise<{ current: Ga4SummaryRow; previous: Ga4SummaryRow }> {
  const json = (await ga4Fetch(`${DATA_API}/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      metrics: SUMMARY_METRICS.map((name) => ({ name })),
      dateRanges: [
        { startDate: `${days}daysAgo`, endDate: 'yesterday', name: 'current' },
        { startDate: `${days * 2}daysAgo`, endDate: `${days + 1}daysAgo`, name: 'previous' },
      ],
      ...(channel ? { dimensionFilter: channelFilter(channel) } : {}),
    }),
  })) as {
    rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[]
  }

  const empty: Ga4SummaryRow = {
    sessions: 0,
    activeUsers: 0,
    engagedSessions: 0,
    screenPageViews: 0,
    keyEvents: 0,
    bounceRate: 0,
    viewsPerSession: 0,
    sessionsPerUser: 0,
  }
  const out = { current: { ...empty }, previous: { ...empty } }

  for (const row of json.rows ?? []) {
    // With two date ranges and no dimensions of our own, the only dimension is
    // the one GA appends, carrying the names given above.
    const which = row.dimensionValues?.[0]?.value === 'previous' ? 'previous' : 'current'
    const v = (i: number) => num(row.metricValues?.[i]?.value)
    out[which] = {
      sessions: v(0),
      activeUsers: v(1),
      engagedSessions: v(2),
      screenPageViews: v(3),
      keyEvents: v(4),
      bounceRate: v(5),
      viewsPerSession: v(6),
      sessionsPerUser: v(7),
    }
  }

  return out
}

/**
 * Filters to one page, and optionally one channel.
 *
 * `andGroup` because the two are independent questions — which page, and which
 * channel got there — and GA has no way to express both in a single filter.
 */
function pageFilter(pagePath: string, channel?: string) {
  const page = {
    filter: {
      fieldName: 'pagePath',
      stringFilter: { matchType: 'EXACT', value: pagePath },
    },
  }
  if (!channel) return page
  return { andGroup: { expressions: [page, channelFilter(channel)] } }
}

export type Ga4PageDetailRow = {
  screenPageViews: number
  activeUsers: number
  newUsers: number
  sessions: number
  engagedSessions: number
  userEngagementDuration: number
  keyEvents: number
}

const PAGE_DETAIL_METRICS = [
  'screenPageViews',
  'activeUsers',
  'newUsers',
  'sessions',
  'engagedSessions',
  'userEngagementDuration',
  'keyEvents',
] as const

function readDetail(values: { value?: string }[] | undefined): Ga4PageDetailRow {
  const v = (i: number) => num(values?.[i]?.value)
  return {
    screenPageViews: v(0),
    activeUsers: v(1),
    newUsers: v(2),
    sessions: v(3),
    engagedSessions: v(4),
    userEngagementDuration: v(5),
    keyEvents: v(6),
  }
}

/** One page's totals for the window and the one before it. */
export async function runGa4PageTotals(
  propertyId: string,
  days: number,
  pagePath: string,
  channel?: string,
): Promise<{ current: Ga4PageDetailRow; previous: Ga4PageDetailRow }> {
  const json = (await ga4Fetch(`${DATA_API}/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      metrics: PAGE_DETAIL_METRICS.map((name) => ({ name })),
      dateRanges: [
        { startDate: `${days}daysAgo`, endDate: 'yesterday', name: 'current' },
        { startDate: `${days * 2}daysAgo`, endDate: `${days + 1}daysAgo`, name: 'previous' },
      ],
      dimensionFilter: pageFilter(pagePath, channel),
    }),
  })) as {
    rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[]
  }

  const empty = readDetail(undefined)
  const out = { current: empty, previous: empty }
  for (const row of json.rows ?? []) {
    const which = row.dimensionValues?.[0]?.value === 'previous' ? 'previous' : 'current'
    out[which] = readDetail(row.metricValues)
  }
  return out
}

export type Ga4Breakdown = { label: string; views: number; activeUsers: number; sessions: number }

/**
 * One page, split by any dimension — channel, device, country, date.
 *
 * Generic because the four panels on the detail screen differ only in which
 * dimension they group by; four near-identical functions would be four places
 * to fix the same bug.
 */
export async function runGa4PageBreakdown(
  propertyId: string,
  days: number,
  pagePath: string,
  dimension: string,
  limit = 10,
  channel?: string,
): Promise<Ga4Breakdown[]> {
  const byDate = dimension === 'date'
  const json = (await ga4Fetch(`${DATA_API}/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dimensions: [{ name: dimension }],
      metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }, { name: 'sessions' }],
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'yesterday' }],
      dimensionFilter: pageFilter(pagePath, channel),
      // A trend reads in time order; every other split reads biggest first.
      orderBys: byDate
        ? [{ dimension: { dimensionName: 'date' } }]
        : [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit,
      keepEmptyRows: false,
    }),
  })) as {
    rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[]
  }

  return (json.rows ?? []).map((row) => {
    const raw = row.dimensionValues?.[0]?.value ?? ''
    const v = (i: number) => num(row.metricValues?.[i]?.value)
    return {
      label: byDate ? (isoDate(raw) ?? raw) : raw || '(not set)',
      views: v(0),
      activeUsers: v(1),
      sessions: v(2),
    }
  })
}

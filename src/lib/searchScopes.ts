import type { KbLink } from '@/lib/home'

export type SearchScopeKey = 'events' | 'news' | 'pages' | 'edms' | 'kb'

export type SearchResult = { title: string; sub: string; href: string; sortKey?: number; links?: KbLink[] }

const mediaUrl = (file: unknown): string | null => {
  const f = file as { url?: string } | null
  return f && typeof f === 'object' && f.url ? f.url : null
}

const dateFmt = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
const monthFmt = new Intl.DateTimeFormat('en-AU', { month: 'long' })

/** Title + description + location + category + a free-text date (e.g. "15 Aug", "August"). */
const eventSearchText = (d: any): string => {
  const date = new Date(d.date)
  const dateText = Number.isNaN(date.getTime()) ? '' : `${dateFmt.format(date)} ${monthFmt.format(date)}`
  const category = typeof d.category === 'object' ? d.category?.title : ''
  return [d.title, d.description, d.location, category, dateText].filter(Boolean).join(' ').toLowerCase()
}

/** Next occurrence of an event on/after today — mirrors the recurrence expansion in lib/homeData. */
export const nextOccurrence = (d: any): Date | null => {
  if (!d.date) return null
  const date = new Date(d.date)
  if (Number.isNaN(date.getTime())) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const stepMap: Record<string, { every: number; unit: string }> = {
    weekly: { every: 1, unit: 'weeks' },
    fortnightly: { every: 2, unit: 'weeks' },
    monthly: { every: 1, unit: 'months' },
    quarterly: { every: 3, unit: 'months' },
    biannually: { every: 6, unit: 'months' },
    annually: { every: 1, unit: 'years' },
  }
  const step =
    d.repeat === 'custom'
      ? { every: Math.max(1, d.repeatEvery ?? 1), unit: d.repeatFrequency ?? 'weeks' }
      : stepMap[d.repeat]
  if (!step) return date < today ? null : date // non-repeating: only occurrence, and it's passed

  for (let i = 0; date < today && i < 500; i++) {
    if (step.unit === 'days') date.setDate(date.getDate() + step.every)
    else if (step.unit === 'weeks') date.setDate(date.getDate() + step.every * 7)
    else if (step.unit === 'months') date.setMonth(date.getMonth() + step.every)
    else if (step.unit === 'years') date.setFullYear(date.getFullYear() + step.every)
    else break
  }
  return date
}

export const localDateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export type SearchScopeConfig = {
  label: string
  shortcut: string
  endpoint: (q: string) => string
  map: (d: any) => SearchResult
  /** Drop docs that aren't currently active (e.g. a past one-off event). Runs before `map`. */
  isActive?: (d: any) => boolean
  /** Client-side text match against the raw (unencoded) query, used instead of a server `where` filter. */
  matches?: (d: any, q: string) => boolean
}

/**
 * Live Payload-backed search, shared by the header quick-search and the Ctrl+K SearchModal.
 * Each entry fetches from its collection's REST API and maps a doc to a result the user can
 * follow straight to its real page.
 */
export const SEARCH_SCOPES: Record<SearchScopeKey, SearchScopeConfig> = {
  events: {
    label: 'Events',
    shortcut: 'E',
    // No server-side text filter: title/description/category/day-or-month text are all matched client-side (below).
    endpoint: () => `/api/events?limit=100&depth=1&sort=date`,
    // Only events with a future (or today's) occurrence — nextOccurrence returns null for a past one-off event.
    isActive: (d) => nextOccurrence(d) !== null,
    matches: (d, q) => eventSearchText(d).includes(q.toLowerCase()),
    map: (d) => {
      const next = nextOccurrence(d)
      return {
        title: d.title,
        sub: [d.location, next ? dateFmt.format(next) : null].filter(Boolean).join(' · ') || 'Event',
        href: next ? `/calendar?date=${localDateKey(next)}` : '/calendar',
        sortKey: next?.getTime(),
      }
    },
  },
  news: {
    label: 'News',
    shortcut: 'B',
    endpoint: (q) =>
      `/api/posts?where[or][0][title][like]=${q}&where[or][1][meta.description][like]=${q}&where[_status][equals]=published&limit=8&depth=0&sort=-publishedAt`,
    map: (d) => ({ title: d.title, sub: 'Post', href: `/posts/${d.slug}` }),
  },
  pages: {
    label: 'Pages',
    shortcut: 'P',
    endpoint: (q) =>
      `/api/pages?where[or][0][title][like]=${q}&where[or][1][meta.description][like]=${q}&where[_status][equals]=published&limit=8&depth=0`,
    map: (d) => ({ title: d.title, sub: 'Page', href: `/${d.slug}` }),
  },
  edms: {
    label: 'EDMs',
    shortcut: 'M',
    endpoint: (q) =>
      `/api/edms?where[or][0][title][like]=${q}&where[or][1][description][like]=${q}&where[or][2][category.title][like]=${q}&limit=8&depth=1&sort=-dateSent`,
    map: (d) => ({
      title: d.title,
      sub: (typeof d.category === 'object' ? d.category?.title : d.category) ?? 'EDM',
      href: d.url,
    }),
  },
  kb: {
    label: 'Knowledge Base',
    shortcut: 'K',
    endpoint: (q) =>
      `/api/knowledge-base?where[or][0][title][like]=${q}&where[or][1][description][like]=${q}&where[or][2][category.title][like]=${q}&limit=8&depth=1`,
    map: (d) => {
      const absolute = (url: string): string => (/^https?:\/\//i.test(url) ? url : `https://${url}`)
      const links: KbLink[] = (d.links ?? []).map((l: any) => ({
        label: l.label ?? null,
        url: absolute(l.url),
      }))
      return {
        title: d.title,
        sub: (typeof d.category === 'object' ? d.category?.title : d.category) ?? 'Document',
        href: mediaUrl(d.file) ?? links[0]?.url ?? '#',
        links,
      }
    },
  },
}

export const SEARCH_SCOPE_ORDER: SearchScopeKey[] = ['news', 'pages', 'events', 'edms', 'kb']

/** Fetch + filter + map a single scope's results for a raw (unencoded, trimmed) query. */
export async function fetchScopeResults(
  scope: SearchScopeKey,
  q: string,
  opts: { signal?: AbortSignal } = {},
): Promise<SearchResult[]> {
  const config = SEARCH_SCOPES[scope]
  const res = await fetch(config.endpoint(encodeURIComponent(q)), {
    signal: opts.signal,
    credentials: 'same-origin',
  })
  if (!res.ok) return []
  const data = await res.json()
  let docs = data.docs ?? []
  if (config.isActive) docs = docs.filter(config.isActive)
  if (config.matches) docs = docs.filter((d: any) => config.matches!(d, q))
  return docs.map(config.map)
}

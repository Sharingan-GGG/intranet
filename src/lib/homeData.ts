import { getPayload } from 'payload'
import configPromise from '@payload-config'

import type { Category, Media, Post } from '@/payload-types'
import {
  DOCUMENTS,
  EDMS,
  EVENT_GROUPS,
  FEATURED_NEWS,
  NEWS,
  OFFICES,
  QUICK_LINKS,
  type CalendarEvent,
  type DocExt,
  type EdmCard,
  type EventGroup,
  type EventTag,
  type KbDoc,
  type NewsCard,
  type OfficeZone,
  type QuickLink,
} from './home'

/**
 * Fetch helpers for the intranet landing page.
 *
 * Each helper reads its Payload collection and maps documents to the view
 * types in `lib/home.ts`. While a collection is still empty, the helper falls
 * back to the design's sample content so the page never renders bare.
 */

const mediaUrl = (media?: Media | number | null): string | null =>
  media && typeof media === 'object' && media.url ? media.url : null

/** Gradient placeholders standing in for post images (posts carry no media). */
const GRADIENTS = [
  'linear-gradient(135deg,var(--il-brand),var(--il-accent))',
  'linear-gradient(135deg,var(--il-brand-hover),var(--il-accent))',
  'linear-gradient(135deg,var(--il-accent),var(--il-brand-hover))',
  'linear-gradient(135deg,var(--il-brand),var(--il-brand-hover))',
  'linear-gradient(135deg,var(--il-accent),var(--il-brand))',
  'linear-gradient(135deg,var(--il-brand-hover),var(--il-brand))',
]
const gradient = (i: number): string => GRADIENTS[i % GRADIENTS.length]

/** First populated category title on a post, used as the card kicker/header. */
const categoryKicker = (post: Post, fallback: string): string => {
  const first = post.categories?.find((c): c is Category => typeof c === 'object' && c !== null)
  return first?.title ?? fallback
}

/** Pull the first paragraph of plain text out of a Lexical rich-text tree. */
const richTextExcerpt = (content: Post['content'], max = 180): string => {
  const root = (content as { root?: { children?: unknown[] } } | null | undefined)?.root
  if (!root?.children) return ''

  const collect = (node: unknown): string => {
    const n = node as { type?: string; text?: string; children?: unknown[] }
    if (n?.type === 'text' && typeof n.text === 'string') return n.text
    if (Array.isArray(n?.children)) return n.children.map(collect).join('')
    return ''
  }

  const truncate = (text: string): string =>
    text.length > max ? `${text.slice(0, max).trimEnd()}…` : text

  for (const block of root.children) {
    if ((block as { type?: string })?.type === 'paragraph') {
      const text = collect(block).trim()
      if (text) return truncate(text)
    }
  }
  return truncate(collect(root).trim())
}

/** Post excerpt: prefer the SEO meta description, fall back to the body's first paragraph. */
const postExcerpt = (post: Post): string => post.meta?.description || richTextExcerpt(post.content)

/** Resolve a category id from its slug, or null if it doesn't exist. */
async function categoryIdBySlug(
  payload: Awaited<ReturnType<typeof getPayload>>,
  slug: string,
): Promise<number | null> {
  const { docs } = await payload.find({
    collection: 'categories',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
  })
  return (docs[0]?.id as number | undefined) ?? null
}

const dayMonthYear = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** Map a post to the news-card view type used by the homepage and /posts. */
export const postToNewsCard = (d: Post, i: number): NewsCard => ({
  kicker: categoryKicker(d, 'News'),
  title: d.title,
  excerpt: postExcerpt(d),
  date: d.publishedAt ? dayMonthYear.format(new Date(d.publishedAt)) : '',
  img: gradient(i),
  imageUrl: mediaUrl(d.heroImage),
  href: `/posts/${d.slug}`,
  featured: Boolean(d.featured),
})

/** Latest CTG news — posts in the `News` category. */
export async function getNews(): Promise<NewsCard[]> {
  const payload = await getPayload({ config: configPromise })
  const catId = await categoryIdBySlug(payload, 'news')
  if (catId === null) return NEWS

  const { docs } = await payload.find({
    collection: 'posts',
    where: { categories: { in: [catId] } },
    sort: '-publishedAt',
    limit: 12,
    depth: 1,
  })
  if (docs.length === 0) return NEWS

  return docs.map(postToNewsCard)
}

/** All sub-categories of the parent `EDMs` category — the tabs in the Latest EDMs section. */
export async function getEdmCategories(): Promise<string[]> {
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: 'categories',
    where: { 'parent.slug': { equals: 'edms' } },
    sort: 'order',
    limit: 50,
    depth: 0,
  })
  return docs.map((d) => d.title)
}

/** Latest EDMs — docs in the `edms` collection; kicker is the EDM sub-category. */
export async function getEdms(): Promise<EdmCard[]> {
  const payload = await getPayload({ config: configPromise })

  const { docs } = await payload.find({
    collection: 'edms',
    sort: '-createdAt',
    limit: 24,
    depth: 1,
  })
  if (docs.length === 0) return EDMS

  return docs.map((d, i) => {
    const category = typeof d.category === 'object' && d.category ? d.category.title : 'EDMs'
    return {
      kicker: category,
      title: d.title,
      sent: dayMonthYear.format(new Date(d.createdAt)),
      description: d.description ?? null,
      img: gradient(i),
      imageUrl: mediaUrl(d.image),
      href: d.url,
    }
  })
}

/** Featured spotlight — posts with the `featured` checkbox ticked, newest first. */
export async function getFeaturedNews(): Promise<NewsCard[]> {
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: 'posts',
    where: { featured: { equals: true } },
    sort: '-publishedAt',
    limit: 6,
    depth: 1,
  })
  if (docs.length === 0) return FEATURED_NEWS

  return docs.map((d, i) => ({
    kicker: categoryKicker(d, 'Company'),
    title: d.title,
    excerpt: postExcerpt(d),
    date: d.publishedAt ? dayMonthYear.format(new Date(d.publishedAt)) : '',
    img: gradient(i),
    imageUrl: mediaUrl(d.heroImage),
    href: `/posts/${d.slug}`,
    featured: true,
  }))
}

export async function getQuickLinks(): Promise<QuickLink[]> {
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: 'quick-links',
    sort: 'order',
    limit: 24,
    depth: 1,
  })

  if (docs.length === 0) return QUICK_LINKS

  return docs.map((d) => ({
    label: d.label,
    href: d.link,
    icon: mediaUrl(d.image) ?? '/ctg-icon.png',
  }))
}

export async function getOffices(): Promise<OfficeZone[]> {
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: 'time-zones',
    sort: 'order',
    pagination: false,
  })

  if (docs.length === 0) return OFFICES

  return docs.map((d) => ({ city: d.label, tz: d.timezone }))
}

/** All sub-categories of the parent `Knowledge Base` category — the tabs in the KB section. */
export async function getKbCategories(): Promise<string[]> {
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: 'categories',
    where: { 'parent.slug': { equals: 'knowledge-base' } },
    sort: 'order',
    limit: 50,
    depth: 0,
  })
  return docs.map((d) => d.title)
}

export async function getKbDocs(): Promise<KbDoc[]> {
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: 'knowledge-base',
    sort: '-updatedAt',
    limit: 100,
    depth: 1,
  })

  if (docs.length === 0) return DOCUMENTS

  const dayMonth = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' })

  // Older records were saved without a protocol, which the browser treats as a relative path.
  const absolute = (url: string): string => (/^https?:\/\//i.test(url) ? url : `https://${url}`)

  return docs.map((d) => {
    const links = (d.links ?? []).map((l) => ({ label: l.label ?? null, url: absolute(l.url) }))
    return {
      title: d.title,
      description: d.description ?? undefined,
      ext: d.fileType as DocExt,
      category: typeof d.category === 'object' && d.category ? d.category.title : String(d.category),
      updated: dayMonth.format(new Date(d.updatedAt)),
      href: mediaUrl(d.file) ?? links[0]?.url ?? '#',
      links,
    }
  })
}

/** Event `time` is stored as an ISO datetime (time-only picker); older records may hold free text. */
const formatEventTime = (time: string | null | undefined): string => {
  if (!time) return 'All day'
  const parsed = new Date(time)
  if (Number.isNaN(parsed.getTime())) return time
  return new Intl.DateTimeFormat('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Australia/Adelaide',
  }).format(parsed)
}

type EventDoc = {
  date: string
  endDate?: string | null
  isMultiDay?: boolean | null
  repeat?: string | null
  repeatEvery?: number | null
  repeatFrequency?: string | null
}

/** Title of an event's populated category relationship, used as its display tag. */
const eventTag = (category: number | Category): EventTag =>
  typeof category === 'object' && category !== null ? category.title : String(category)

/** Extra whole days a multi-day event spans beyond its start (0 = single day). Capped at a year. */
const spanDays = (doc: EventDoc): number => {
  if (!doc.isMultiDay || !doc.endDate) return 0
  const start = new Date(doc.date)
  const end = new Date(doc.endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000)
  return diff > 0 ? Math.min(diff, 365) : 0
}

/** Start date of each occurrence (repeat expansion), NOT including any multi-day span. */
const occurrenceStarts = (doc: EventDoc, horizon: Date): string[] => {
  const start = new Date(doc.date)
  const repeat = doc.repeat ?? 'none'
  if (repeat === 'none' || Number.isNaN(start.getTime())) return [doc.date]

  const stepMap: Record<string, { every: number; unit: string }> = {
    weekly: { every: 1, unit: 'weeks' },
    fortnightly: { every: 2, unit: 'weeks' },
    monthly: { every: 1, unit: 'months' },
    quarterly: { every: 3, unit: 'months' },
    biannually: { every: 6, unit: 'months' },
    annually: { every: 1, unit: 'years' },
  }
  const step =
    repeat === 'custom'
      ? { every: Math.max(1, doc.repeatEvery ?? 1), unit: doc.repeatFrequency ?? 'weeks' }
      : stepMap[repeat]
  if (!step) return [doc.date]

  const dates: string[] = []
  const cursor = new Date(start)
  for (let i = 0; cursor <= horizon && i < 200; i++) {
    dates.push(cursor.toISOString())
    switch (step.unit) {
      case 'days':
        cursor.setDate(cursor.getDate() + step.every)
        break
      case 'weeks':
        cursor.setDate(cursor.getDate() + step.every * 7)
        break
      case 'months':
        cursor.setMonth(cursor.getMonth() + step.every)
        break
      case 'years':
        cursor.setFullYear(cursor.getFullYear() + step.every)
        break
      default:
        return dates
    }
  }
  return dates
}

/**
 * Every calendar day an event touches: each occurrence start (from repeat
 * expansion) expanded across its multi-day span. A single, non-repeating event
 * yields just its own date; a 3-day event yields three consecutive days.
 */
const expandOccurrences = (doc: EventDoc, horizon: Date): string[] => {
  const span = spanDays(doc)
  if (span === 0) return occurrenceStarts(doc, horizon)

  const out: string[] = []
  for (const startISO of occurrenceStarts(doc, horizon)) {
    const base = new Date(startISO)
    if (Number.isNaN(base.getTime())) {
      out.push(startISO)
      continue
    }
    for (let d = 0; d <= span; d++) {
      const day = new Date(base)
      day.setDate(day.getDate() + d)
      out.push(day.toISOString())
    }
  }
  return out
}

/** Repeating events expand up to a year ahead. */
const recurrenceHorizon = (): Date => {
  const h = new Date()
  h.setFullYear(h.getFullYear() + 1)
  return h
}

export async function getEventGroups(): Promise<EventGroup[]> {
  const payload = await getPayload({ config: configPromise })

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  // Recurring events may have a start date in the past but still produce upcoming occurrences.
  const { docs } = await payload.find({
    collection: 'events',
    where: {
      or: [
        { date: { greater_than_equal: startOfToday.toISOString() } },
        { and: [{ repeat: { exists: true } }, { repeat: { not_equals: 'none' } }] },
      ],
    },
    sort: 'date',
    limit: 200,
    pagination: false,
  })

  if (docs.length === 0) return EVENT_GROUPS

  const horizon = recurrenceHorizon()
  // Homepage upcoming list shows a multi-day event once (on its start day), so
  // use occurrence starts rather than the full per-day span (which the calendar uses).
  const occurrences = docs
    .flatMap((d) => occurrenceStarts(d, horizon).map((dateISO) => ({ doc: d, dateISO })))
    .filter((o) => new Date(o.dateISO) >= startOfToday)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO))
    .slice(0, 50)

  const dayMonth = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short' })

  const groups: EventGroup[] = []
  for (const { doc: d, dateISO } of occurrences) {
    const date = new Date(dateISO)
    const day = String(date.getDate())
    const mon = new Intl.DateTimeFormat('en-AU', { month: 'short' }).format(date)
    // Multi-day events show their end date ("until 9 Aug") alongside the start.
    const span = spanDays(d)
    let endLabel: string | undefined
    if (span > 0) {
      const end = new Date(date)
      end.setDate(end.getDate() + span)
      endLabel = dayMonth.format(end)
    }
    const item = {
      title: d.title,
      tag: eventTag(d.category),
      time: formatEventTime(d.time),
      timeISO: d.time ?? null,
      loc: d.location ?? '—',
      endLabel,
      slug: d.slug ?? undefined,
    }

    const last = groups[groups.length - 1]
    if (last && last.day === day && last.mon === mon) {
      last.items.push(item)
    } else {
      groups.push({ day, mon, items: [item], dateISO })
    }
  }
  return groups
}

/** All events (past and future) for the full-page calendar. */
export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  const payload = await getPayload({ config: configPromise })

  const { docs } = await payload.find({
    collection: 'events',
    sort: 'date',
    limit: 500,
    pagination: false,
  })

  const horizon = recurrenceHorizon()
  return docs
    .flatMap((d) =>
      expandOccurrences(d, horizon).map((dateISO) => ({
        title: d.title,
        tag: eventTag(d.category),
        time: formatEventTime(d.time),
        timeISO: d.time ?? null,
        loc: d.location ?? '—',
        description: d.description ?? null,
        dateISO,
        slug: d.slug ?? undefined,
      })),
    )
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO))
}

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
  'linear-gradient(135deg,#112E81,#4382DF)',
  'linear-gradient(135deg,#4647AE,#AACCD6)',
  'linear-gradient(135deg,#2E66B8,#4647AE)',
  'linear-gradient(135deg,#112E81,#4647AE)',
  'linear-gradient(135deg,#4382DF,#AACCD6)',
  'linear-gradient(135deg,#4647AE,#112E81)',
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

  return docs.map((d, i) => ({
    kicker: categoryKicker(d, 'News'),
    title: d.title,
    excerpt: postExcerpt(d),
    date: d.publishedAt ? dayMonthYear.format(new Date(d.publishedAt)) : '',
    img: gradient(i),
    imageUrl: mediaUrl(d.heroImage),
    href: `/posts/${d.slug}`,
    featured: Boolean(d.featured),
  }))
}

/** Latest EDMs — posts in the `EDMs` category. */
export async function getEdms(): Promise<EdmCard[]> {
  const payload = await getPayload({ config: configPromise })
  const catId = await categoryIdBySlug(payload, 'edms')
  if (catId === null) return EDMS

  const { docs } = await payload.find({
    collection: 'posts',
    where: { categories: { in: [catId] } },
    sort: '-publishedAt',
    limit: 12,
    depth: 1,
  })
  if (docs.length === 0) return EDMS

  return docs.map((d, i) => ({
    kicker: categoryKicker(d, 'EDMs'),
    title: d.title,
    sent: d.publishedAt ? dayMonthYear.format(new Date(d.publishedAt)) : '',
    img: gradient(i),
    imageUrl: mediaUrl(d.heroImage),
    href: `/posts/${d.slug}`,
  }))
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

  return docs.map((d) => ({
    title: d.title,
    description: d.description ?? undefined,
    ext: d.fileType as DocExt,
    category: d.category,
    updated: dayMonth.format(new Date(d.updatedAt)),
    href: mediaUrl(d.file) ?? d.link ?? '#',
  }))
}

export async function getEventGroups(): Promise<EventGroup[]> {
  const payload = await getPayload({ config: configPromise })

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const { docs } = await payload.find({
    collection: 'events',
    where: { date: { greater_than_equal: startOfToday.toISOString() } },
    sort: 'date',
    limit: 50,
  })

  if (docs.length === 0) return EVENT_GROUPS

  const groups: EventGroup[] = []
  for (const d of docs) {
    const date = new Date(d.date)
    const day = String(date.getDate())
    const mon = new Intl.DateTimeFormat('en-AU', { month: 'short' }).format(date)
    const item = {
      title: d.title,
      tag: d.category as EventTag,
      time: d.time ?? 'All day',
      loc: d.location ?? '—',
      slug: d.slug ?? undefined,
    }

    const last = groups[groups.length - 1]
    if (last && last.day === day && last.mon === mon) {
      last.items.push(item)
    } else {
      groups.push({ day, mon, items: [item], dateISO: d.date })
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

  return docs.map((d) => ({
    title: d.title,
    tag: d.category as EventTag,
    time: d.time ?? 'All day',
    loc: d.location ?? '—',
    description: d.description ?? null,
    dateISO: d.date,
    slug: d.slug ?? undefined,
  }))
}

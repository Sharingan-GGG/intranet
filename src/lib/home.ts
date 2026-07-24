/**
 * Sample content for the intranet landing page (design option 1a).
 *
 * This mirrors the approved design's placeholder data in one typed module.
 * When the corresponding Payload collections (News, EDMs, Events, Documents)
 * and globals (siteSettings, quick links) are modelled, replace these exports
 * with typed `lib/payload.ts` fetch helpers.
 */

export type QuickLink = {
  label: string
  href: string
  /** Icon URL — provider favicon or a local asset. */
  icon: string
}

export type DocExt = 'PDF' | 'XLS' | 'DOC' | 'Folder'

export type KbLink = {
  label?: string | null
  url: string
}

export type KbDoc = {
  title: string
  description?: string
  ext: DocExt
  category: string
  updated: string
  href: string
  /** External links; when there is more than one, the UI opens a pop-up listing them. */
  links?: KbLink[]
}

/** Event category title — sub-categories of the "Events" parent category in the CMS. */
export type EventTag = string

export type EventItem = {
  title: string
  tag: EventTag
  /** Adelaide-formatted fallback, e.g. for the pre-hydration render. */
  time: string
  /** Raw start instant; the UI reformats this into the viewer's local timezone once mounted. */
  timeISO?: string | null
  loc: string
  /** Formatted end date (e.g. "9 Aug") for multi-day events; absent for single-day. */
  endLabel?: string
  /** Slug linking to the event's detail page, when sourced from the CMS. */
  slug?: string
}

export type EventGroup = {
  day: string
  mon: string
  items: EventItem[]
  /** ISO date of the group's day, for linking to the calendar. */
  dateISO?: string
}

/** Full event record for the /calendar page — keeps the real date. */
export type CalendarEvent = {
  title: string
  tag: EventTag
  /** Adelaide-formatted fallback, e.g. for the pre-hydration render. */
  time: string
  /** Raw start instant; the UI reformats this into the viewer's local timezone once mounted. */
  timeISO?: string | null
  loc: string
  description: string | null
  /** ISO date string, e.g. "2026-07-17T00:00:00.000Z". */
  dateISO: string
  /** Slug linking to the event's detail page, when sourced from the CMS. */
  slug?: string
}

export type NewsCard = {
  kicker: string
  title: string
  excerpt: string
  date: string
  /** Gradient fallback used when no `imageUrl` is available. */
  img: string
  /** CMS hero image URL, used as a background image when present. */
  imageUrl?: string | null
  /** Link to the full post; falls back to the news section anchor. */
  href?: string
  featured?: boolean
}

export type EdmCard = {
  /** Sub-category title — also drives the tab filter in the Latest EDMs section. */
  kicker: string
  title: string
  sent: string
  description?: string | null
  img: string
  /** CMS hero image URL, used as a background image when present. */
  imageUrl?: string | null
  href: string
}

export type OfficeZone = {
  city: string
  /** IANA timezone — DST-safe via Intl.DateTimeFormat. */
  tz: string
}

/** File-type tile tints: [background, foreground]. */
export const EXT_STYLE: Record<DocExt, [string, string]> = {
  PDF: ['#FBEAEA', '#B4443C'],
  XLS: ['#E8F3EC', '#1F8A5B'],
  DOC: ['#EAF1FB', '#2E66B8'],
  Folder: ['#FDF3E3', '#B07B24'],
}

/** Event category tag tints: [background, foreground]. */
export const TAG_STYLE: Record<string, [string, string]> = {
  People: ['#EEEDF8', '#4647AE'],
  Training: ['#E8F2FB', '#2E66B8'],
  Company: ['#EAF1FB', '#112E81'],
  Social: ['#E8F3EC', '#1F8A5B'],
}

/** Tint for an event tag, with a neutral fallback for categories without a defined colour. */
export const tagStyle = (tag: EventTag): [string, string] =>
  TAG_STYLE[tag] ?? ['#EEF1F6', '#5A6478']

/** Search-result type badge tints: [foreground, background]. */
export const SEARCH_TINT: Record<'News' | 'Doc' | 'Event', [string, string]> = {
  News: ['#4647AE', '#EEEDF8'],
  Doc: ['#2E66B8', '#EAF1FB'],
  Event: ['#1F8A5B', '#E8F3EC'],
}

const fav = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`

export const QUICK_LINKS: QuickLink[] = [
  { label: 'Gmail', href: 'https://mail.google.com', icon: fav('gmail.com') },
  { label: 'Zoho', href: 'https://zoho.com', icon: fav('zoho.com') },
  { label: 'Sabre', href: 'https://sabre.com', icon: fav('sabre.com') },
  { label: 'Tramada', href: 'https://tramada.com', icon: fav('tramada.com') },
  { label: 'RingCentral', href: 'https://ringcentral.com', icon: fav('ringcentral.com') },
  { label: 'Xero', href: 'https://xero.com', icon: fav('xero.com') },
  { label: 'Seat Scanner', href: 'https://seatscanner.com.au', icon: fav('seatscanner.com.au') },
  { label: 'Okta', href: 'https://okta.com', icon: fav('okta.com') },
  { label: 'CTG Whereabouts', href: '#', icon: '/ctg-icon.png' },
]

export const OFFICES: OfficeZone[] = [
  { city: 'Adelaide', tz: 'Australia/Adelaide' },
  { city: 'Perth', tz: 'Australia/Perth' },
  { city: 'Melbourne', tz: 'Australia/Melbourne' },
  { city: 'Auckland', tz: 'Pacific/Auckland' },
]

export const DOCUMENTS: KbDoc[] = [
  { title: 'Travel Policy 2026', ext: 'PDF', category: 'Policies', updated: '2 Jul', href: '#' },
  { title: 'Expense Claim Template', ext: 'XLS', category: 'Finance', updated: '28 Jun', href: '#' },
  { title: 'New Client Onboarding Checklist', ext: 'DOC', category: 'Operations', updated: '24 Jun', href: '#' },
  { title: 'After-Hours Support Runbook', ext: 'PDF', category: 'Operations', updated: '19 Jun', href: '#' },
  { title: 'CTG Brand Guidelines v4', ext: 'PDF', category: 'Marketing', updated: '11 Jun', href: '#' },
  { title: 'Leave Request Form', ext: 'PDF', category: 'People', updated: '3 Jun', href: '#' },
  { title: 'Client Fee Schedule 2026', ext: 'XLS', category: 'Finance', updated: '30 Jun', href: '#' },
  { title: 'Airline Contact Cheat Sheet', ext: 'PDF', category: 'Operations', updated: '22 Jun', href: '#' },
  { title: 'Client Email Style Guide', ext: 'DOC', category: 'Marketing', updated: '17 Jun', href: '#' },
  { title: 'Visa & Passport Quick Reference', ext: 'PDF', category: 'Operations', updated: '12 Jun', href: '#' },
  { title: 'Supplier Commission Matrix', ext: 'XLS', category: 'Finance', updated: '6 Jun', href: '#' },
  { title: 'WHS Incident Report Form', ext: 'PDF', category: 'People', updated: '1 Jun', href: '#' },
]

export const KB_CATEGORIES = ['All', 'Policies', 'Finance', 'Operations', 'Marketing', 'People'] as const

export const EVENT_GROUPS: EventGroup[] = [
  {
    day: '13',
    mon: 'Jul',
    items: [{ title: 'New hire orientation', tag: 'People', time: '9:00–11:00 AM', loc: 'Adelaide HQ, Boardroom' }],
  },
  {
    day: '14',
    mon: 'Jul',
    items: [
      { title: 'Sabre refresher training', tag: 'Training', time: '2:00–3:00 PM', loc: 'Online · Teams' },
      { title: 'Payroll cut-off reminder', tag: 'Company', time: 'All day', loc: '—' },
    ],
  },
  {
    day: '16',
    mon: 'Jul',
    items: [{ title: 'All-hands town hall', tag: 'Company', time: '11:00 AM–12:00 PM', loc: 'Online · Teams' }],
  },
  {
    day: '24',
    mon: 'Jul',
    items: [{ title: 'End-of-month social — lawn bowls', tag: 'Social', time: '4:30 PM', loc: 'Melbourne office' }],
  },
]

// Thumbnail placeholders use the scheme's signature band gradient (navy → blue → green in Ocean).
const IMGS = [
  'var(--il-grad-band)',
  'var(--il-grad-band)',
  'var(--il-grad-band)',
  'var(--il-grad-band)',
  'var(--il-grad-band)',
  'var(--il-grad-band)',
]

export const NEWS: NewsCard[] = [
  {
    kicker: 'Company',
    title: 'CTG named Top Corporate Travel Partner at the 2026 NTIA awards',
    excerpt: 'A huge night for the whole team — photos and full wrap-up inside.',
    date: '8 Jul 2026',
    img: IMGS[0],
    featured: true,
  },
  {
    kicker: 'Systems',
    title: 'Sabre Red 360 upgrade lands next Tuesday',
    excerpt: 'What changes, what stays the same, and the 10-minute prep every consultant should do.',
    date: '7 Jul 2026',
    img: IMGS[1],
  },
  {
    kicker: 'People',
    title: 'Welcome our new Auckland crew',
    excerpt: 'Three new consultants join the NZ team this month — say kia ora.',
    date: '3 Jul 2026',
    img: IMGS[2],
  },
  {
    kicker: 'Clients',
    title: 'Q1 wins: three new corporate accounts signed',
    excerpt: 'Mining, health and professional services — here is who is joining the CTG family.',
    date: '1 Jul 2026',
    img: IMGS[3],
  },
  {
    kicker: 'Operations',
    title: 'New after-hours support roster now live',
    excerpt: 'Check your rotation and the updated escalation path in the runbook.',
    date: '27 Jun 2026',
    img: IMGS[4],
  },
  {
    kicker: 'Tips',
    title: 'Tramada tips: five shortcuts you are probably not using',
    excerpt: 'Small keystrokes, big minutes saved. Number four is a crowd favourite.',
    date: '24 Jun 2026',
    img: IMGS[5],
  },
]

/** Featured spotlight rotates through news flagged `featured`. */
export const FEATURED_NEWS: NewsCard[] = NEWS.filter((n) => n.featured)

export const EDMS: EdmCard[] = [
  { title: 'July client newsletter', kicker: 'Newsletter', sent: '5 Jul 2026', img: IMGS[0], href: '#' },
  { title: 'EOFY travel deals wrap-up', kicker: 'Campaign', sent: '26 Jun 2026', img: IMGS[1], href: '#' },
  { title: 'Airline update — Qantas network changes', kicker: 'Airline update', sent: '18 Jun 2026', img: IMGS[2], href: '#' },
  { title: 'Winter escapes campaign', kicker: 'Campaign', sent: '10 Jun 2026', img: IMGS[3], href: '#' },
  { title: 'June client newsletter', kicker: 'Newsletter', sent: '2 Jun 2026', img: IMGS[4], href: '#' },
]

/** Combined pool for the header typeahead. */
export type SearchDoc = { type: 'News' | 'Doc' | 'Event'; title: string; href: string }

export const SEARCH_POOL: SearchDoc[] = [
  ...NEWS.map((n) => ({ type: 'News' as const, title: n.title, href: '/#news' })),
  ...DOCUMENTS.map((d) => ({ type: 'Doc' as const, title: d.title, href: d.href })),
  ...EVENT_GROUPS.flatMap((g) => g.items.map((ev) => ({ type: 'Event' as const, title: ev.title, href: '/#calendar' }))),
]

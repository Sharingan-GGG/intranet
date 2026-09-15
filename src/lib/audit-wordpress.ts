import 'server-only'

/**
 * WordPress REST fetch layer for the Audit Hub.
 *
 * All configured sites expose posts/pages/deals publicly (no auth) including
 * `aioseo_meta_data`. The standalone portal called these APIs from the browser
 * and kept its own per-session `Map` cache; here the calls happen on the server
 * and Next's Data Cache does the caching, so a tab or domain switch is a cache
 * hit across every user rather than per browser tab.
 *
 * Paginates via X-WP-TotalPages — page 1 first for the count, then the rest in
 * bounded parallel.
 */
import { WP_PER_PAGE, type Site } from './audit-config'
import type { CompletedRow, ContentType, TypeCounts, WpItem } from './audit-types'

const TYPE_TO_REST: Record<ContentType, string> = {
  post: 'posts',
  page: 'pages',
  // Custom post type — 404s on sites without it, treated as empty.
  deal: 'deal',
}

/**
 * `_fields` takes dotted paths, and normalize() reads exactly one thing out of
 * AIOSEO's meta: keyphrases.focus. Asking for the whole aioseo_meta_data object
 * instead pulls ~58 keys per item (schema, every `og_*` and `twitter_*`, an `ai` blob) —
 * 1.2 MB per page of 100 against 46 KB for this.
 */
const FIELDS = 'id,link,date,modified_gmt,title,aioseo_meta_data.keyphrases.focus'

/** In-flight page requests per type — WordPress gets 5 at a time, not one per page. */
const PAGE_CONCURRENCY = 5

/**
 * How long a WordPress read stays fresh. Editors publish throughout the day but
 * the Audit Hub is a triage tool, not a live view of the CMS, so fifteen minutes
 * keeps a dashboard load off the origin without anyone noticing staleness.
 */
const REVALIDATE_SECONDS = 900

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
}

/**
 * Decode the entities WordPress puts in `title.rendered`.
 *
 * The browser build did this by assigning to a detached `<textarea>`'s
 * innerHTML, which has no server equivalent. Titles here are a closed set —
 * numeric references plus the handful of named ones above, overwhelmingly
 * `&amp;` and the curly quotes — so a small table beats pulling in a dependency
 * to decode the full HTML5 entity list. `&amp;` is resolved last so that
 * double-encoded titles ("&amp;#8217;") come out right.
 */
function decodeEntities(html: string): string {
  return html
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match)
}

function normalize(item: WpItem, type: ContentType): CompletedRow {
  const focus = item.aioseo_meta_data?.keyphrases?.focus ?? null
  let path: string
  try {
    path = new URL(item.link).pathname
  } catch {
    path = item.link
  }
  return {
    id: item.id,
    title: decodeEntities(item.title?.rendered ?? '').trim() || `#${item.id}`,
    url: item.link,
    path,
    type,
    keywordScore: typeof focus?.score === 'number' ? Math.round(focus.score) : null,
    keyphrase: focus?.keyphrase ?? null,
    publishedAt: item.date ?? null,
    modifiedAt: item.modified_gmt ?? null,
  }
}

/**
 * One page of one type. The Response comes back unread so the caller can look
 * at the status and the X-WP-TotalPages header before deciding what to do with
 * the body.
 */
function fetchPage(domain: string, type: ContentType, page: number): Promise<Response> {
  const params = new URLSearchParams({
    per_page: String(WP_PER_PAGE),
    page: String(page),
    status: 'publish',
    _fields: FIELDS,
  })
  return fetch(`https://${domain}/wp-json/wp/v2/${TYPE_TO_REST[type]}?${params}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: REVALIDATE_SECONDS, tags: [`audit-wp:${domain}`] },
  })
}

/**
 * Fetch every published item of one type, following pagination.
 *
 * Page 1 has to come first — it's what reports X-WP-TotalPages, and what tells
 * us a CPT isn't registered here (404). After that the page count is known, so
 * the rest go out together instead of one ~700 ms round trip at a time; a
 * 456-post site drops from ~2.6 s to ~0.75 s. PAGE_CONCURRENCY caps how many
 * are in flight so a much larger domain can't open a socket per page at once.
 */
export async function fetchType(domain: string, type: ContentType): Promise<CompletedRow[]> {
  const first = await fetchPage(domain, type, 1)
  // CPT not registered on this site.
  if (first.status === 404) return []
  if (!first.ok) throw new Error(`${domain} responded ${first.status} for ${TYPE_TO_REST[type]}`)

  const totalPages = Math.max(1, Number(first.headers.get('X-WP-TotalPages') ?? '1'))
  const pages: WpItem[][] = [(await first.json()) as WpItem[]]

  // Kept in page order, so the row order the tables see is stable.
  const rest = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
  for (let i = 0; i < rest.length; i += PAGE_CONCURRENCY) {
    const batch = await Promise.all(
      rest.slice(i, i + PAGE_CONCURRENCY).map(async (page) => {
        const res = await fetchPage(domain, type, page)
        // A short list would read as "pages were deleted", so a bad page throws
        // rather than resolving empty.
        if (!res.ok) {
          throw new Error(
            `${domain} responded ${res.status} for ${TYPE_TO_REST[type]} page ${page}`,
          )
        }
        return (await res.json()) as WpItem[]
      }),
    )
    pages.push(...batch)
  }

  return pages.flat().map((item) => normalize(item, type))
}

/** Fetch every configured content type for a site, flattened. */
export async function fetchAllContent(site: Site): Promise<CompletedRow[]> {
  const lists = await Promise.all(site.types.map((t) => fetchType(site.domain, t)))
  return lists.flat()
}


/**
 * Cheap per-type published counts for the Domain List screen: one request per
 * type with per_page=1, reading the X-WP-Total header (no bodies to speak of).
 */
export async function fetchCounts(site: Site): Promise<TypeCounts> {
  const counts: TypeCounts = {}
  await Promise.all(
    site.types.map(async (type) => {
      try {
        const url = `https://${site.domain}/wp-json/wp/v2/${TYPE_TO_REST[type]}?per_page=1&_fields=id`
        const res = await fetch(url, {
          headers: { Accept: 'application/json' },
          next: { revalidate: REVALIDATE_SECONDS, tags: [`audit-wp:${site.domain}`] },
        })
        if (!res.ok) {
          counts[type] = res.status === 404 ? 0 : undefined
          return
        }
        counts[type] = Number(res.headers.get('X-WP-Total') ?? '0')
      } catch {
        counts[type] = undefined
      }
    }),
  )
  return counts
}

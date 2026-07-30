/**
 * URL shape for the Pre Departure module:
 *
 *   /pre-departure/{brand}/{queueTab}/{pnr}/{detailTab}
 *
 * Every segment after the brand is optional and falls back to a default, so
 * `/pre-departure/fb` and `/pre-departure/fb/pending/<pnr>/flights` describe the same
 * view of the same queue. The brand itself is never optional — `/pre-departure` only
 * exists to redirect into one.
 *
 * Deliberately framework-neutral (no React, no `next/*`) so the server component that
 * resolves the incoming params and the client dashboard that pushes new paths derive
 * them from the same code. A drift between the two would show one brand's queue at
 * another brand's URL.
 */

export const BRANDS = [
  "IT",
  "QF",
  "FB",
  "RAT",
  "YP",
  "OBL",
  "RATNZ",
  "TWCT",
] as const
export type Brand = (typeof BRANDS)[number]

/** The brand the dashboard has always opened on, and where `/pre-departure` lands. */
export const DEFAULT_BRAND: Brand = "FB"

export const QUEUE_TABS = ["pending", "complete"] as const
export type QueueTab = (typeof QUEUE_TABS)[number]
export const DEFAULT_QUEUE_TAB: QueueTab = "pending"

export const DETAIL_TABS = [
  "flights",
  "p3",
  "tickets",
  "messages",
  "notes",
  "report",
  "raw",
] as const
export type DetailTab = (typeof DETAIL_TABS)[number]
export const DEFAULT_DETAIL_TAB: DetailTab = "flights"

/** IT is an internal brand — Super Admin only, matching the queue's own gating. */
export function visibleBrands(role?: string): readonly Brand[] {
  return role === "super_admin" ? BRANDS : BRANDS.filter((b) => b !== "IT")
}

/** `raw` shows unredacted Sabre payloads, so it is Super Admin only. */
export function canSeeRawTab(role?: string): boolean {
  return role === "super_admin"
}

export type PreDepartureRoute = {
  brand: Brand
  queueTab: QueueTab
  pnr: string | null
  detailTab: DetailTab
}

export function asQueueTab(value?: string | null): QueueTab {
  return QUEUE_TABS.find((t) => t === value?.toLowerCase()) ?? DEFAULT_QUEUE_TAB
}

export function asDetailTab(value?: string | null, role?: string): DetailTab {
  const tab =
    DETAIL_TABS.find((t) => t === value?.toLowerCase()) ?? DEFAULT_DETAIL_TAB
  return tab === "raw" && !canSeeRawTab(role) ? DEFAULT_DETAIL_TAB : tab
}

/**
 * Path for a route state, with trailing defaults left off — `/pre-departure/fb`
 * rather than `/pre-departure/fb/pending`. A PNR can only be addressed underneath a
 * queue tab, so the tab stays in the path whenever a PNR follows it.
 */
export function preDeparturePath(route: PreDepartureRoute): string {
  const base = `/pre-departure/${route.brand.toLowerCase()}`

  if (!route.pnr) {
    return route.queueTab === DEFAULT_QUEUE_TAB ? base : `${base}/${route.queueTab}`
  }

  const withPnr = `${base}/${route.queueTab}/${encodeURIComponent(route.pnr)}`
  return route.detailTab === DEFAULT_DETAIL_TAB
    ? withPnr
    : `${withPnr}/${route.detailTab}`
}

/**
 * Resolve URL segments into route state. Anything unknown — a misspelled brand, a
 * brand or tab this role cannot see, junk trailing segments — clamps to a default
 * rather than 404ing; the page then compares `preDeparturePath` against the incoming
 * path and redirects to the canonical one.
 */
export function parsePreDepartureRoute(
  brandSegment: string,
  rest: readonly string[] = [],
  role?: string
): PreDepartureRoute {
  const brand =
    visibleBrands(role).find(
      (b) => b.toLowerCase() === brandSegment?.toLowerCase()
    ) ?? DEFAULT_BRAND
  const [queueSegment, pnrSegment, detailSegment] = rest

  // A PNR is only addressable underneath a queue tab, so if that segment is junk the
  // whole tail is junk — drop it rather than read a stray segment as a record locator.
  if (queueSegment !== undefined && !QUEUE_TABS.some((t) => t === queueSegment.toLowerCase())) {
    return {
      brand,
      queueTab: DEFAULT_QUEUE_TAB,
      pnr: null,
      detailTab: DEFAULT_DETAIL_TAB,
    }
  }

  return {
    brand,
    queueTab: asQueueTab(queueSegment),
    // Record locators are case-insensitive but stored upper-case, and the detail
    // query key is built from this value.
    pnr: pnrSegment ? decodeURIComponent(pnrSegment).trim().toUpperCase() || null : null,
    detailTab: asDetailTab(detailSegment, role),
  }
}

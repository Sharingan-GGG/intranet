/**
 * URL shape for the Audit Hub:
 *
 *   /audit/scheduler/{tab}
 *   /audit/scheduler/{tab}/page-detail/{trackerId}
 *   /audit/scheduler/{tab}/content-audit/{contentAuditId}
 *   /audit/domain-list
 *   /audit/traffic
 *   /audit/traffic/page-detail?path=…
 *
 * The standalone portal implemented this with `history.pushState` and a
 * hand-written `applyRoute`, toggling an `.on` class between `<section>`s. The
 * scheme it produced is already plain nested segments, so App Router expresses
 * it natively and the router is gone — but the vocabulary is still worth
 * keeping in one place so links and `generateMetadata` agree.
 *
 * Deliberately framework-neutral (no React, no `next/*`), the same as
 * pre-departure-route.ts: the server components that resolve incoming params
 * and the client components that build links derive paths from the same code.
 *
 * Note the naming: `scheduler` is the URL segment the portal shipped and is
 * kept so existing links and bookmarks still resolve, but the screen is called
 * the **Dashboard** everywhere in the UI. (In the portal's source the screen id
 * `scheduler` meant Dashboard and `overview` meant Completed — that confusion
 * does not survive the port.)
 *
 * The portal's standalone Completed screen is gone: it listed exactly what the
 * Dashboard's Completed tab lists, so every report now hangs off the Dashboard
 * and a detail view has only one place to go back to.
 */

export const BASE_PATH = '/audit'

export const DASHBOARD_TABS = [
  'content-pre-check',
  'full-seo-page-scan',
  'archived',
  'completed',
] as const
export type DashboardTab = (typeof DASHBOARD_TABS)[number]

export const DASHBOARD_TAB_LABELS: Record<DashboardTab, string> = {
  'content-pre-check': 'Content Pre-Check',
  'full-seo-page-scan': 'Full SEO Page Scan',
  archived: 'Archived',
  completed: 'Completed',
}

/** Where `/audit` lands, and the tab the portal opened on. */
export const DEFAULT_DASHBOARD_TAB: DashboardTab = 'content-pre-check'

export function isDashboardTab(value: string | undefined): value is DashboardTab {
  return !!value && (DASHBOARD_TABS as readonly string[]).includes(value)
}

/** Which tab a detail view was opened from, so Back returns there. */
export type DetailOrigin = { screen: 'dashboard'; tab: DashboardTab }

export type AuditRoute =
  | { screen: 'dashboard'; tab: DashboardTab }
  | { screen: 'domain-list' }
  | { screen: 'traffic' }
  | { screen: 'traffic-page'; path: string; domain: string; days: number; channel?: string }
  | { screen: 'page-detail'; trackerId: string; from: DetailOrigin }
  | { screen: 'content-audit'; contentAuditId: string; from: DetailOrigin }

/**
 * Fragment naming the row a `?highlight=` points at.
 *
 * In one place because two screens have to agree on it: the Traffic drawer
 * writes it into the link, and the Dashboard puts it on the matching row.
 */
export const HIGHLIGHT_ANCHOR = 'highlighted-row'

/**
 * Content Pre-Check, scoped and anchored to one page.
 *
 * The query marks and filters to the row; the fragment is what makes the
 * browser jump to it. Built here rather than at the call site so the parameter
 * name and the fragment cannot drift apart.
 */
export function contentPreCheckForPath(domain: string, path: string): string {
  const q = new URLSearchParams({ domain, highlight: path })
  return `${auditPath({ screen: 'dashboard', tab: 'content-pre-check' })}?${q}#${HIGHLIGHT_ANCHOR}`
}

/** The canonical path for a route. */
export function auditPath(route: AuditRoute): string {
  switch (route.screen) {
    case 'dashboard':
      return `${BASE_PATH}/scheduler/${route.tab}`
    case 'domain-list':
      return `${BASE_PATH}/domain-list`
    case 'traffic':
      return `${BASE_PATH}/traffic`
    case 'traffic-page': {
      // The page is identified by its path, which is itself a path — so it
      // travels as a query parameter rather than a segment, encoded once.
      const q = new URLSearchParams({
        path: route.path,
        domain: route.domain,
        days: String(route.days),
      })
      if (route.channel) q.set('channel', route.channel)
      return `${BASE_PATH}/traffic/page-detail?${q}`
    }
    case 'page-detail':
      return `${originPath(route.from)}/page-detail/${route.trackerId}`
    case 'content-audit':
      return `${originPath(route.from)}/content-audit/${route.contentAuditId}`
  }
}

/** The path of the screen a detail view should return to. */
export function originPath(from: DetailOrigin): string {
  return `${BASE_PATH}/scheduler/${from.tab}`
}

export function originLabel(from: DetailOrigin): string {
  return DASHBOARD_TAB_LABELS[from.tab]
}

/**
 * Clamp an incoming `[tab]` segment to a real tab.
 *
 * Returning the default for an unknown value rather than 404ing matches the
 * portal, whose router sent anything unrecognised to the Dashboard.
 */
export function resolveDashboardTab(tab: string | undefined): DashboardTab {
  return isDashboardTab(tab) ? tab : DEFAULT_DASHBOARD_TAB
}

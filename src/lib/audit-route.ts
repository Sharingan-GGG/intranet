/**
 * URL shape for the Audit Hub:
 *
 *   /audit/scheduler/{tab}
 *   /audit/scheduler/{tab}/page-detail/{trackerId}
 *   /audit/scheduler/{tab}/content-audit/{contentAuditId}
 *   /audit/completed
 *   /audit/completed/page-detail/{trackerId}
 *   /audit/domain-list
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

/** Which screen a detail view was opened from, so Back returns there. */
export type DetailOrigin = { screen: 'dashboard'; tab: DashboardTab } | { screen: 'completed' }

export type AuditRoute =
  | { screen: 'dashboard'; tab: DashboardTab }
  | { screen: 'completed' }
  | { screen: 'domain-list' }
  | { screen: 'page-detail'; trackerId: string; from: DetailOrigin }
  | { screen: 'content-audit'; contentAuditId: string; from: DetailOrigin }

/** The canonical path for a route. */
export function auditPath(route: AuditRoute): string {
  switch (route.screen) {
    case 'dashboard':
      return `${BASE_PATH}/scheduler/${route.tab}`
    case 'completed':
      return `${BASE_PATH}/completed`
    case 'domain-list':
      return `${BASE_PATH}/domain-list`
    case 'page-detail':
      return `${originPath(route.from)}/page-detail/${route.trackerId}`
    case 'content-audit':
      return `${originPath(route.from)}/content-audit/${route.contentAuditId}`
  }
}

/** The path of the screen a detail view should return to. */
export function originPath(from: DetailOrigin): string {
  return from.screen === 'completed'
    ? `${BASE_PATH}/completed`
    : `${BASE_PATH}/scheduler/${from.tab}`
}

export function originLabel(from: DetailOrigin): string {
  return from.screen === 'completed' ? 'Completed' : DASHBOARD_TAB_LABELS[from.tab]
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

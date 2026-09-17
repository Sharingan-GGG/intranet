import 'server-only'

import { DEFAULT_SITE, siteByDomain } from '@/lib/audit-config'
import { loadGa4PageAudit, loadGa4PageDetail, loadGa4PropertyForDomain } from '@/lib/audit-ga4'
import { GA4_ALL_CHANNELS, resolveGa4Range } from '@/lib/audit-types'

export type PageDetailParams = {
  path?: string
  domain?: string
  days?: string
  channel?: string
}

/**
 * Everything the page-detail screen needs, however it is being shown.
 *
 * Shared because the route exists twice — once as a full page for a hard load,
 * once intercepted into the drawer — and two copies of this would be two places
 * for the GA calls and the audit join to drift apart.
 */
export async function loadPageDetailProps(params: PageDetailParams) {
  const path = params.path?.trim() ?? ''
  // siteByDomain falls back to DEFAULT_SITE, matching the list screen.
  const site = params.domain ? siteByDomain(params.domain) : DEFAULT_SITE
  const days = resolveGa4Range(params.days)
  const channel = params.channel?.trim() || GA4_ALL_CHANNELS
  const filter = channel === GA4_ALL_CHANNELS ? undefined : channel

  if (!path) return { path, site, days, channel, ok: false as const }

  const propertyId = await loadGa4PropertyForDomain(site.domain)

  let data = null
  let error: string | null = null
  if (propertyId) {
    try {
      data = await loadGa4PageDetail(propertyId, days, path, filter)
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not load page traffic.'
    }
  }

  // A local query, and it must not be lost to a GA failure.
  const audit = await loadGa4PageAudit(site.domain, path).catch(() => null)

  return {
    ok: true as const,
    path,
    site,
    days,
    channel,
    data,
    audit,
    error,
    hasProperty: Boolean(propertyId),
  }
}

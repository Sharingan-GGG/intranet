import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AuditAccessDenied } from '@/components/work/audit/access-denied'
import { AuditDashboard } from '@/components/work/audit/dashboard'
import { DEFAULT_SITE, siteByDomain } from '@/lib/audit-config'
import { loadDashboard } from '@/lib/audit-dashboard'
import {
  loadGa4BounceCached,
  loadGa4ChannelList,
  loadGa4PathViewsCached,
  loadGa4PropertyForDomain,
} from '@/lib/audit-ga4'
import {
  auditPath,
  isDashboardTab,
  resolveDashboardTab,
  DASHBOARD_TAB_LABELS,
} from '@/lib/audit-route'
import { getAuditRoster } from '@/lib/audit-roster'
import {
  resolveGa4Range,
  type Ga4ChannelTotals,
  type Ga4PathViews,
} from '@/lib/audit-types'
import { getAuditSession } from '@/lib/audit-user'

/**
 * The Dashboard. Every read is live — the tracker and the content-audit queue
 * are written by out-of-band workers, so a cached render would show stale
 * progress for as long as the cache lived.
 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

type Props = {
  params: Promise<{ tab: string }>
  searchParams: Promise<{ domain?: string; ga4?: string; days?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tab } = await params
  return { title: `${DASHBOARD_TAB_LABELS[resolveDashboardTab(tab)]} | Audit Hub` }
}

export default async function AuditDashboardPage({ params, searchParams }: Props) {
  const { tab: rawTab } = await params
  const { domain, ga4, days } = await searchParams

  const { user, canAccess } = await getAuditSession()
  if (!user) redirect('/login?redirect=/audit')
  if (!canAccess) return <AuditAccessDenied />

  // An unrecognised tab is corrected in the URL rather than rendered at a path
  // that does not exist, so Back and a copied link agree.
  if (!isDashboardTab(rawTab)) {
    redirect(auditPath({ screen: 'dashboard', tab: resolveDashboardTab(rawTab) }))
  }

  const site = domain ? siteByDomain(domain) : DEFAULT_SITE
  const channel = ga4?.trim() || ''
  // Resolved rather than trusted: `?days=999` falls back to the default
  // instead of reaching GA with a window it does not offer.
  const range = resolveGa4Range(days)

  const [{ rows, error }, roster, propertyId] = await Promise.all([
    loadDashboard(site),
    getAuditRoster(),
    loadGa4PropertyForDomain(site.domain),
  ])

  // The GA4 filter is an extra, never a gate: a site with no property, or a GA
  // outage, must still render the queue. Both failures collapse to "no channels
  // offered", which is what the disabled select then says.
  let ga4Channels: Ga4ChannelTotals[] = []
  let ga4Views: Ga4PathViews[] = []
  let ga4Bounce: { rate: number; prev: number } | null = null
  if (propertyId) {
    try {
      // All three cached for an hour: the Dashboard is opened repeatedly and
      // they only change once a day. The Traffic screen calls the uncached
      // versions, because there the numbers are the content.
      //
      // The per-page views are fetched whether or not a channel is picked: the
      // column shows a number on every row, and with nothing selected that
      // number is the page's total across all channels.
      const [channels, views, bounce] = await Promise.all([
        loadGa4ChannelList(propertyId, range),
        loadGa4PathViewsCached(propertyId, channel, range),
        loadGa4BounceCached(propertyId, range, channel),
      ])
      ga4Channels = channels
      ga4Views = views
      ga4Bounce = bounce
    } catch {
      // Leave the filter empty and carry on.
    }
  }

  return (
    <AuditDashboard
      tab={rawTab}
      site={site}
      rows={rows}
      roster={roster}
      loadError={error}
      ga4Channel={channel}
      ga4Days={range}
      ga4Channels={ga4Channels}
      ga4Bounce={ga4Bounce}
      ga4Views={ga4Views}
    />
  )
}

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AuditAccessDenied } from '@/components/work/audit/access-denied'
import { AuditDashboard } from '@/components/work/audit/dashboard'
import { DEFAULT_SITE, siteByDomain } from '@/lib/audit-config'
import { loadDashboard } from '@/lib/audit-dashboard'
import {
  GA4_DASHBOARD_DAYS,
  loadGa4ChannelList,
  loadGa4PathsForChannelCached,
  loadGa4PropertyForDomain,
} from '@/lib/audit-ga4'
import {
  auditPath,
  isDashboardTab,
  resolveDashboardTab,
  DASHBOARD_TAB_LABELS,
} from '@/lib/audit-route'
import { getAuditRoster } from '@/lib/audit-roster'
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
  searchParams: Promise<{ domain?: string; ga4?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tab } = await params
  return { title: `${DASHBOARD_TAB_LABELS[resolveDashboardTab(tab)]} | Audit Hub` }
}

export default async function AuditDashboardPage({ params, searchParams }: Props) {
  const { tab: rawTab } = await params
  const { domain, ga4 } = await searchParams

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

  const [{ rows, error }, roster, propertyId] = await Promise.all([
    loadDashboard(site),
    getAuditRoster(),
    loadGa4PropertyForDomain(site.domain),
  ])

  // The GA4 filter is an extra, never a gate: a site with no property, or a GA
  // outage, must still render the queue. Both failures collapse to "no channels
  // offered", which is what the disabled select then says.
  let ga4Channels: { channel: string; sessions: number }[] = []
  let ga4Paths: string[] | null = null
  if (propertyId) {
    try {
      // Both cached for an hour: the Dashboard is opened repeatedly and these
      // only change once a day. The Traffic screen calls the uncached versions.
      const [channels, paths] = await Promise.all([
        loadGa4ChannelList(propertyId, GA4_DASHBOARD_DAYS),
        channel ? loadGa4PathsForChannelCached(propertyId, channel) : Promise.resolve(null),
      ])
      ga4Channels = channels.map((c) => ({ channel: c.channel, sessions: c.sessions }))
      ga4Paths = paths
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
      ga4Channels={ga4Channels}
      ga4Paths={ga4Paths}
    />
  )
}

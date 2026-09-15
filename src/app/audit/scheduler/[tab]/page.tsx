import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AuditAccessDenied } from '@/components/work/audit/access-denied'
import { AuditDashboard } from '@/components/work/audit/dashboard'
import { DEFAULT_SITE, siteByDomain } from '@/lib/audit-config'
import { loadDashboard } from '@/lib/audit-dashboard'
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
  searchParams: Promise<{ domain?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tab } = await params
  return { title: `${DASHBOARD_TAB_LABELS[resolveDashboardTab(tab)]} | Audit Hub` }
}

export default async function AuditDashboardPage({ params, searchParams }: Props) {
  const { tab: rawTab } = await params
  const { domain } = await searchParams

  const { user, canAccess } = await getAuditSession()
  if (!user) redirect('/login?redirect=/audit')
  if (!canAccess) return <AuditAccessDenied />

  // An unrecognised tab is corrected in the URL rather than rendered at a path
  // that does not exist, so Back and a copied link agree.
  if (!isDashboardTab(rawTab)) {
    redirect(auditPath({ screen: 'dashboard', tab: resolveDashboardTab(rawTab) }))
  }

  const site = domain ? siteByDomain(domain) : DEFAULT_SITE
  const [{ rows, error }, roster] = await Promise.all([loadDashboard(site), getAuditRoster()])

  return <AuditDashboard tab={rawTab} site={site} rows={rows} roster={roster} loadError={error} />
}

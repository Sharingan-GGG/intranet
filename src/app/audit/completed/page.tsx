import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AuditAccessDenied } from '@/components/work/audit/access-denied'
import { CompletedTable } from '@/components/work/audit/completed-table'
import { loadCompleted } from '@/lib/audit-completed'
import { DEFAULT_SITE, siteByDomain } from '@/lib/audit-config'
import { getAuditRoster } from '@/lib/audit-roster'
import { getAuditSession } from '@/lib/audit-user'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = { title: 'Completed | Audit Hub' }

export default async function AuditCompletedPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>
}) {
  const { domain } = await searchParams
  const { user, canAccess } = await getAuditSession()
  if (!user) redirect('/login?redirect=/audit')
  if (!canAccess) return <AuditAccessDenied />

  const site = domain ? siteByDomain(domain) : DEFAULT_SITE
  const [{ rows, stats, error }, roster] = await Promise.all([
    loadCompleted(site),
    getAuditRoster(),
  ])

  return <CompletedTable site={site} rows={rows} stats={stats} roster={roster} loadError={error} />
}

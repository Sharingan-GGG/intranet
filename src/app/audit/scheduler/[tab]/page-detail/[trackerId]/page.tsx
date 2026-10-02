import { notFound, redirect } from 'next/navigation'

import { AuditAccessDenied } from '@/components/work/audit/access-denied'
import { PageDetail } from '@/components/work/audit/page-detail'
import { loadPageDetail } from '@/lib/audit-detail'
import { resolveDashboardTab } from '@/lib/audit-route'
import { getAuditRoster } from '@/lib/audit-roster'
import { getAuditSession } from '@/lib/audit-user'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPageDetail({
  params,
  searchParams,
}: {
  params: Promise<{ tab: string; trackerId: string }>
  searchParams: Promise<{ assignee?: string }>
}) {
  const [{ tab, trackerId }, { assignee }] = await Promise.all([params, searchParams])
  const { user, canAccess } = await getAuditSession()
  if (!user) redirect('/login?redirect=/audit')
  if (!canAccess) return <AuditAccessDenied />

  const [detail, roster] = await Promise.all([loadPageDetail(trackerId), getAuditRoster()])
  if (!detail) notFound()

  // `?assignee=` is the Dashboard's filter, carried over so the report opens on
  // the same half of the findings the list was counting. An email no longer on
  // the roster resolves to null and simply falls back to the page's own
  // assignment, the way an unfiltered list does.
  const filterTeam = (assignee && roster.find((r) => r.email === assignee)?.team) || null

  return (
    <PageDetail
      {...detail}
      roster={roster}
      filterTeam={filterTeam}
      userName={user.name?.trim().split(/\s+/)[0] ?? null}
      from={{ screen: 'dashboard', tab: resolveDashboardTab(tab) }}
    />
  )
}

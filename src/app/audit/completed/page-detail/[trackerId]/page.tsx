import { notFound, redirect } from 'next/navigation'

import { AuditAccessDenied } from '@/components/work/audit/access-denied'
import { PageDetail } from '@/components/work/audit/page-detail'
import { loadPageDetail } from '@/lib/audit-detail'
import { getAuditRoster } from '@/lib/audit-roster'
import { getAuditSession } from '@/lib/audit-user'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CompletedPageDetail({
  params,
}: {
  params: Promise<{ trackerId: string }>
}) {
  const { trackerId } = await params
  const { user, canAccess } = await getAuditSession()
  if (!user) redirect('/login?redirect=/audit')
  if (!canAccess) return <AuditAccessDenied />

  const [detail, roster] = await Promise.all([loadPageDetail(trackerId), getAuditRoster()])
  if (!detail) notFound()

  return <PageDetail {...detail} roster={roster} from={{ screen: 'completed' }} />
}

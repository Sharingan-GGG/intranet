import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AuditAccessDenied } from '@/components/work/audit/access-denied'
import { AuditTrafficPageDetail } from '@/components/work/audit/traffic-page-detail'
import { getAuditSession } from '@/lib/audit-user'

import { loadPageDetailProps, type PageDetailParams } from './load'

/**
 * One page's traffic, as a full page.
 *
 * This is the hard-load form: reached by opening or refreshing the URL, or by
 * following the link from outside the app. From the Traffic table the same URL
 * is intercepted into a drawer instead — see ../@drawer/(.)page-detail.
 */
export const metadata: Metadata = { title: 'Page traffic | Audit Hub' }
export const revalidate = 0

export default async function AuditTrafficPageDetailPage({
  searchParams,
}: {
  searchParams: Promise<PageDetailParams>
}) {
  const { user, canAccess } = await getAuditSession()
  if (!user) redirect('/login?redirect=/audit/traffic')
  if (!canAccess) return <AuditAccessDenied />

  const props = await loadPageDetailProps(await searchParams)
  // Nothing to look up without a path; send them back rather than render a
  // screen that can only say "no page selected".
  if (!props.ok) redirect(`/audit/traffic?domain=${props.site.domain}&days=${props.days}`)

  return <AuditTrafficPageDetail {...props} variant="page" />
}

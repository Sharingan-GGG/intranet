import { AuditAccessDenied } from '@/components/work/audit/access-denied'
import { AuditTrafficDrawer } from '@/components/work/audit/traffic-drawer'
import { AuditTrafficPageDetail } from '@/components/work/audit/traffic-page-detail'
import { getAuditSession } from '@/lib/audit-user'

import { loadPageDetailProps, type PageDetailParams } from '../../page-detail/load'

/**
 * The same page detail, intercepted into a drawer over the Traffic table.
 *
 * Only reached by a soft navigation from the list, which is the whole point:
 * the table behind stays mounted and is not re-fetched, so opening a page costs
 * its own five GA calls and nothing more.
 *
 * No redirect on a missing path here — a redirect inside a slot would move the
 * page out from under the drawer. Rendering nothing leaves the table as it was.
 */
export const revalidate = 0

export default async function AuditTrafficDrawerPage({
  searchParams,
}: {
  searchParams: Promise<PageDetailParams>
}) {
  const { user, canAccess } = await getAuditSession()
  if (!user) return null
  if (!canAccess) return <AuditAccessDenied />

  const props = await loadPageDetailProps(await searchParams)
  if (!props.ok) return null

  return (
    <AuditTrafficDrawer>
      <AuditTrafficPageDetail {...props} variant="drawer" />
    </AuditTrafficDrawer>
  )
}

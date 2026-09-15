import { redirect } from 'next/navigation'

import { DEFAULT_DASHBOARD_TAB, auditPath } from '@/lib/audit-route'

/**
 * `/audit` itself is not a screen — it only exists to land on the Dashboard's
 * default tab, which is where the portal opened too. The access check lives on
 * the destination, so there is nothing to guard here.
 */
export default function AuditIndexPage() {
  redirect(auditPath({ screen: 'dashboard', tab: DEFAULT_DASHBOARD_TAB }))
}

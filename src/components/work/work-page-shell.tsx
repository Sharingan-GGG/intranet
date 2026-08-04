"use client"

import { PnrWorkDashboard } from "@/components/work/pnr-work-dashboard"
import type { PermissionMap } from "@/lib/permissions"
import type { PreDepartureRoute } from "@/lib/pre-departure-route"

/**
 * Work Page Shell - Pre Departure Module
 *
 * Manages the main Pre Departure work interface with role-based action permissions.
 * Permissions displayed here apply only to Pre Departure operations.
 */
export function WorkPageShell({
  role,
  profileId,
  permissions,
  userName,
  route,
}: {
  role: string
  profileId?: string
  permissions: PermissionMap | null
  userName?: string
  /** Brand, queue tab, open PNR and detail tab resolved from the URL. */
  route: PreDepartureRoute
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PnrWorkDashboard
        role={role}
        profileId={profileId}
        permissions={permissions}
        userName={userName}
        route={route}
      />
    </div>
  )
}

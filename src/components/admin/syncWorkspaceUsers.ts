'use server'

import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import config from '@payload-config'
import { listUsersInOu } from '@/lib/google-admin'

const hasAdminRole = (roles: string[] | null | undefined) =>
  Boolean(roles?.some((r) => r === 'super-admin' || r === 'admin'))

/**
 * Re-fetches live Workspace users for a department's OU, for the "Sync" button in the admin
 * UI, and writes each matched Payload user's `department` field to this department — the
 * same OU-derived assignment the SSO callback applies at login, run here on demand so an
 * admin can push an OU change out immediately instead of waiting for everyone to sign in
 * again. Admin-gated to mirror the Departments collection's own `update: isAdmin` access.
 */
export async function syncWorkspaceUsers(departmentId: string, orgUnitPath: string) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await getHeaders() })
  if (!hasAdminRole(user?.roles)) throw new Error('Forbidden')

  const members = await listUsersInOu(orgUnitPath)

  let updated = 0
  for (const member of members) {
    const { docs } = await payload.find({
      collection: 'users',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      where: { email: { equals: member.primaryEmail.toLowerCase() } },
    })
    const payloadUser = docs[0]
    if (!payloadUser) continue

    const currentDepartment =
      typeof payloadUser.department === 'object' ? payloadUser.department?.id : payloadUser.department

    if (currentDepartment !== departmentId) {
      await payload.update({
        collection: 'users',
        id: payloadUser.id,
        data: { department: departmentId },
        overrideAccess: true,
      })
      updated++
    }
  }

  return { members, updated }
}

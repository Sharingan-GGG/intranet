'use server'

import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'

import config from '@payload-config'
import { listUsersInOu } from '@/lib/google-admin'

/** Re-fetches live Workspace users for a department's OU, for the "Sync" button in the admin UI. */
export async function syncWorkspaceUsers(orgUnitPath: string) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await getHeaders() })
  if (!user) throw new Error('Forbidden')

  return listUsersInOu(orgUnitPath)
}

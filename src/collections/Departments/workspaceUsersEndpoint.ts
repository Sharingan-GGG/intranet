import type { PayloadHandler } from 'payload'

import { listUsersInOu } from '@/lib/google-admin'

/** Re-fetches live Workspace users for a department's OU, for the "Sync" button in the admin UI. */
export const workspaceUsersEndpoint: PayloadHandler = async (req) => {
  if (!req.user) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const orgUnitPath = req.searchParams.get('orgUnitPath')
  if (!orgUnitPath) {
    return Response.json({ error: 'orgUnitPath is required' }, { status: 400 })
  }

  try {
    const users = await listUsersInOu(orgUnitPath)
    return Response.json({ users })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}

import type { UIFieldServerProps } from 'payload'

import { listUsersInOu } from '@/lib/google-admin'

import { DepartmentWorkspaceUsersClient } from './DepartmentWorkspaceUsersClient'

export async function DepartmentWorkspaceUsers({ data }: UIFieldServerProps) {
  const orgUnitPath = data?.orgUnitPath as string | undefined
  if (!orgUnitPath) return null

  try {
    const users = await listUsersInOu(orgUnitPath)
    return <DepartmentWorkspaceUsersClient orgUnitPath={orgUnitPath} initialUsers={users} />
  } catch (e) {
    return (
      <div style={{ color: 'var(--theme-error-500)' }}>
        Failed to load Workspace users for {orgUnitPath}: {(e as Error).message}
      </div>
    )
  }
}

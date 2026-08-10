import type { UIFieldServerProps } from 'payload'

import { listUsersInOu } from '@/lib/google-admin'

import { DepartmentWorkspaceUsersClient } from './DepartmentWorkspaceUsersClient'

export async function DepartmentWorkspaceUsers({ data }: UIFieldServerProps) {
  const orgUnitPath = data?.orgUnitPath as string | undefined
  const departmentId = data?.id as string | undefined
  if (!orgUnitPath || !departmentId) return null

  try {
    const users = await listUsersInOu(orgUnitPath)
    return (
      <DepartmentWorkspaceUsersClient
        departmentId={departmentId}
        orgUnitPath={orgUnitPath}
        initialUsers={users}
      />
    )
  } catch (e) {
    return (
      <div style={{ color: 'var(--theme-error-500)' }}>
        Failed to load Workspace users for {orgUnitPath}: {(e as Error).message}
      </div>
    )
  }
}

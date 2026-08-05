import type { UIFieldServerProps } from 'payload'

import { listUsersInOu } from '@/lib/google-admin'

export async function DepartmentWorkspaceUsers({ data }: UIFieldServerProps) {
  const orgUnitPath = data?.orgUnitPath as string | undefined
  if (!orgUnitPath) return null

  let users: Awaited<ReturnType<typeof listUsersInOu>>
  try {
    users = await listUsersInOu(orgUnitPath)
  } catch (e) {
    return (
      <div style={{ color: 'var(--theme-error-500)' }}>
        Failed to load Workspace users for {orgUnitPath}: {(e as Error).message}
      </div>
    )
  }

  return (
    <div>
      <p style={{ marginBottom: 'var(--base)' }}>
        {users.length} user{users.length === 1 ? '' : 's'} in Workspace OU {orgUnitPath}
      </p>
      {users.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
          {users.map((u) => (
            <li key={u.primaryEmail}>
              {u.name.fullName} — {u.primaryEmail}
              {u.suspended ? ' (suspended)' : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

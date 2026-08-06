'use client'

import { useState } from 'react'

import type { WorkspaceUser } from '@/lib/google-admin'

export function DepartmentWorkspaceUsersClient({
  orgUnitPath,
  initialUsers,
}: {
  orgUnitPath: string
  initialUsers: WorkspaceUser[]
}) {
  const [users, setUsers] = useState(initialUsers)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sync = async () => {
    setSyncing(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/departments/workspace-users?orgUnitPath=${encodeURIComponent(orgUnitPath)}`,
        { credentials: 'include' },
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`)
      setUsers(json.users)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--base)',
        }}
      >
        <p style={{ margin: 0 }}>
          {users.length} user{users.length === 1 ? '' : 's'} in Workspace OU {orgUnitPath}
        </p>
        <button
          type="button"
          onClick={sync}
          disabled={syncing}
          className="btn btn--style-secondary btn--size-small"
        >
          {syncing ? 'Syncing…' : 'Sync'}
        </button>
      </div>
      {error && <p style={{ color: 'var(--theme-error-500)' }}>{error}</p>}
      {users.length > 0 && (
        <div style={{ height: 260, overflowY: 'auto', border: '1px solid var(--theme-elevation-100)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr
                style={{
                  textAlign: 'left',
                  position: 'sticky',
                  top: 0,
                  background: 'var(--theme-elevation-0)',
                  borderBottom: '1px solid var(--theme-elevation-150)',
                }}
              >
                <th style={{ padding: '6px 10px' }}>Name</th>
                <th style={{ padding: '6px 10px' }}>Email</th>
                <th style={{ padding: '6px 10px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.primaryEmail} style={{ borderBottom: '1px solid var(--theme-elevation-100)' }}>
                  <td style={{ padding: '6px 10px' }}>{u.name.fullName}</td>
                  <td style={{ padding: '6px 10px' }}>{u.primaryEmail}</td>
                  <td style={{ padding: '6px 10px' }}>{u.suspended ? 'Suspended' : 'Active'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

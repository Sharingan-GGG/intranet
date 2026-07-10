'use client'

import React, { useEffect, useRef, useState } from 'react'

export type AccountUser = {
  name?: string | null
  email: string
  roles?: string[] | null
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  editor: 'Editor',
  user: 'User',
}

const firstNameLetter = (user: AccountUser | null): string => {
  const source = user?.name?.trim() || user?.email || ''
  return (source[0] || '?').toUpperCase()
}

export const AccountMenu: React.FC<{ user: AccountUser | null }> = ({ user }) => {
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const logout = async () => {
    setLoggingOut(true)
    try {
      await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
    } catch {
      /* ignore — clear client state regardless */
    }
    // Full navigation so server components re-render without the auth cookie.
    window.location.assign('/')
  }

  const firstName = user?.name?.trim().split(/\s+/)[0]
  const role = user?.roles?.[0]

  return (
    <div ref={ref} style={{ position: 'relative', flex: 'none' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        title={user ? (user.name ?? user.email) : 'Account'}
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: '#AACCD6',
          color: '#112E81',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          fontWeight: 700,
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {firstNameLetter(user)}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 46,
            right: 0,
            width: 248,
            background: '#fff',
            borderRadius: 14,
            boxShadow: '0 16px 40px rgba(17,46,129,0.22)',
            border: '1px solid #E3EBF1',
            overflow: 'hidden',
            zIndex: 50,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px 14px' }}>
            <div
              style={{
                width: 40,
                height: 40,
                flex: 'none',
                borderRadius: '50%',
                background: '#AACCD6',
                color: '#112E81',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              {firstNameLetter(user)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#1B2233',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user ? (user.name || firstName || 'Your account') : 'Not signed in'}
              </div>
              {user && (
                <div
                  style={{
                    fontSize: 12,
                    color: '#5A6478',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {user.email}
                </div>
              )}
            </div>
          </div>

          {user && role && (
            <div style={{ padding: '0 16px 12px' }}>
              <span
                style={{
                  display: 'inline-block',
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#112E81',
                  background: '#EFF5FC',
                  border: '1px solid #D6E4F7',
                  padding: '3px 9px',
                  borderRadius: 999,
                }}
              >
                {ROLE_LABELS[role] ?? role}
              </span>
            </div>
          )}

          <div style={{ borderTop: '1px solid #EEF3F8' }}>
            {user ? (
              <button
                type="button"
                role="menuitem"
                onClick={logout}
                disabled={loggingOut}
                className="il-doc-row"
                style={{
                  width: '100%',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 16px',
                  border: 'none',
                  background: 'none',
                  fontSize: 13.5,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  color: '#B4443C',
                  cursor: loggingOut ? 'default' : 'pointer',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M15 12H4m0 0 3.5-3.5M4 12l3.5 3.5M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"
                    stroke="#B4443C"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {loggingOut ? 'Signing out…' : 'Log out'}
              </button>
            ) : (
              <a
                role="menuitem"
                href="/admin"
                className="il-doc-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 16px',
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: '#112E81',
                }}
              >
                Sign in
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

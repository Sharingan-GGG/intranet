import React from 'react'

/** "View Website" link in the admin header, rendered beside the account avatar. */
export default function AdminViewWebsite() {
  return (
    <a
      href="/"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12.5,
        fontWeight: 600,
        textDecoration: 'none',
        color: 'var(--theme-elevation-800)',
        background: 'var(--theme-elevation-100)',
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: 999,
        padding: '6px 12px',
        whiteSpace: 'nowrap',
      }}
    >
      View Website
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M7 17 17 7M9 7h8v8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  )
}

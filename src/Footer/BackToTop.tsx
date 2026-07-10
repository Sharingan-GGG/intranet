'use client'

import React from 'react'

export function BackToTop() {
  const backToTop = () => {
    const el = document.scrollingElement || document.documentElement
    el.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <button
      type="button"
      onClick={backToTop}
      className="il-back-top"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        background: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(255,255,255,0.2)',
        color: '#fff',
        fontSize: 12.5,
        fontWeight: 600,
        fontFamily: 'inherit',
        padding: '8px 15px',
        borderRadius: 999,
        cursor: 'pointer',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="M12 19V6m0 0-6 6m6-6 6 6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Back to top
    </button>
  )
}

import React from 'react'

/** Full CTG brand lockup shown on the admin login / create-first-user screen. */
export const Logo = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/ctg-icon.png" alt="CTG logo" width={48} height={48} style={{ borderRadius: '50%', display: 'block' }} />
    <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.01em' }}>
      CTG <span style={{ fontWeight: 400, opacity: 0.7 }}>Intranet</span>
    </span>
  </div>
)

export default Logo

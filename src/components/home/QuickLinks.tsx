import React from 'react'

import type { QuickLink } from '@/lib/home'

export const QuickLinks: React.FC<{ links: QuickLink[] }> = ({ links }) => (
  <div
    style={{
      background: '#fff',
      border: '1px solid #E3EBF1',
      borderRadius: 20,
      padding: '22px 24px 24px',
      boxShadow: '0 1px 2px rgba(17,46,129,0.04)',
    }}
  >
    <h2 style={{ margin: '0 0 15px', fontSize: 16, fontWeight: 800, color: '#112E81', letterSpacing: '-0.01em' }}>
      Quickest links
    </h2>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 11 }}>
      {links.map((q) => (
        <a
          key={q.label}
          href={q.href}
          target={q.href.startsWith('http') ? '_blank' : undefined}
          rel={q.href.startsWith('http') ? 'noopener noreferrer' : undefined}
          className="il-tile"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 9,
            padding: '15px 8px 13px',
            border: '1px solid #E3EBF1',
            borderRadius: 14,
            background: '#fff',
          }}
        >
          <span
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              background: '#F2F6FA',
              border: '1px solid #E3EBF1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={q.icon} alt="" width={22} height={22} style={{ borderRadius: 5, objectFit: 'contain' }} />
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1B2233', textAlign: 'center', lineHeight: 1.2 }}>
            {q.label}
          </span>
        </a>
      ))}
    </div>
  </div>
)

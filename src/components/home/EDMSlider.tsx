import React from 'react'

import type { EdmCard } from '@/lib/home'
import { CardSlider } from './CardSlider'

const CardLoopMark = () => (
  <svg width="66" height="66" viewBox="0 0 40 40" fill="none" style={{ opacity: 0.35 }} aria-hidden>
    <path
      d="M10 20c0-3.6 2.4-6.5 5.4-6.5 2.7 0 4 2.6 4.6 6.5.6 3.9 1.9 6.5 4.6 6.5 3 0 5.4-2.9 5.4-6.5s-2.4-6.5-5.4-6.5c-2.7 0-4 2.6-4.6 6.5-.6 3.9-1.9 6.5-4.6 6.5-3 0-5.4-2.9-5.4-6.5Z"
      stroke="#fff"
      strokeWidth="2.4"
    />
  </svg>
)

export const EDMSlider: React.FC<{ items: EdmCard[] }> = ({ items }) => (
  <CardSlider id="edms" title="Latest EDMs" step={540}>
    {items.map((e, i) => (
      <a
        key={i}
        href={e.href}
        className="il-card"
        style={{
          flex: 'none',
          width: 322,
          background: '#fff',
          border: '1px solid #E3EBF1',
          borderRadius: 18,
          overflow: 'hidden',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            height: 150,
            background: e.imageUrl ? `center / cover no-repeat url("${e.imageUrl}")` : e.img,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {!e.imageUrl && <CardLoopMark />}
        </div>
        <div style={{ padding: '16px 18px 18px' }}>
          <div
            style={{
              display: 'inline-block',
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#ffffff',
              background: 'rgb(45 87 211)',
              padding: '3px 9px',
              borderRadius: 999,
              marginBottom: 7,
            }}
          >
            {e.kicker}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1B2233', lineHeight: 1.3, letterSpacing: '-0.01em' }}>
            {e.title}
          </div>
          <div style={{ fontSize: 12, color: '#8A94A6', marginTop: 10 }}>Sent {e.sent}</div>
        </div>
      </a>
    ))}
  </CardSlider>
)

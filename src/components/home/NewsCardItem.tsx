import React from 'react'

import type { NewsCard } from '@/lib/home'

const CardLoopMark = () => (
  <svg width="66" height="66" viewBox="0 0 40 40" fill="none" style={{ opacity: 0.35 }} aria-hidden>
    <path
      d="M10 20c0-3.6 2.4-6.5 5.4-6.5 2.7 0 4 2.6 4.6 6.5.6 3.9 1.9 6.5 4.6 6.5 3 0 5.4-2.9 5.4-6.5s-2.4-6.5-5.4-6.5c-2.7 0-4 2.6-4.6 6.5-.6 3.9-1.9 6.5-4.6 6.5-3 0-5.4-2.9-5.4-6.5Z"
      stroke="#fff"
      strokeWidth="2.4"
    />
  </svg>
)

/** The "Latest CTG News" card — used by the homepage slider and the /posts grid. */
export const NewsCardItem: React.FC<{ card: NewsCard; width?: number | string }> = ({ card: n, width = 322 }) => (
  <a
    href={n.href ?? '#'}
    className="il-card il-news-card"
    style={{
      flex: 'none',
      width,
      background: '#fff',
      border: '1px solid var(--il-border)',
      borderRadius: 18,
      overflow: 'hidden',
      cursor: 'pointer',
      textDecoration: 'none',
    }}
  >
    <div
      style={{
        height: 150,
        background: n.imageUrl ? `center / cover no-repeat url("${n.imageUrl}")` : n.img,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {!n.imageUrl && <CardLoopMark />}
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
        {n.kicker}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--il-text)', lineHeight: 1.3, letterSpacing: '-0.01em' }}>
        {n.title}
      </div>
      <div style={{ fontSize: 13, color: 'var(--il-text-body)', lineHeight: 1.5, marginTop: 6 }}>{n.excerpt}</div>
      <div style={{ fontSize: 12, color: 'var(--il-text-muted)', marginTop: 10 }}>{n.date}</div>
    </div>
  </a>
)

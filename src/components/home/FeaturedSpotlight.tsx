'use client'

import React, { useEffect, useRef, useState } from 'react'

import type { NewsCard } from '@/lib/home'

const LoopMark = () => (
  <svg
    width="340"
    height="340"
    viewBox="0 0 40 40"
    fill="none"
    style={{ position: 'absolute', right: -70, top: -80, opacity: 0.12 }}
    aria-hidden
  >
    <path
      d="M10 20c0-3.6 2.4-6.5 5.4-6.5 2.7 0 4 2.6 4.6 6.5.6 3.9 1.9 6.5 4.6 6.5 3 0 5.4-2.9 5.4-6.5s-2.4-6.5-5.4-6.5c-2.7 0-4 2.6-4.6 6.5-.6 3.9-1.9 6.5-4.6 6.5-3 0-5.4-2.9-5.4-6.5Z"
      stroke="#fff"
      strokeWidth="2"
    />
  </svg>
)

export const FeaturedSpotlight: React.FC<{ items: NewsCard[] }> = ({ items }) => {
  const [i, setI] = useState(0)
  const paused = useRef(false)
  const count = items.length

  useEffect(() => {
    if (count <= 1) return
    const t = setInterval(() => {
      if (!paused.current) setI((n) => (n + 1) % count)
    }, 6000)
    return () => clearInterval(t)
  }, [count])

  if (count === 0) return null
  const item = items[i]

  return (
    <div
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      style={{
        position: 'relative',
        borderRadius: 20,
        overflow: 'hidden',
        background: item.imageUrl
          ? `linear-gradient(to top, rgba(9,20,55,0.9) 0%, rgba(9,20,55,0.45) 38%, rgba(9,20,55,0.08) 72%, rgba(9,20,55,0) 100%), url("${item.imageUrl}") center / cover no-repeat`
          : 'linear-gradient(128deg,#112E81,#4647AE 55%,#4382DF)',
        minHeight: 330,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: '34px 36px',
      }}
    >
      {!item.imageUrl && <LoopMark />}
      <div style={{ position: 'relative' }} aria-live="polite">
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#ffffff',
            background: 'rgb(45 87 211)',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '5px 11px',
            borderRadius: 999,
          }}
        >
          Featured · {item.kicker}
        </span>
        <div
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
            marginTop: 14,
            maxWidth: 620,
          }}
        >
          {item.title}
        </div>
        <div style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.75)', lineHeight: 1.55, marginTop: 10, maxWidth: 560 }}>
          {item.excerpt}
        </div>
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
          <a
            href={item.href ?? '/#news'}
            style={{
              background: '#fff',
              color: '#112E81',
              fontSize: 13.5,
              fontWeight: 700,
              padding: '10px 22px',
              borderRadius: 999,
              cursor: 'pointer',
            }}
          >
            Read the story
          </a>
          {count > 1 && (
            <div style={{ display: 'flex', gap: 6 }}>
              {items.map((_, d) => (
                <button
                  key={d}
                  type="button"
                  aria-label={`Show featured story ${d + 1}`}
                  onClick={() => setI(d)}
                  style={{
                    width: d === i ? 22 : 7,
                    height: 7,
                    borderRadius: 4,
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    background: d === i ? '#fff' : 'rgba(255,255,255,0.45)',
                    transition: 'width 200ms ease',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

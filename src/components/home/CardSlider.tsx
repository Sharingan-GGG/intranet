'use client'

import React, { useRef } from 'react'

const RoundBtn: React.FC<{ dir: 'prev' | 'next'; onClick: () => void }> = ({ dir, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={dir === 'prev' ? 'Scroll back' : 'Scroll forward'}
    className="il-round"
    style={{
      width: 36,
      height: 36,
      borderRadius: '50%',
      border: '1px solid #D6E1EC',
      background: '#fff',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d={dir === 'prev' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        stroke="var(--il-brand)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </button>
)

type Props = {
  id: string
  title: string
  step?: number
  /** Extra header content (e.g. filter tabs) rendered between the title and the arrows. */
  headerExtra?: React.ReactNode
  children: React.ReactNode
}

export const CardSlider: React.FC<Props> = ({ id, title, step = 680, headerExtra, children }) => {
  const track = useRef<HTMLDivElement>(null)
  const scroll = (dx: number) => track.current?.scrollBy({ left: dx, behavior: 'smooth' })

  return (
    <div id={id} className={`il-slider il-slider-${id}`} style={{ scrollMarginTop: 82 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--il-brand)', letterSpacing: '-0.01em' }}>{title}</h2>
        {headerExtra}
        <div style={{ display: 'flex', gap: 8 }}>
          <RoundBtn dir="prev" onClick={() => scroll(-step)} />
          <RoundBtn dir="next" onClick={() => scroll(step)} />
        </div>
      </div>
      <div
        ref={track}
        className="il-track"
        style={{
          display: 'flex',
          gap: 18,
          overflowX: 'auto',
          scrollBehavior: 'smooth',
          // Vertical room so the .il-card:hover lift (translateY) and its shadow
          // aren't clipped — overflow-x:auto forces overflow-y to clip as well.
          paddingTop: 8,
          paddingBottom: 22,
        }}
      >
        {children}
      </div>
    </div>
  )
}

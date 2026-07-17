'use client'

import React, { useMemo, useState } from 'react'

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

const tabStyle = (active: boolean): React.CSSProperties => ({
  border: active ? '1px solid rgb(45 87 211)' : '1px solid #DCE7F5',
  background: active ? 'rgb(45 87 211)' : '#fff',
  color: active ? '#fff' : '#112E81',
  fontSize: 12.5,
  fontWeight: 700,
  padding: '6px 14px',
  borderRadius: 999,
  cursor: 'pointer',
})

export const EDMSlider: React.FC<{ items: EdmCard[]; categories?: string[]; heading?: string }> = ({
  items,
  categories,
  heading = 'Latest EDMs',
}) => {
  // Tabs = every sub-category of EDMs; falls back to those present in the data.
  const tabs = useMemo(
    () => (categories?.length ? categories : [...new Set(items.map((e) => e.kicker))]),
    [categories, items],
  )
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const visible = activeTab ? items.filter((e) => e.kicker === activeTab) : items

  const tabBar =
    tabs.length > 0 ? (
      <div className="il-tabs" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1, margin: '0 16px', minWidth: 0 }}>
        <button type="button" style={tabStyle(activeTab === null)} onClick={() => setActiveTab(null)}>
          All
        </button>
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            style={tabStyle(activeTab === t)}
            onClick={() => setActiveTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
    ) : null

  return (
    <CardSlider id="edms" title={heading} step={540} headerExtra={tabBar}>
      {visible.length === 0 && (
        <div style={{ padding: '28px 4px', fontSize: 13.5, color: '#8A94A6' }}>
          No EDMs in this category yet.
        </div>
      )}
        {visible.map((e, i) => (
          <a
            key={`${e.href}-${i}`}
            href={e.href}
            target="_blank"
            rel="noopener noreferrer"
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
              {e.description && (
                <div
                  style={{
                    fontSize: 12.5,
                    color: '#5A6478',
                    marginTop: 7,
                    lineHeight: 1.45,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {e.description}
                </div>
              )}
              <div style={{ fontSize: 12, color: '#8A94A6', marginTop: 10 }}>Sent {e.sent}</div>
            </div>
          </a>
        ))}
    </CardSlider>
  )
}

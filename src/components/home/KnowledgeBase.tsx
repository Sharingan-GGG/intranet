'use client'

import React, { useMemo, useState } from 'react'

import { EXT_STYLE, KB_CATEGORIES, type KbDoc } from '@/lib/home'

export const KnowledgeBase: React.FC<{ documents: KbDoc[] }> = ({ documents }) => {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('All')

  const query = q.trim().toLowerCase()
  const docs = useMemo(
    () =>
      documents.filter(
        (d) =>
          (cat === 'All' || d.category === cat) &&
          (!query ||
            d.title.toLowerCase().includes(query) ||
            (d.description?.toLowerCase().includes(query) ?? false)),
      ),
    [documents, cat, query],
  )

  return (
    <div
      id="knowledge-base"
      style={{
        background: '#fff',
        border: '1px solid #E3EBF1',
        borderRadius: 20,
        padding: 24,
        boxShadow: '0 1px 2px rgba(17,46,129,0.04)',
        scrollMarginTop: 82,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 15 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#112E81', letterSpacing: '-0.01em' }}>Knowledge base</div>
        <div style={{ position: 'relative', width: 250 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', left: 12, top: 10 }}>
            <circle cx="11" cy="11" r="7" stroke="#5A6478" strokeWidth="2" />
            <path d="m20 20-3.5-3.5" stroke="#5A6478" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search documents…"
            aria-label="Search documents"
            className="il-input"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              height: 34,
              borderRadius: 17,
              border: '1px solid #DDE6EE',
              background: '#F4F7FA',
              color: '#1B2233',
              fontSize: 13,
              fontFamily: 'inherit',
              padding: '0 14px 0 33px',
              outline: 'none',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
        {KB_CATEGORIES.map((name) => {
          const active = cat === name
          return (
            <button
              key={name}
              type="button"
              onClick={() => setCat(name)}
              style={{
                border: `1px solid ${active ? '#112E81' : '#DDE6EE'}`,
                background: active ? '#112E81' : '#fff',
                color: active ? '#fff' : '#5A6478',
                fontSize: 12.5,
                fontWeight: 600,
                fontFamily: 'inherit',
                padding: '6px 13px',
                borderRadius: 999,
                cursor: 'pointer',
                transition: 'all 150ms',
              }}
            >
              {name}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 18px' }}>
        {docs.map((d, idx) => {
          const [bg, fg] = EXT_STYLE[d.ext]
          return (
            <a
              key={`${d.title}-${idx}`}
              href={d.href}
              className="il-doc-row"
              style={{
                display: 'grid',
                gridTemplateColumns: '38px 1fr',
                gap: 14,
                alignItems: 'center',
                padding: '11px 8px',
                borderRadius: 12,
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: bg,
                  color: fg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                }}
              >
                {d.ext}
              </span>
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#1B2233',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {d.title}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: '#5A6478', marginTop: 2 }}>
                  {d.category} · Updated {d.updated}
                </span>
              </span>
            </a>
          )
        })}
        {docs.length === 0 && (
          <div style={{ gridColumn: '1/-1', padding: 28, textAlign: 'center', fontSize: 13.5, color: '#5A6478' }}>
            No documents match your search.
          </div>
        )}
      </div>
    </div>
  )
}

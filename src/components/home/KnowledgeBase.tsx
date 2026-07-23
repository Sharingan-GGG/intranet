'use client'

import React, { useMemo, useState } from 'react'

import { EXT_STYLE, KB_CATEGORIES, type KbDoc, type KbLink } from '@/lib/home'

const LinkIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M10 14a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.6 1.6M14 10a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.6-1.6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

/** Pop-up listing a document's links when it has more than one. */
export const LinksModal: React.FC<{ doc: { title: string; links?: KbLink[] }; onClose: () => void }> = ({
  doc,
  onClose,
}) => (
  <div
    onClick={onClose}
    onMouseDown={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    aria-label={`Links for ${doc.title}`}
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 200,
      background: 'rgba(17,34,68,0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: '#fff',
        borderRadius: 18,
        border: '1px solid var(--il-border)',
        boxShadow: '0 18px 50px rgba(17,46,129,0.22)',
        width: '100%',
        maxWidth: 420,
        padding: 22,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--il-brand)', letterSpacing: '-0.01em' }}>
          {doc.title}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--il-text-body)',
            fontSize: 20,
            lineHeight: 1,
            cursor: 'pointer',
            padding: 4,
          }}
        >
          ×
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(doc.links ?? []).map((l, i) => {
          let host = l.url
          try {
            host = new URL(l.url).hostname.replace(/^www\./, '')
          } catch {
            /* keep raw url */
          }
          return (
            <a
              key={`${l.url}-${i}`}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="il-doc-row"
              style={{
                display: 'grid',
                gridTemplateColumns: '30px 1fr',
                gap: 10,
                alignItems: 'center',
                padding: '9px 10px',
                borderRadius: 10,
                border: '1px solid var(--il-border)',
              }}
            >
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: '#EAF1FB',
                  color: '#2E66B8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <LinkIcon />
              </span>
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: 'var(--il-text)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {l.label || host}
                </span>
                {l.label && (
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--il-text-muted)', marginTop: 1 }}>{host}</span>
                )}
              </span>
            </a>
          )
        })}
      </div>
    </div>
  </div>
)

export const KnowledgeBase: React.FC<{ documents: KbDoc[]; categories?: string[]; heading?: string }> = ({
  documents,
  categories,
  heading = 'Knowledge base',
}) => {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('All')
  const [linksDoc, setLinksDoc] = useState<KbDoc | null>(null)

  // Tabs = every sub-category of the Knowledge Base parent category; falls back to the static list.
  const tabs = categories?.length ? ['All', ...categories] : KB_CATEGORIES

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
      className="il-knowledge-base"
      style={{
        background: '#fff',
        border: '1px solid var(--il-border)',
        borderRadius: 20,
        padding: 24,
        boxShadow: '0 1px 2px rgba(17,46,129,0.04)',
        scrollMarginTop: 82,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 15 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--il-brand)', letterSpacing: '-0.01em' }}>{heading}</h2>
        <div style={{ position: 'relative', width: '100%', maxWidth: 250, minWidth: 160 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', left: 12, top: 10 }}>
            <circle cx="11" cy="11" r="7" stroke="var(--il-text-body)" strokeWidth="2" />
            <path d="m20 20-3.5-3.5" stroke="var(--il-text-body)" strokeWidth="2" strokeLinecap="round" />
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
              background: 'var(--il-page-bg)',
              color: 'var(--il-text)',
              fontSize: 13,
              fontFamily: 'inherit',
              padding: '0 14px 0 33px',
              outline: 'none',
            }}
          />
        </div>
      </div>

      <div className="il-tabs" style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
        {tabs.map((name) => {
          const active = cat === name
          return (
            <button
              key={name}
              type="button"
              onClick={() => setCat(name)}
              style={{
                border: `1px solid ${active ? 'var(--il-brand)' : 'var(--il-border)'}`,
                background: active ? 'var(--il-brand)' : '#fff',
                color: active ? '#fff' : 'var(--il-text-body)',
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

      <div className="il-kb-docs" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 18px' }}>
        {docs.map((d, idx) => {
          const [bg, fg] = EXT_STYLE[d.ext]
          const multiLink = (d.links?.length ?? 0) > 1
          const rowStyle: React.CSSProperties = {
            display: 'grid',
            gridTemplateColumns: multiLink ? '38px 1fr 20px' : '38px 1fr',
            gap: 14,
            alignItems: 'center',
            padding: '11px 8px',
            borderRadius: 12,
            cursor: 'pointer',
          }
          const RowTag = multiLink ? 'button' : 'a'
          const rowProps = multiLink
            ? {
                type: 'button' as const,
                onClick: () => setLinksDoc(d),
                style: {
                  ...rowStyle,
                  border: 'none',
                  background: 'transparent',
                  font: 'inherit',
                  textAlign: 'left' as const,
                  width: '100%',
                },
              }
            : {
                href: d.href,
                target: '_blank',
                rel: 'noopener noreferrer',
                style: rowStyle,
              }
          return (
            <RowTag key={`${d.title}-${idx}`} className="il-doc-row" {...rowProps}>
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
                {d.ext === 'Folder' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-label="Folder">
                    <path
                      d="M3 7a2 2 0 0 1 2-2h4.2a2 2 0 0 1 1.6.8l1 1.4a2 2 0 0 0 1.6.8H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
                      fill="currentColor"
                    />
                  </svg>
                ) : (
                  d.ext
                )}
              </span>
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--il-text)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {d.title}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--il-text-body)', marginTop: 2 }}>
                  {d.category} · Updated {d.updated}
                  {multiLink && ` · ${d.links!.length} links`}
                </span>
              </span>
              {multiLink && (
                <span style={{ color: 'var(--il-text-muted)', display: 'flex' }} aria-label={`${d.links!.length} links`}>
                  <LinkIcon />
                </span>
              )}
            </RowTag>
          )
        })}
        {docs.length === 0 && (
          <div style={{ gridColumn: '1/-1', padding: 28, textAlign: 'center', fontSize: 13.5, color: 'var(--il-text-body)' }}>
            No documents match your search.
          </div>
        )}
      </div>

      {linksDoc && <LinksModal doc={linksDoc} onClose={() => setLinksDoc(null)} />}
    </div>
  )
}

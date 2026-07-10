'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useMemo, useState } from 'react'

import { SEARCH_POOL, SEARCH_TINT } from '@/lib/home'
import { AccountMenu, type AccountUser } from '@/components/intranet/AccountMenu'

const NAV = [
  { label: 'Home', href: '/' },
  { label: 'News', href: '/posts' },
  { label: 'Calendar', href: '/calendar' },
  { label: 'Knowledge Base', href: '/#knowledge-base' },
  { label: 'Support', href: '/#support' },
]

const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : !href.includes('#') && pathname.startsWith(href)

interface HeaderClientProps {
  /** Signed-in user, or null when not authenticated. */
  user?: AccountUser | null
}

export const HeaderClient: React.FC<HeaderClientProps> = ({ user = null }) => {
  const pathname = usePathname()
  const [q, setQ] = useState('')
  const [focused, setFocused] = useState(false)

  const query = q.trim().toLowerCase()
  const results = useMemo(
    () => (query ? SEARCH_POOL.filter((r) => r.title.toLowerCase().includes(query)).slice(0, 6) : []),
    [query],
  )
  const show = focused && query.length > 0

  return (
    <header
      className="il-root il-header"
      style={{
        background: '#112E81',
        display: 'flex',
        alignItems: 'center',
        gap: 28,
        padding: '0 32px',
        minHeight: 66,
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 'none' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ctg-icon.png" alt="CTG logo" width={34} height={34} style={{ display: 'block', borderRadius: '50%' }} />
        <div style={{ color: '#fff', fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em' }}>
          CTG <span style={{ fontWeight: 400, opacity: 0.75 }}>Intranet</span>
        </div>
      </Link>

      <nav style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, flex: '0 1 auto', maxWidth: '100%' }}>
        {NAV.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.label}
              href={item.href}
              className="il-nav-link"
              style={{
                color: active ? '#fff' : 'rgba(255,255,255,0.72)',
                fontSize: 14,
                fontWeight: active ? 600 : 500,
                padding: '8px 13px',
                borderRadius: 9,
                background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
              }}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', position: 'relative' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 340, minWidth: 150 }}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            style={{ position: 'absolute', left: 14, top: 11, opacity: 0.75, pointerEvents: 'none' }}
          >
            <circle cx="11" cy="11" r="7" stroke="#fff" strokeWidth="2" />
            <path d="m20 20-3.5-3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 180)}
            placeholder="Search the intranet…"
            aria-label="Search the intranet"
            className="il-search"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              height: 38,
              borderRadius: 19,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.12)',
              color: '#fff',
              fontSize: 13.5,
              fontFamily: 'inherit',
              padding: '0 16px 0 38px',
              outline: 'none',
            }}
          />
          {show && (
            <div
              role="listbox"
              aria-live="polite"
              style={{
                position: 'absolute',
                top: 46,
                left: 0,
                right: 0,
                background: '#fff',
                borderRadius: 14,
                boxShadow: '0 16px 40px rgba(17,46,129,0.22)',
                border: '1px solid #E3EBF1',
                overflow: 'hidden',
                padding: 6,
              }}
            >
              {results.map((r, i) => {
                const [fg, bg] = SEARCH_TINT[r.type]
                return (
                  <Link
                    key={`${r.type}-${i}`}
                    href={r.href}
                    className="il-doc-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 10px',
                      borderRadius: 9,
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        flex: 'none',
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: fg,
                        background: bg,
                        padding: '3px 7px',
                        borderRadius: 5,
                      }}
                    >
                      {r.type}
                    </span>
                    <span
                      style={{
                        fontSize: 13.5,
                        color: '#1B2233',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {r.title}
                    </span>
                  </Link>
                )
              })}
              {results.length === 0 && (
                <div style={{ padding: 12, fontSize: 13, color: '#5A6478' }}>No matches for “{q.trim()}”</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
        <AccountMenu user={user} />
      </div>
    </header>
  )
}

'use client'

import Link from 'next/link'
import { ChevronDown, LayoutDashboard, Menu, X } from 'lucide-react'
import { usePathname } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'

import { SEARCH_TINT } from '@/lib/home'
import { LinksModal } from '@/components/home/KnowledgeBase'
import { AccountMenu, type AccountUser } from '@/components/intranet/AccountMenu'
import { SchemeToggle } from '@/components/intranet/SchemeToggle'
import {
  fetchScopeResults,
  openSearchResult,
  SEARCH_SCOPE_ORDER,
  SEARCH_SCOPES,
  type SearchResult,
} from '@/lib/searchScopes'

type HeaderSearchResult = SearchResult & { type: string }

const RESULTS_PER_SCOPE = 3
const RESULTS_TOTAL = 8

export type HeaderNavItem = {
  label: string
  href: string
  newTab?: boolean
  subItems?: HeaderNavItem[]
}

const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : !href.includes('#') && pathname.startsWith(href)

interface HeaderClientProps {
  /** Nav items from the Header global. */
  navItems?: HeaderNavItem[]
  /** Signed-in user, or null when not authenticated. */
  user?: AccountUser | null
}

export const HeaderClient: React.FC<HeaderClientProps> = ({ navItems = [], user = null }) => {
  const pathname = usePathname()
  const [q, setQ] = useState('')
  const [focused, setFocused] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<number | null>(null)
  const [openMobileSub, setOpenMobileSub] = useState<number | null>(null)
  const navRef = useRef<HTMLElement>(null)
  const [results, setResults] = useState<HeaderSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  // A Knowledge Base result with multiple links opens a link-picker pop-up instead of navigating.
  const [linksResult, setLinksResult] = useState<HeaderSearchResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close the mobile menu whenever navigation happens.
  useEffect(() => {
    setMenuOpen(false)
    setOpenDropdown(null)
    setOpenMobileSub(null)
  }, [pathname])

  // Close an open desktop dropdown when clicking outside the nav.
  useEffect(() => {
    if (openDropdown === null) return
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [openDropdown])

  // Debounced live search across every collection (News, Pages, Events, EDMs, Knowledge Base) in parallel.
  useEffect(() => {
    const query = q.trim()
    if (!query) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const perScope = await Promise.all(
          SEARCH_SCOPE_ORDER.map(async (scope) => {
            const scopeResults = await fetchScopeResults(scope, query, { signal: ctrl.signal })
            return scopeResults
              .slice(0, RESULTS_PER_SCOPE)
              .map((r) => ({ ...r, type: SEARCH_SCOPES[scope].label }))
          }),
        )
        setResults(perScope.flat().slice(0, RESULTS_TOTAL))
      } catch {
        /* aborted or network error — ignore */
      } finally {
        setLoading(false)
      }
    }, 200)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q])

  const show = focused && q.trim().length > 0

  const go = (r: HeaderSearchResult) => {
    if ((r.links?.length ?? 0) > 1) {
      setLinksResult(r)
      return
    }
    openSearchResult(r.href)
  }

  return (
    <>
      <header
        className="il-root il-header"
        style={{
          background: 'var(--il-grad-footer)',
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
          <img
            src="/ctg-icon.png"
            alt="CTG logo"
            width={34}
            height={34}
            style={{ display: 'block', borderRadius: '50%' }}
          />
          <div style={{ color: '#fff', fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em' }}>
            CTG <span style={{ fontWeight: 400, opacity: 0.75 }}>Intranet</span>
          </div>
        </Link>

        <nav
          ref={navRef}
          className="il-nav-desktop"
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 4,
            flex: '0 1 auto',
            maxWidth: '100%',
          }}
        >
          {navItems.map((item, i) => {
            const active = isActive(pathname, item.href)
            const hasSubItems = (item.subItems?.length ?? 0) > 0
            const dropdownOpen = openDropdown === i

            if (!hasSubItems) {
              return (
                <Link
                  key={`${item.href}-${i}`}
                  href={item.href}
                  target={item.newTab ? '_blank' : undefined}
                  rel={item.newTab ? 'noopener noreferrer' : undefined}
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
            }

            return (
              <div key={`${item.href}-${i}`} style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="il-nav-link"
                  aria-haspopup="true"
                  aria-expanded={dropdownOpen}
                  onClick={() => setOpenDropdown(dropdownOpen ? null : i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    color: active ? '#fff' : 'rgba(255,255,255,0.72)',
                    fontSize: 14,
                    fontWeight: active ? 600 : 500,
                    padding: '8px 13px',
                    borderRadius: 9,
                    background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {item.label}
                  <ChevronDown
                    size={14}
                    style={{
                      transform: dropdownOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s',
                    }}
                  />
                </button>
                {dropdownOpen && (
                  <div
                    role="menu"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: 6,
                      minWidth: 190,
                      background: 'var(--il-surface)',
                      border: '1px solid var(--il-border)',
                      borderRadius: 12,
                      boxShadow: '0 16px 40px rgba(17,46,129,0.22)',
                      padding: 6,
                      zIndex: 50,
                    }}
                  >
                    {item.subItems!.map((sub, si) => (
                      <Link
                        key={`${sub.href}-${si}`}
                        href={sub.href}
                        target={sub.newTab ? '_blank' : undefined}
                        rel={sub.newTab ? 'noopener noreferrer' : undefined}
                        role="menuitem"
                        onClick={() => setOpenDropdown(null)}
                        style={{
                          display: 'block',
                          padding: '9px 12px',
                          borderRadius: 8,
                          fontSize: 13.5,
                          fontWeight: 500,
                          color: 'var(--il-text)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div
          className="il-search-wrap"
          style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', position: 'relative' }}
        >
          <div style={{ position: 'relative', width: '100%', maxWidth: 340, minWidth: 150 }}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              style={{
                position: 'absolute',
                left: 14,
                top: 11,
                opacity: 0.75,
                pointerEvents: 'none',
              }}
            >
              <circle cx="11" cy="11" r="7" stroke="#fff" strokeWidth="2" />
              <path d="m20 20-3.5-3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 180)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && results[0]) {
                  e.preventDefault()
                  go(results[0])
                } else if (e.key === 'Escape') {
                  inputRef.current?.blur()
                }
              }}
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
                  background: 'var(--il-surface)',
                  borderRadius: 14,
                  boxShadow: '0 16px 40px rgba(17,46,129,0.22)',
                  border: '1px solid var(--il-border)',
                  overflow: 'hidden',
                  padding: 6,
                }}
              >
                {loading && (
                  <div style={{ padding: 12, fontSize: 13, color: 'var(--il-text-body)' }}>
                    Searching…
                  </div>
                )}
                {!loading &&
                  results.map((r, i) => {
                    const [fg, bg] = SEARCH_TINT[r.type] ?? ['#4A5570', '#EEF2F9']
                    return (
                      <button
                        key={`${r.type}-${i}`}
                        type="button"
                        onClick={() => go(r)}
                        className="il-doc-row"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          width: '100%',
                          textAlign: 'left',
                          padding: '9px 10px',
                          borderRadius: 9,
                          border: 'none',
                          background: 'transparent',
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
                            color: 'var(--il-text)',
                            fontWeight: 500,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {r.title}
                          {(r.links?.length ?? 0) > 1 && ` · ${r.links!.length} links`}
                        </span>
                      </button>
                    )
                  })}
                {!loading && results.length === 0 && (
                  <div style={{ padding: 12, fontSize: 13, color: 'var(--il-text-body)' }}>
                    No matches for “{q.trim()}”
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          className="il-header-actions"
          style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <button
            type="button"
            className="il-burger"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={19} strokeWidth={2.2} /> : <Menu size={19} strokeWidth={2.2} />}
          </button>
          {Boolean(
            user?.roles?.some((r) => r === 'super-admin' || r === 'admin' || r === 'editor'),
          ) && (
            <Link
              href="/admin"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Admin portal"
              title="Admin portal"
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--il-accent)',
                color: 'var(--il-on-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none',
                boxShadow: 'var(--il-action-pop)',
              }}
            >
              <LayoutDashboard size={17} strokeWidth={2.2} />
            </Link>
          )}
          <SchemeToggle />
          <AccountMenu user={user} />
        </div>

        {/* Mobile nav panel (shown by .il-mobile-menu.open below 900px) */}
        <nav className={`il-mobile-menu${menuOpen ? ' open' : ''}`} aria-label="Mobile navigation">
          {navItems.map((item, i) => {
            const active = isActive(pathname, item.href)
            const hasSubItems = (item.subItems?.length ?? 0) > 0
            const subOpen = openMobileSub === i

            return (
              <div key={`${item.href}-${i}`}>
                <div style={{ display: 'flex', alignItems: 'stretch' }}>
                  <Link
                    href={item.href}
                    target={item.newTab ? '_blank' : undefined}
                    rel={item.newTab ? 'noopener noreferrer' : undefined}
                    onClick={() => setMenuOpen(false)}
                    style={{
                      flex: 1,
                      color: active ? '#fff' : 'rgba(255,255,255,0.78)',
                      fontSize: 15,
                      fontWeight: active ? 700 : 500,
                      padding: '11px 12px',
                      borderRadius: 10,
                      background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                    }}
                  >
                    {item.label}
                  </Link>
                  {hasSubItems && (
                    <button
                      type="button"
                      aria-label={`Toggle ${item.label} submenu`}
                      aria-expanded={subOpen}
                      onClick={() => setOpenMobileSub(subOpen ? null : i)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255,255,255,0.78)',
                        padding: '0 12px',
                        cursor: 'pointer',
                      }}
                    >
                      <ChevronDown
                        size={18}
                        style={{
                          transform: subOpen ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.15s',
                        }}
                      />
                    </button>
                  )}
                </div>
                {hasSubItems && subOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: 16 }}>
                    {item.subItems!.map((sub, si) => (
                      <Link
                        key={`${sub.href}-${si}`}
                        href={sub.href}
                        target={sub.newTab ? '_blank' : undefined}
                        rel={sub.newTab ? 'noopener noreferrer' : undefined}
                        onClick={() => setMenuOpen(false)}
                        style={{
                          color: 'rgba(255,255,255,0.7)',
                          fontSize: 14,
                          fontWeight: 500,
                          padding: '9px 12px',
                          borderRadius: 10,
                        }}
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
      </header>
      {linksResult && <LinksModal doc={linksResult} onClose={() => setLinksResult(null)} />}
    </>
  )
}

'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { LinksModal } from '@/components/home/KnowledgeBase'
import {
  fetchScopeResults,
  openSearchResult,
  SEARCH_SCOPE_ORDER,
  SEARCH_SCOPES,
  type SearchResult,
  type SearchScopeKey,
} from '@/lib/searchScopes'

type Scope = SearchScopeKey
type Result = SearchResult

const SCOPES = SEARCH_SCOPES
const SCOPE_ORDER = SEARCH_SCOPE_ORDER

export const SearchModal: React.FC = () => {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<Scope>('news')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(false)
  // A KB result with multiple links opens a link-picker pop-up instead of navigating.
  const [linksResult, setLinksResult] = useState<Result | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const openWith = useCallback((s: Scope) => {
    setScope(s)
    setQuery('')
    setResults([])
    setActive(0)
    setOpen(true)
  }, [])

  // Global shortcuts: Ctrl+Shift+N (news) / E (events) / K (knowledge base), Ctrl+K to open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        const key = e.key.toLowerCase()
        const match = (Object.keys(SCOPES) as Scope[]).find((s) => SCOPES[s].shortcut.toLowerCase() === key)
        if (match) {
          e.preventDefault()
          openWith(match)
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !e.shiftKey) {
        e.preventDefault()
        openWith('news')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openWith])

  // Focus the input when the modal opens.
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Clear stale results immediately on scope switch so a News/Event result never flashes under a different tab
  // while the new scope's fetch is still debouncing.
  useEffect(() => {
    setResults([])
    setActive(0)
  }, [scope])

  // Debounced fetch of results for the current scope + query.
  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (!q) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const mapped = await fetchScopeResults(scope, q, { signal: ctrl.signal })
        // Soonest next occurrence first (events); other scopes have no sortKey and keep API order.
        mapped.sort((a, b) => (a.sortKey ?? 0) - (b.sortKey ?? 0))
        setResults(mapped)
        setActive(0)
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
  }, [open, scope, query])

  const go = useCallback((r: Result) => {
    if ((r.links?.length ?? 0) > 1) {
      setLinksResult(r)
      return
    }
    setOpen(false)
    openSearchResult(r.href)
  }, [])

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false)
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault()
      go(results[active])
    } else if (e.key === 'Tab') {
      // Cycle scope with Tab for quick switching.
      e.preventDefault()
      const idx = SCOPE_ORDER.indexOf(scope)
      const next = SCOPE_ORDER[(idx + (e.shiftKey ? SCOPE_ORDER.length - 1 : 1)) % SCOPE_ORDER.length]
      setScope(next)
    }
  }

  const placeholder = useMemo(() => `Search ${SCOPES[scope].label}…`, [scope])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onMouseDown={() => setOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(9,20,55,0.45)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '12vh 16px 16px',
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 620,
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 24px 60px rgba(9,20,55,0.35)',
          overflow: 'hidden',
        }}
      >
        {/* Scope tabs */}
        <div style={{ display: 'flex', gap: 6, padding: '12px 14px 0' }}>
          {SCOPE_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                padding: '6px 12px',
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                color: scope === s ? '#fff' : '#4A5570',
                background: scope === s ? '#2D57D3' : '#EEF2F9',
              }}
            >
              {SCOPES[s].label}
              <span style={{ opacity: 0.65, marginLeft: 6, fontWeight: 600 }}>⌃⇧{SCOPES[s].shortcut}</span>
            </button>
          ))}
        </div>

        {/* Search input */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #EDF1F7' }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder={placeholder}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              fontSize: 17,
              color: 'var(--il-text)',
              background: 'transparent',
            }}
          />
        </div>

        {/* Results */}
        <div style={{ maxHeight: '48vh', overflowY: 'auto', padding: 8 }}>
          {loading && <div style={{ padding: '14px 12px', color: 'var(--il-text-muted)', fontSize: 13 }}>Searching…</div>}
          {!loading && query.trim() && results.length === 0 && (
            <div style={{ padding: '14px 12px', color: 'var(--il-text-muted)', fontSize: 13 }}>
              No {SCOPES[scope].label} results for “{query.trim()}”.
            </div>
          )}
          {!loading && !query.trim() && (
            <div style={{ padding: '14px 12px', color: 'var(--il-text-muted)', fontSize: 13 }}>
              Type to search {SCOPES[scope].label}. Use Tab to switch, ↑↓ to navigate, Enter to open.
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => go(r)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 2,
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                background: i === active ? '#EEF2F9' : 'transparent',
              }}
            >
              <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--il-text)' }}>{r.title}</span>
              <span style={{ fontSize: 12, color: 'var(--il-text-muted)' }}>
                {r.sub}
                {(r.links?.length ?? 0) > 1 && ` · ${r.links!.length} links`}
              </span>
            </button>
          ))}
        </div>
      </div>

      {linksResult && <LinksModal doc={linksResult} onClose={() => setLinksResult(null)} />}
    </div>
  )
}

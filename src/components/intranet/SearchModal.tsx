'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { LinksModal } from '@/components/home/KnowledgeBase'
import type { KbLink } from '@/lib/home'

type Scope = 'events' | 'news' | 'kb'

type Result = { title: string; sub: string; href: string; sortKey?: number; links?: KbLink[] }

const mediaUrl = (file: unknown): string | null => {
  const f = file as { url?: string } | null
  return f && typeof f === 'object' && f.url ? f.url : null
}

const dateFmt = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })

/** Next occurrence of an event on/after today — mirrors the recurrence expansion in lib/homeData. */
const nextOccurrence = (d: any): Date | null => {
  if (!d.date) return null
  const date = new Date(d.date)
  if (Number.isNaN(date.getTime())) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const stepMap: Record<string, { every: number; unit: string }> = {
    weekly: { every: 1, unit: 'weeks' },
    fortnightly: { every: 2, unit: 'weeks' },
    monthly: { every: 1, unit: 'months' },
    quarterly: { every: 3, unit: 'months' },
    biannually: { every: 6, unit: 'months' },
    annually: { every: 1, unit: 'years' },
  }
  const step =
    d.repeat === 'custom'
      ? { every: Math.max(1, d.repeatEvery ?? 1), unit: d.repeatFrequency ?? 'weeks' }
      : stepMap[d.repeat]
  if (!step) return date // non-repeating: the stored date is the only occurrence

  for (let i = 0; date < today && i < 500; i++) {
    if (step.unit === 'days') date.setDate(date.getDate() + step.every)
    else if (step.unit === 'weeks') date.setDate(date.getDate() + step.every * 7)
    else if (step.unit === 'months') date.setMonth(date.getMonth() + step.every)
    else if (step.unit === 'years') date.setFullYear(date.getFullYear() + step.every)
    else break
  }
  return date
}

const localDateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const SCOPES: Record<
  Scope,
  { label: string; shortcut: string; endpoint: (q: string) => string; map: (d: any) => Result }
> = {
  events: {
    label: 'Events',
    shortcut: 'E',
    endpoint: (q) =>
      `/api/events?where[or][0][title][like]=${q}&where[or][1][description][like]=${q}&limit=8&depth=0&sort=date`,
    map: (d) => {
      const next = nextOccurrence(d)
      return {
        title: d.title,
        sub: [d.location, next ? dateFmt.format(next) : null].filter(Boolean).join(' · ') || 'Event',
        href: next ? `/calendar?date=${localDateKey(next)}` : '/calendar',
        sortKey: next?.getTime(),
      }
    },
  },
  news: {
    label: 'News',
    shortcut: 'B',
    endpoint: (q) =>
      `/api/posts?where[or][0][title][like]=${q}&where[or][1][meta.description][like]=${q}&limit=8&depth=0&sort=-publishedAt`,
    map: (d) => ({ title: d.title, sub: 'Post', href: `/posts/${d.slug}` }),
  },
  kb: {
    label: 'Knowledge Base',
    shortcut: 'K',
    endpoint: (q) =>
      `/api/knowledge-base?where[or][0][title][like]=${q}&where[or][1][description][like]=${q}&limit=8&depth=1`,
    map: (d) => {
      const absolute = (url: string): string => (/^https?:\/\//i.test(url) ? url : `https://${url}`)
      const links: KbLink[] = (d.links ?? []).map((l: any) => ({
        label: l.label ?? null,
        url: absolute(l.url),
      }))
      return {
        title: d.title,
        sub: (typeof d.category === 'object' ? d.category?.title : d.category) ?? 'Document',
        href: mediaUrl(d.file) ?? links[0]?.url ?? '#',
        links,
      }
    },
  },
}

const SCOPE_ORDER: Scope[] = ['news', 'events', 'kb']

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
        const res = await fetch(SCOPES[scope].endpoint(encodeURIComponent(q)), {
          signal: ctrl.signal,
          credentials: 'same-origin',
        })
        if (!res.ok) {
          setResults([])
        } else {
          const data = await res.json()
          const mapped: Result[] = (data.docs ?? []).map(SCOPES[scope].map)
          // Soonest next occurrence first (events); other scopes have no sortKey and keep API order.
          mapped.sort((a, b) => (a.sortKey ?? 0) - (b.sortKey ?? 0))
          setResults(mapped)
        }
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
    if (r.href && r.href !== '#') window.location.assign(r.href)
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
              color: '#1B2233',
              background: 'transparent',
            }}
          />
        </div>

        {/* Results */}
        <div style={{ maxHeight: '48vh', overflowY: 'auto', padding: 8 }}>
          {loading && <div style={{ padding: '14px 12px', color: '#8A94A6', fontSize: 13 }}>Searching…</div>}
          {!loading && query.trim() && results.length === 0 && (
            <div style={{ padding: '14px 12px', color: '#8A94A6', fontSize: 13 }}>
              No {SCOPES[scope].label} results for “{query.trim()}”.
            </div>
          )}
          {!loading && !query.trim() && (
            <div style={{ padding: '14px 12px', color: '#8A94A6', fontSize: 13 }}>
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
              <span style={{ fontSize: 14.5, fontWeight: 600, color: '#1B2233' }}>{r.title}</span>
              <span style={{ fontSize: 12, color: '#8A94A6' }}>
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

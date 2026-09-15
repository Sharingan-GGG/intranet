'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Per-browser "★ Top" page list, scoped to a domain.
 *
 * Deliberately still localStorage rather than a column: a favourite is one
 * person's shortlist on one machine, nobody else ever reads it, and the portal
 * treated it the same way. Every access is wrapped because storage throws in a
 * private window and can come back empty after a clear — the star just stops
 * persisting rather than taking the Dashboard down.
 */
const KEY = 'audit-hub-favourites'

type Store = Record<string, string[]>

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Store) : {}
  } catch {
    return {}
  }
}

function write(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // Out of quota or blocked — the in-memory set still works for this session.
  }
}

export function useAuditFavourites(domain: string) {
  const [favourites, setFavourites] = useState<Set<string>>(new Set())

  // Read after mount, never during render: the server has no localStorage, and
  // seeding state from it directly would mismatch the hydrated markup.
  useEffect(() => {
    setFavourites(new Set(read()[domain] ?? []))
  }, [domain])

  const toggle = useCallback(
    (url: string) => {
      setFavourites((current) => {
        const next = new Set(current)
        if (next.has(url)) next.delete(url)
        else next.add(url)
        const store = read()
        store[domain] = [...next]
        write(store)
        return next
      })
    },
    [domain],
  )

  return { favourites, toggle }
}

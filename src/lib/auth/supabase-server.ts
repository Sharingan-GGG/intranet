import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const URL = process.env.NEXT_PUBLIC_SUPABASE_AUTH_URL!
const KEY = process.env.NEXT_PUBLIC_SUPABASE_AUTH_PUBLISHABLE_KEY!

/**
 * Server client bound to the request's cookie store, so exchangeCodeForSession() and token
 * refreshes can write the session back. See supabase-browser.ts for why this points at a
 * different project from src/lib/supabase/*.
 */
export async function createAuthServerClient() {
  const store = await cookies()
  return createServerClient(URL, KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, options, value } of list) store.set(name, value, options)
        } catch {
          // Called from a Server Component, where cookies are read-only. Safe to ignore:
          // the middleware refreshes the session on the next request.
        }
      },
    },
  })
}

const parseCookieHeader = (header: string) =>
  header
    .split(';')
    .map((part) => {
      const index = part.indexOf('=')
      if (index === -1) return null
      return { name: part.slice(0, index).trim(), value: part.slice(index + 1).trim() }
    })
    .filter((cookie): cookie is { name: string; value: string } => cookie !== null)

/**
 * Read-only client built from a raw Cookie header.
 *
 * Payload's auth strategies receive a Web `Headers` object rather than Next's cookie store,
 * so the session has to be reconstructed from the header. Writes are dropped — a strategy
 * must not mutate cookies mid-request.
 */
export function createAuthClientFromCookieHeader(header: null | string) {
  const cookies = header ? parseCookieHeader(header) : []
  return createServerClient(URL, KEY, {
    cookies: { getAll: () => cookies, setAll: () => {} },
  })
}

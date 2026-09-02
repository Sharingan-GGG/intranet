'use client'

import { createBrowserClient } from '@supabase/ssr'

import { AUTH_COOKIE_ENCODING } from './session'

/**
 * Browser client for the *intranet* Supabase project, which is the single SSO provider.
 *
 * Deliberately separate from src/lib/supabase/client.ts: that one points at the Departure
 * project behind the Pre-Departure module and holds none of these users. The two must never
 * be swapped, hence the distinct NEXT_PUBLIC_SUPABASE_AUTH_* variables.
 *
 * `auth` is passed through for the login page, which needs autoRefreshToken off — see the
 * comment in src/components/LoginScene/index.tsx. Everywhere else omits it and gets the
 * defaults. The cookie encoding is deliberately not overridable: every client has to agree
 * on it or they cannot read each other's cookies (see src/lib/auth/session.ts).
 */
export function createAuthBrowserClient(auth?: { autoRefreshToken?: boolean }) {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_AUTH_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_AUTH_PUBLISHABLE_KEY!,
    { auth, cookies: { encode: AUTH_COOKIE_ENCODING } },
  )
}

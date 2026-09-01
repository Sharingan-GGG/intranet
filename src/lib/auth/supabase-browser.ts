'use client'

import { createBrowserClient } from '@supabase/ssr'

import { AUTH_COOKIE_OPTIONS } from './session'

/**
 * Browser client for the *intranet* Supabase project, which is the single SSO provider.
 *
 * Deliberately separate from src/lib/supabase/client.ts: that one points at the Departure
 * project behind the Pre-Departure module and holds none of these users. The two must never
 * be swapped, hence the distinct NEXT_PUBLIC_SUPABASE_AUTH_* variables.
 */
export function createAuthBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_AUTH_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_AUTH_PUBLISHABLE_KEY!,
    { cookieOptions: AUTH_COOKIE_OPTIONS },
  )
}

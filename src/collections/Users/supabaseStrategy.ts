import type { AuthStrategy } from 'payload'

import { createAuthClientFromCookieHeader } from '@/lib/auth/supabase-server'

/**
 * Lets Payload accept a Supabase Auth session, so one sign-in covers the site, the /admin
 * panel and the Pre-Departure module.
 *
 * Users are matched by **email**, not by ID. Payload's user IDs predate Supabase (ten UUIDs
 * plus the legacy `1`) and cannot be rewritten to Supabase's `auth.users.id` without
 * breaking every `*_rels` row that points at them. Email is the stable join key, and the
 * `enforce_workspace_domain` trigger on `auth.users` guarantees it is a Workspace address.
 *
 * This strategy only ever reads. Provisioning a first-time user happens once, in
 * /auth/callback, rather than as a side effect of an arbitrary GET.
 *
 * Returning `{ user: null }` is not a failure — it lets Payload fall through to the
 * remaining strategies, which is what keeps email/password login working for admins.
 */
export const supabaseStrategy: AuthStrategy = {
  name: 'supabase',
  authenticate: async ({ headers, payload }) => {
    const cookie = headers.get('cookie')
    if (!cookie || !cookie.includes('sb-')) return { user: null }

    try {
      const supabase = createAuthClientFromCookieHeader(cookie)

      // getClaims() verifies the JWT locally against the project's JWKS when the project
      // uses asymmetric signing keys, avoiding a round trip to the auth server on every
      // request — which matters here, as the project is in Seoul.
      const { data, error } = await supabase.auth.getClaims()
      const email = typeof data?.claims?.email === 'string' ? data.claims.email : null
      if (error || !email) return { user: null }

      const { docs } = await payload.find({
        collection: 'users',
        depth: 0,
        limit: 1,
        overrideAccess: true,
        pagination: false,
        where: { email: { equals: email.toLowerCase() } },
      })

      const user = docs[0]
      if (!user) return { user: null }

      return { user: { ...user, collection: 'users' } }
    } catch {
      // A transient auth-server or network failure must not take the whole app down; the
      // request simply proceeds unauthenticated and the access control layer rejects it.
      return { user: null }
    }
  },
}

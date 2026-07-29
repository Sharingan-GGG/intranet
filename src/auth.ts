import payloadConfig from '@payload-config'
import NextAuth from 'next-auth'
import { getPayload } from 'payload'
import { withPayload } from 'payload-authjs'

import { authConfig } from './auth.config'

// The pure, edge-safe domain/verification check from auth.config.ts.
const domainSignIn = authConfig.callbacks?.signIn

/**
 * SSO now spans two Workspace domains (see ALLOWED_DOMAINS). The local-part
 * (before the @) identifies the person: if someone signs in as
 * `giovanni@roundabouttravel.com.au` while `giovanni@complextravel.com.au`
 * already exists, we block the new login and point them at the existing
 * account rather than silently creating a duplicate user. This runs here in
 * auth.ts (Node runtime) — not auth.config.ts — because it needs a Payload DB
 * lookup, and auth.config.ts is bundled into the edge middleware.
 */
export const { handlers, signIn, signOut, auth } = NextAuth(
  withPayload(
    {
      ...authConfig,
      callbacks: {
        ...authConfig.callbacks,
        signIn: async (params) => {
          // 1. Domain allow-list + verified email.
          if (domainSignIn && (await domainSignIn(params)) === false) {
            return false
          }

          const email = params.profile?.email?.toLowerCase()
          if (!email || !email.includes('@')) return false
          const localPart = email.split('@')[0]

          // 2. Block if the same local-part already exists on another domain.
          const payload = await getPayload({ config: payloadConfig })
          const { docs } = await payload.find({
            collection: 'users',
            where: { email: { like: `${localPart}@` } },
            limit: 100,
            depth: 0,
            pagination: false,
          })

          const clash = docs.find((u) => {
            const other = typeof u.email === 'string' ? u.email.toLowerCase() : ''
            // Same person (local-part), different account (different full email).
            return other.split('@')[0] === localPart && other !== email
          })

          if (clash) {
            return `/login?error=DuplicateAccount&existing=${encodeURIComponent(clash.email)}`
          }

          return true
        },
      },
    },
    { payloadConfig },
  ),
)

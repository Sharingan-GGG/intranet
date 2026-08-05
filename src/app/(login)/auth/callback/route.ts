import config from '@payload-config'
import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'

import { createAuthServerClient } from '@/lib/auth/supabase-server'

/**
 * Completes the Supabase Google sign-in and makes sure the person has a Payload user.
 *
 * Provisioning lives here rather than in the auth strategy so it runs exactly once, at
 * sign-in, instead of as a side effect of an arbitrary request. The domain allow-list and
 * the cross-domain duplicate check are already enforced by the `enforce_workspace_domain`
 * trigger on `auth.users`, so anything arriving here with a session is legitimate.
 */
const loginRedirect = (origin: string, error: string, existing?: string) => {
  const url = new URL('/login', origin)
  url.searchParams.set('error', error)
  if (existing) url.searchParams.set('existing', existing)
  return NextResponse.redirect(url)
}

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url)
  const next = searchParams.get('next')
  const code = searchParams.get('code')

  // Supabase reports a rejected sign-in by redirecting here with an error, not a code. A
  // trigger that raises is surfaced as the opaque "Database error saving new user", so it is
  // translated back into the reason it is actually raised for.
  const errorDescription = searchParams.get('error_description')
  if (searchParams.get('error') || errorDescription) {
    const blockedByTrigger = errorDescription?.toLowerCase().includes('database error')
    return loginRedirect(origin, blockedByTrigger ? 'AccessDenied' : 'Default')
  }

  if (!code) return loginRedirect(origin, 'Default')

  const supabase = await createAuthServerClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  const email = data?.user?.email?.toLowerCase()

  if (error || !email) return loginRedirect(origin, 'Default')

  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'users',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    where: { email: { equals: email } },
  })

  if (!docs[0]) {
    // First sign-in for a new staff member. Mirrors what payload-authjs did: create the
    // record with the lowest privilege and let an admin raise it.
    const metadata = data.user?.user_metadata ?? {}
    await payload.create({
      collection: 'users',
      data: {
        name:
          (typeof metadata.full_name === 'string' && metadata.full_name) ||
          (typeof metadata.name === 'string' && metadata.name) ||
          email.split('@')[0],
        email,
        // Payload refuses a create() into an auth collection without one. This account signs
        // in through Supabase, so the value is never used — random rather than blank so it
        // cannot be guessed, and unknown to everyone including the account holder.
        password: randomBytes(24).toString('base64url'),
        roles: ['user'],
      },
      overrideAccess: true,
    })
  }

  // Only same-site paths, so `next` cannot be used to bounce a signed-in user off-site.
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
  return NextResponse.redirect(new URL(target, origin))
}

import type { CollectionBeforeDeleteHook } from 'payload'

import { createServiceClient } from '@/lib/supabase/server'

/**
 * Deleting a Payload user must also delete their Supabase Auth user, otherwise the account
 * still signs in with Google and /auth/callback simply re-provisions a fresh Payload user
 * for them (with roles reset to ["user"]) — a "deleted" account that quietly comes back.
 *
 * This runs `beforeDelete` rather than `afterDelete` so that a failure to remove the auth
 * user aborts the whole delete and surfaces in the admin panel. The alternative leaves the
 * Payload row gone and the credential live, which is the one outcome that must not happen.
 *
 * Auth users are matched by **email**, the same join key the auth strategy uses — Payload's
 * IDs predate Supabase and don't correspond to `auth.users.id`. GoTrue has no lookup-by-email
 * admin call, hence the paged scan; the directory is small enough that one page covers it.
 */
export const deleteSupabaseAuthUser: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const doc = await req.payload.findByID({
    collection: 'users',
    id,
    depth: 0,
    overrideAccess: true,
  })
  const email = doc?.email?.toLowerCase()
  if (!email) return

  const supabase = createServiceClient()
  const perPage = 1000

  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`Could not reach Supabase Auth to delete ${email}: ${error.message}`)

    const match = data.users.find((u) => u.email?.toLowerCase() === email)
    if (match) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(match.id)
      if (deleteError) {
        throw new Error(`Failed to delete the Supabase Auth user for ${email}: ${deleteError.message}`)
      }
      return
    }

    // No auth user for this email — nothing to revoke (e.g. the legacy password-only
    // superAdmin, or someone who never signed in). Let the Payload delete proceed.
    if (data.users.length < perPage) return
  }
}

import 'server-only'

import { createClient } from '@supabase/supabase-js'

/**
 * Looks up *other* people — the person a PNR was moved to, who added a queue row, the full
 * staff list. Distinct from getPreDepartureUser(), which answers "who is signed in".
 *
 * Reads Payload's `users` in the `public` schema, so it needs its own client: the one in
 * supabase/server.ts is pinned to `pre_departure`. Rows come back shaped like the `profiles`
 * rows this module used to read, so call sites keep using `full_name` and `email`.
 */
export type DirectoryEntry = {
  department: null | string
  email: string
  full_name: null | string
  id: string
}

const directoryClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_AUTH_URL!,
    process.env.SUPABASE_AUTH_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

type UserRow = {
  departments?: { name: null | string } | null
  email: string
  id: string
  name: null | string
}

// `department` was a text column on profiles; on Payload it is a relationship, so the name is
// joined through rather than read directly.
//
// The FK is named explicitly because two relationships exist between these tables —
// users.department_id -> departments.id, and departments.lead_id -> users.id. Left ambiguous,
// PostgREST refuses to pick one (PGRST201, HTTP 300) and the whole query returns nothing,
// which shows up as an empty "Transfer to" list rather than an error.
const SELECT = 'id, email, name, departments!users_department_id_departments_id_fk(name)'

const toEntry = (row: UserRow): DirectoryEntry => ({
  department: row.departments?.name ?? null,
  email: row.email,
  full_name: row.name,
  id: String(row.id),
})

/** Everyone in the intranet. There is no `status` column — a Payload user is always active. */
export async function listDirectory(): Promise<DirectoryEntry[]> {
  const { data } = await directoryClient()
    .from('users')
    .select(SELECT)
    .order('name', { ascending: true })
  return ((data ?? []) as unknown as UserRow[]).map(toEntry)
}

/** Several users at once, keyed by ID — avoids a query per row when naming queue owners. */
export async function findDirectoryEntries(ids: string[]): Promise<Map<string, DirectoryEntry>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return new Map()
  const { data } = await directoryClient().from('users').select(SELECT).in('id', unique)
  return new Map(
    ((data ?? []) as unknown as UserRow[]).map((row) => [String(row.id), toEntry(row)]),
  )
}

/** A single user by Payload ID, or null when the ID no longer resolves. */
export async function findDirectoryEntry(id: null | string): Promise<DirectoryEntry | null> {
  if (!id) return null
  const { data } = await directoryClient()
    .from('users')
    .select(SELECT)
    .eq('id', id)
    .maybeSingle()
  return data ? toEntry(data as unknown as UserRow) : null
}

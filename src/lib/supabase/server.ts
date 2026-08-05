import { createClient } from "@supabase/supabase-js"

import type { Database } from "./database.types"

/**
 * Service-role client for server-side API routes only.
 * Bypasses RLS — never import this in browser/client components.
 *
 * Points at the *intranet* project, where the Pre-Departure tables now live in their own
 * `pre_departure` schema alongside Payload's `public`. The schema is set here rather than
 * per-query so every existing `.from("pnr_queue")` call keeps working unchanged.
 *
 * Note `pre_departure` must be listed under Exposed schemas in the project's API settings,
 * or PostgREST returns "The schema must be one of the following".
 */
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_AUTH_URL!,
    process.env.SUPABASE_AUTH_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: 'pre_departure',
      },
    }
  )
}

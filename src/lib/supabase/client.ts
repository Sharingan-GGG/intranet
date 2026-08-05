import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "./database.types"

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_AUTH_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_AUTH_PUBLISHABLE_KEY!,
    { db: { schema: "pre_departure" } }
  )
}

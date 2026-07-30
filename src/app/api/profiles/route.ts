import { NextResponse } from "next/server"
import { unstable_cache, revalidateTag } from "next/cache"

import { createSSRClient } from "@/lib/supabase/ssr-client"
import { createServiceClient } from "@/lib/supabase/server"

const getActiveProfiles = unstable_cache(
  async () => {
    const db = createServiceClient()
    const { data: profiles, error } = await db
      .from("profiles")
      .select("id, full_name, email, department")
      .eq("status", "active")
      .order("department", { ascending: true })
      .order("full_name", { ascending: true })

    if (error) {
      throw new Error("Failed to fetch profiles")
    }
    return profiles ?? []
  },
  ["profiles"],
  { revalidate: 3600, tags: ["profiles"] }
)

export async function GET() {
  const ssrClient = await createSSRClient()
  const {
    data: { user },
  } = await ssrClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const profiles = await getActiveProfiles()
    return NextResponse.json(profiles)
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 })
  }
}

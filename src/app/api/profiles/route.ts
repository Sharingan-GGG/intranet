import { NextResponse } from "next/server"
import { unstable_cache, revalidateTag } from "next/cache"

import { listDirectory } from "@/lib/pre-departure-directory"
import { getPreDepartureUser } from "@/lib/pre-departure-user"

const getActiveProfiles = unstable_cache(
  // Every Payload user is active — the `status` column profiles had has no equivalent, so
  // there is nothing left to filter on here.
  async () => listDirectory(),
  ["profiles"],
  { revalidate: 3600, tags: ["profiles"] }
)

export async function GET() {
  const profile = await getPreDepartureUser()
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const profiles = await getActiveProfiles()
    return NextResponse.json(profiles)
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 })
  }
}

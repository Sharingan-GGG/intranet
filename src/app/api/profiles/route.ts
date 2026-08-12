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

    // IT accounts are devs/admins testing the queue, not agents working PNRs — they'd just
    // clutter the "Scanned by" picker for everyone else, so hide IT teammates from view except
    // the signed-in user themselves.
    const visible = profiles.filter(
      (p) => p.department !== "IT" || p.id === profile.id
    )

    // Super admins switch between OUs freely, so they see everyone Pre-Departure grants
    // access to. Everyone else — admin or user — is scoped to their own OU: no department
    // means no teammates to see.
    if (profile.role === "super_admin") {
      return NextResponse.json(visible)
    }
    const ownDepartment = visible.filter(
      (p) => profile.departmentId !== null && p.departmentId === profile.departmentId
    )
    return NextResponse.json(ownDepartment)
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 })
  }
}

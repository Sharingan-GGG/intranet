import { type NextRequest, NextResponse } from "next/server"

import { loadDashboard } from "@/lib/pnr-dashboard-data"

export type { DashboardApiResponse } from "@/lib/pnr-dashboard-data"

// Queue contents change on every scan, move and delete, so this must never be
// served from a cache.
export const dynamic = "force-dynamic"
export const revalidate = 0

/**
 * GET /api/legacy/dashboard?pnr=...&brand=...&admin=...&status=...&frequentFlyer=...
 *
 * Thin wrapper over `loadDashboard`, which the Pre Departure server component also
 * calls directly to render the first paint.
 */
export async function GET(req: NextRequest) {
  const { status, ...body } = await loadDashboard(new URL(req.url).search)
  return NextResponse.json(body, { status })
}

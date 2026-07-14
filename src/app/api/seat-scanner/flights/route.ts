import { NextResponse } from "next/server"

import { fetchFlightsFromDB } from "@/lib/seat-scanner/db"
import type { FlightsResponse } from "@/lib/seat-scanner/types"

export type { FlightsResponse }

function secondsUntilNext6AM(): number {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0, 0, 0)
  if (now >= next) next.setDate(next.getDate() + 1)
  return Math.max(60, Math.floor((next.getTime() - now.getTime()) / 1000))
}

export async function GET(): Promise<NextResponse<FlightsResponse | { error: string }>> {
  try {
    const data = await fetchFlightsFromDB()
    const maxAge = secondsUntilNext6AM()
    return NextResponse.json(data, {
      headers: { "Cache-Control": `public, max-age=${maxAge}, stale-while-revalidate=60` },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[seat-scanner/flights] DB error:", msg)
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? msg : "Failed to load flights" },
      { status: 500 }
    )
  }
}

import { type NextRequest, NextResponse } from "next/server"

import { createSSRClient } from "@/lib/supabase/ssr-client"
import { createServiceClient } from "@/lib/supabase/server"

/**
 * Monthly first-scan verdict counts for the Queue Health drawer.
 *
 * Reads `pnr_scan_outcomes`, the frozen record of what the scan of pnr_json /
 * pnr_p3 / pnr_ticket decided the first time it saw each queue occurrence. This is
 * deliberately not the live `pnr_queue.queue_status`, which keeps moving as PNRs are
 * approved, completed and revoked — a month already reported on must not shift.
 *
 * `?month=YYYY-MM` narrows the result to that single month. Without it the response
 * covers a rolling window of the last `MONTHS` months. Either way `available` lists
 * every month that actually holds a scan, so the picker can offer months older than
 * the rolling window.
 *
 * Months are bucketed in UTC throughout — `decided_at` is a timestamptz, and mixing
 * in the server's local zone would shift scans near a month boundary into the wrong
 * bucket.
 */

const MONTHS = 6

export type ScanOutcomeMonth = {
  /** First day of the month, ISO date (YYYY-MM-01). */
  month: string
  pending: number
  exception: number
}

export type ScanOutcomeConsultant = {
  name: string
  pending: number
  exception: number
}

/** `Date` → "YYYY-MM-01", in UTC. */
function monthKey(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10)
}

export async function GET(req: NextRequest) {
  const ssrClient = await createSSRClient()
  const {
    data: { user },
  } = await ssrClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const monthParam = req.nextUrl.searchParams.get("month")?.trim() || null
  if (monthParam && !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)) {
    return NextResponse.json(
      { error: "month must be YYYY-MM" },
      { status: 400 }
    )
  }

  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // Window bounds. A single month is [first of that month, first of the next);
  // otherwise the last MONTHS months including the current one.
  const now = new Date()
  let since: Date
  let until: Date | null = null

  if (monthParam) {
    const [y, m] = monthParam.split("-").map(Number)
    since = new Date(Date.UTC(y, m - 1, 1))
    until = new Date(Date.UTC(y, m, 1))
  } else {
    since = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1), 1)
    )
  }

  let query = db
    .from("pnr_scan_outcomes")
    .select("verdict, decided_at, consultant_name")
    .gte("decided_at", since.toISOString())
  if (until) query = query.lt("decided_at", until.toISOString())

  // `available` needs every month on record, not just the window, so the picker can
  // reach back past it.
  const [windowResult, allResult] = await Promise.all([
    query,
    db.from("pnr_scan_outcomes").select("decided_at"),
  ])

  if (windowResult.error) {
    return NextResponse.json(
      { error: windowResult.error.message },
      { status: 500 }
    )
  }

  // Seed every month in the window so one with no scans renders as an empty slot
  // rather than vanishing and making the axis lie about the time span.
  const buckets = new Map<string, ScanOutcomeMonth>()
  const span = monthParam ? 1 : MONTHS
  for (let i = 0; i < span; i++) {
    const key = monthKey(
      new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + i, 1))
    )
    buckets.set(key, { month: key, pending: 0, exception: 0 })
  }

  const byConsultant = new Map<string, ScanOutcomeConsultant>()

  for (const row of (windowResult.data ?? []) as {
    verdict: string
    decided_at: string
    consultant_name: string | null
  }[]) {
    const isException = row.verdict === "exception"

    const bucket = buckets.get(monthKey(new Date(row.decided_at)))
    if (bucket) {
      if (isException) bucket.exception++
      else bucket.pending++
    }

    // Rows scanned before the column existed carry no consultant; group them rather
    // than dropping them, so the section's totals still reconcile with the chart.
    const name = row.consultant_name?.trim() || "Unassigned"
    let entry = byConsultant.get(name)
    if (!entry) {
      entry = { name, pending: 0, exception: 0 }
      byConsultant.set(name, entry)
    }
    if (isException) entry.exception++
    else entry.pending++
  }

  // Busiest first — the consultants worth looking at are the ones with volume.
  const consultants = Array.from(byConsultant.values()).sort(
    (a, b) => b.exception + b.pending - (a.exception + a.pending)
  )

  const available = Array.from(
    new Set(
      ((allResult.data ?? []) as { decided_at: string }[]).map((r) =>
        monthKey(new Date(r.decided_at)).slice(0, 7)
      )
    )
  ).sort((a, b) => b.localeCompare(a))

  return NextResponse.json({
    months: Array.from(buckets.values()),
    consultants,
    available,
  })
}

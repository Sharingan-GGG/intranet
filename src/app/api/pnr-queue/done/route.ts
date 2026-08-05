import { type NextRequest, NextResponse } from "next/server"

import { getPreDepartureUser } from "@/lib/pre-departure-user"
import { createServiceClient } from "@/lib/supabase/server"
import { getRolePermissions, isAllowed } from "@/lib/permissions-server"
import { updateSheetRows } from "@/lib/google-sheets"
import { resolveSheetRowIndices } from "@/lib/sheet-sync"

type DoneBody = {
  pnr: string
  brand: string
}

export async function POST(req: NextRequest) {
  const profile = await getPreDepartureUser()
  if (!profile) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    )
  }

  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any


  const permissions = await getRolePermissions(
    supabase,
    profile?.role ?? "user"
  )
  const canDone = isAllowed(permissions, "scan_pnr")
  if (!canDone) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 }
    )
  }

  let body: DoneBody
  try {
    body = (await req.json()) as DoneBody
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const pnr = String(body?.pnr ?? "")
    .trim()
    .toUpperCase()
  const brand = String(body?.brand ?? "").trim()

  if (!pnr || !brand) {
    return NextResponse.json(
      { success: false, error: "pnr and brand are required" },
      { status: 400 }
    )
  }

  const nowIso = new Date().toISOString()

  const { data: updatedRows, error: updateError } = await db
    .from("pnr_queue")
    .update({ queue_status: "done", processed_at: nowIso })
    .eq("pnr", pnr)
    .eq("brand", brand)
    .eq("queue_status", "pending")
    .select("id, pnr, brand, sheet_row")

  if (updateError) {
    return NextResponse.json(
      { success: false, error: updateError.message },
      { status: 500 }
    )
  }

  const updatedCount = updatedRows?.length ?? 0

  if (updatedCount > 0) {
    // Sync to Google Sheet. The stored sheet_row is not trusted: deleting a row
    // shifts every row below it up, so a stale index would mark the wrong PNR
    // Completed. Resolve the index from the tab's current layout instead.
    resolveSheetRowIndices(brand, [pnr])
      .then(async (indices) => {
        const rowIndex = indices.get(pnr)
        if (rowIndex == null) {
          console.warn(`[done] ${pnr} not found in ${brand} tab; sheet not updated`)
          return
        }
        await updateSheetRows(brand, [{ rowIndex, colG: "Completed" }])
        await db.from("pnr_queue").update({ sheet_row: rowIndex }).eq("pnr", pnr)
      })
      .catch((e) => console.error("[done] Failed to sync sheet:", e))

    // Write audit trail
    await db.from("pnr_audit_log").insert({
      pnr,
      brand,
      action: "moved",
      performed_by: profile?.id ?? null,
      meta: { from: "pending", to: "done", action: "done", at: nowIso },
    })
  }

  return NextResponse.json({ success: true, updated: updatedCount })
}

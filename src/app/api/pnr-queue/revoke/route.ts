import { type NextRequest, NextResponse } from "next/server"

import { getPreDepartureUser } from "@/lib/pre-departure-user"
import { createServiceClient } from "@/lib/supabase/server"
import { getRolePermissions, isAllowed } from "@/lib/permissions-server"
import { updateSheetRows } from "@/lib/google-sheets"
import { resolveSheetRowIndices } from "@/lib/sheet-sync"

type RevokeBody = {
  pnr: string
  brand: string
  from?: string
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
  // The generated Supabase types might not yet include the newly allowed queue_status='exception'.
  // Use a local any-typed client here to keep the API route typecheckable.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any


  const permissions = await getRolePermissions(
    supabase,
    profile?.role ?? "user"
  )
  const canRevoke =
    isAllowed(permissions, "delete_pnr") || isAllowed(permissions, "move_pnr")
  if (!canRevoke) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 }
    )
  }

  let body: RevokeBody
  try {
    body = (await req.json()) as RevokeBody
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
  const from = String(body?.from ?? "pending").trim().toLowerCase()

  if (!pnr || !brand) {
    return NextResponse.json(
      { success: false, error: "pnr and brand are required" },
      { status: 400 }
    )
  }

  const nowIso = new Date().toISOString()
  const targetStatus = from === "done" ? "pending" : "exception"
  const fromStatus = from === "done" ? "done" : "pending"

  const { data: updatedRows, error: updateError } = await db
    .from("pnr_queue")
    .update({ queue_status: targetStatus, processed_at: nowIso })
    .eq("pnr", pnr)
    .eq("brand", brand)
    .eq("queue_status", fromStatus)
    .select("id, pnr, brand, queue_status, sheet_row")

  if (updateError) {
    return NextResponse.json(
      { success: false, error: updateError.message },
      { status: 500 }
    )
  }

  const updatedCount = updatedRows?.length ?? 0

  if (updatedCount > 0) {
    // Sync to Google Sheet if revoking from "done". The stored sheet_row is not
    // trusted — row deletions shift the tab and would send this write to the
    // wrong PNR. Resolve the index from the tab's current layout instead.
    if (from === "done") {
      resolveSheetRowIndices(brand, [pnr])
        .then(async (indices) => {
          const rowIndex = indices.get(pnr)
          if (rowIndex == null) {
            console.warn(
              `[revoke] ${pnr} not found in ${brand} tab; sheet not updated`
            )
            return
          }
          await updateSheetRows(brand, [{ rowIndex, colG: "Processing" }])
          await db.from("pnr_queue").update({ sheet_row: rowIndex }).eq("pnr", pnr)
        })
        .catch((e) => console.error("[revoke] Failed to sync sheet:", e))
    }

    // Write audit trail; "revoke" is modeled as a moved workflow step in audit taxonomy.
    await db.from("pnr_audit_log").insert({
      pnr,
      brand,
      action: "moved",
      performed_by: profile?.id ?? null,
      meta: { from: fromStatus, to: targetStatus, action: "revoke", at: nowIso },
    })
  }

  return NextResponse.json({ success: true, updated: updatedCount })
}

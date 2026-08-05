import { type NextRequest, NextResponse } from "next/server"

import { getPreDepartureUser } from "@/lib/pre-departure-user"
import { createServiceClient } from "@/lib/supabase/server"
import { getRolePermissions, isAllowed } from "@/lib/permissions-server"
import {
  appendToSheetTab,
  getSheetIdByTitle,
  deleteSheetRowsByIndex,
} from "@/lib/google-sheets"
import { refreshSheetRows, resolveSheetRowIndices } from "@/lib/sheet-sync"

type DeleteSelectedBody = {
  pnrs: string[]
}

type QueueRow = {
  pnr: string
  brand: string | null
  client_name: string | null
  departure_date: string | null
  consultant_name: string | null
  sheet_row: number | null
}

export async function POST(req: NextRequest) {
  const profile = await getPreDepartureUser()
  if (!profile) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any


  const permissions = await getRolePermissions(supabase, profile?.role ?? "user")
  if (!isAllowed(permissions, "delete_pnr")) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
  }

  let body: DeleteSelectedBody
  try {
    body = (await req.json()) as DeleteSelectedBody
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const pnrs = (body?.pnrs ?? [])
    .map((p) => String(p).trim().toUpperCase())
    .filter(Boolean)

  if (pnrs.length === 0) {
    return NextResponse.json({ success: false, error: "No PNRs specified" }, { status: 400 })
  }

  const { data: queueRows, error: fetchError } = await db
    .from("pnr_queue")
    .select("pnr, brand, client_name, departure_date, consultant_name, sheet_row")
    .in("pnr", pnrs)

  if (fetchError) {
    return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
  }

  const rows = (queueRows ?? []) as QueueRow[]
  if (rows.length === 0) {
    return NextResponse.json({ success: true, deleted: 0 })
  }

  console.log(`[delete-selected] Deleting ${rows.length} PNRs:`, rows.map((r) => ({ pnr: r.pnr, brand: r.brand, sheet_row: r.sheet_row })))

  const today = new Date().toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
  const deletedBy = profile?.full_name ?? profile?.email ?? profile.email ?? profile.id

  const errors: string[] = []

  // Group the PNRs by brand and resolve each one's live row index.
  //
  // The stored sheet_row is deliberately ignored: deleting a row shifts every row
  // below it up, so a stale index deletes somebody else's PNR. Column D of the
  // current tab is the only safe source.
  const pnrsByBrand = new Map<string, string[]>()
  const rowsWithoutBrand: string[] = []
  for (const r of rows) {
    if (!r.brand) {
      rowsWithoutBrand.push(r.pnr)
      console.warn(`[delete-selected] PNR ${r.pnr} has no brand, cannot delete from sheet`)
      continue
    }
    if (!pnrsByBrand.has(r.brand)) pnrsByBrand.set(r.brand, [])
    pnrsByBrand.get(r.brand)!.push(r.pnr)
  }

  if (rowsWithoutBrand.length > 0) {
    errors.push(`${rowsWithoutBrand.length} PNRs have no brand: ${rowsWithoutBrand.join(", ")}`)
  }

  const byBrand = new Map<string, number[]>()
  for (const [brand, pnrList] of pnrsByBrand) {
    try {
      const indices = await resolveSheetRowIndices(brand, pnrList)
      const found = pnrList
        .map((p) => indices.get(p.toUpperCase()))
        .filter((i): i is number => i != null)
      if (found.length > 0) byBrand.set(brand, found)
      const notFound = pnrList.filter((p) => !indices.has(p.toUpperCase()))
      if (notFound.length > 0) {
        // Already absent from the tab — the DB delete brings the two into agreement.
        console.warn(
          `[delete-selected] Not in ${brand} tab, nothing to remove: ${notFound.join(", ")}`
        )
      }
    } catch (e) {
      // A read failure means we cannot tell which rows to remove. Deleting from
      // Supabase anyway would strand the sheet row with column E = SYNCED, which
      // import skips forever — so stop before touching the database.
      const errMsg = e instanceof Error ? e.message : String(e)
      console.error(`[delete-selected] Failed to read ${brand} sheet:`, e)
      return NextResponse.json(
        {
          success: false,
          error: `Could not read the ${brand} sheet, so nothing was deleted. Try again.`,
          sheetErrors: [...errors, `${brand} sheet read: ${errMsg}`],
        },
        { status: 502 }
      )
    }
  }

  // Remove the rows from their brand tabs first. A failure here aborts before any
  // database change, so a retry starts from a consistent state.
  for (const [brand, indices] of byBrand) {
    try {
      const sheetId = await getSheetIdByTitle(brand)
      console.log(
        `[delete-selected] Deleting ${indices.length} rows from ${brand}: ${indices.join(", ")}`
      )
      await deleteSheetRowsByIndex(sheetId, indices)
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      console.error(`[delete-selected] Failed to delete from ${brand} sheet:`, e)
      return NextResponse.json(
        {
          success: false,
          error: `Could not remove rows from the ${brand} sheet, so nothing was deleted from the database. Try again.`,
          sheetErrors: [...errors, `${brand} sheet delete: ${errMsg}`],
        },
        { status: 502 }
      )
    }
  }

  // Archive to the Done tab. The brand tabs and the queue already agree by now, so
  // a failure here costs the audit trail only — it is reported, not fatal.
  const doneRows = rows.map((r) => [
    r.brand ?? "",
    r.client_name ?? "",
    r.departure_date ?? "",
    r.consultant_name ?? "",
    r.pnr,
    today,
    deletedBy,
  ])

  if (doneRows.length > 0) {
    try {
      await appendToSheetTab("Done", doneRows)
      console.log(`[delete-selected] Appended ${doneRows.length} rows to Done tab`)
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      errors.push(`Done tab append: ${errMsg}`)
      console.error(`[delete-selected] Failed to append to Done tab:`, e)
    }
  }

  // Delete from related tables first, then pnr_queue (critical path)
  try {
    // Get pnr_history IDs for the PNRs we're deleting
    const { data: historyRows } = await db
      .from("pnr_history")
      .select("id")
      .in("pnr", pnrs)

    const historyIds = (historyRows ?? []).map((r: { id: number }) => r.id)

    // Delete from child tables (pnr_json, pnr_p3, pnr_ticket)
    if (historyIds.length > 0) {
      await db.from("pnr_json").delete().in("pnr_history_id", historyIds)
      await db.from("pnr_p3").delete().in("pnr_history_id", historyIds)
      await db.from("pnr_ticket").delete().in("pnr_history_id", historyIds)
      // Delete pnr_history itself
      await db.from("pnr_history").delete().in("id", historyIds)
    }
  } catch (e) {
    // Log but continue - these are cleanup operations
    console.error("[delete-selected] Failed to delete related tables:", e)
  }

  // Delete from pnr_queue
  const { error: deleteError } = await db.from("pnr_queue").delete().in("pnr", pnrs)
  if (deleteError) {
    return NextResponse.json(
      { success: false, error: deleteError.message, sheetErrors: errors },
      { status: 500 }
    )
  }

  // Removing rows shifted every row below them up, so every surviving sheet_row in
  // those tabs is now stale. Re-anchor them before the next write path reads one.
  for (const brand of byBrand.keys()) {
    try {
      await refreshSheetRows(db, brand)
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      errors.push(`${brand} sheet_row refresh: ${errMsg}`)
      console.error(`[delete-selected] Failed to refresh sheet_row for ${brand}:`, e)
    }
  }

  // Record tombstones so the dashboard can suppress legacy-MySQL rows for these PNRs.
  // upsert avoids a conflict error if a PNR was previously deleted and re-imported.
  try {
    await db.from("pnr_deletions").upsert(
      pnrs.map((pnr) => ({ pnr })),
      { onConflict: "pnr" }
    )
  } catch (e) {
    console.error("[delete-selected] Failed to write pnr_deletions:", e)
  }

  const nowIso = new Date().toISOString()
  try {
    await db.from("pnr_audit_log").insert(
      rows.map((r) => ({
        pnr: r.pnr,
        brand: r.brand ?? "",
        action: "deleted",
        performed_by: profile?.id ?? null,
        meta: { reason: "bulk_delete", at: nowIso },
      }))
    )
  } catch {
    // audit log is best-effort
  }

  return NextResponse.json({
    success: true,
    deleted: rows.length,
    sheetErrors: errors.length > 0 ? errors : undefined,
  })
}

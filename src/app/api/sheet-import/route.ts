import { type NextRequest, NextResponse } from "next/server"

import { getPreDepartureUser } from "@/lib/pre-departure-user"
import { createServiceClient } from "@/lib/supabase/server"
import { getRolePermissions, isAllowed } from "@/lib/permissions-server"
import { getSheetRows, updateSheetRows } from "@/lib/google-sheets"
import { type ReconcileResult, reconcileBrandSheet } from "@/lib/sheet-sync"
import { ensureBrandId } from "@/lib/supabase/ensure-brand"

/**
 * Close any residual drift between the brand tab and `pnr_queue` after the import
 * proper has run: rows the sheet lists but the queue lost, rows the queue holds but
 * the tab no longer lists, sheet-side metadata edits, and stale `sheet_row` indices.
 * Never fatal — the import itself has already succeeded by this point.
 */
async function runReconcile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  brand: string,
  actor: { profileId: string | null; scannedBy: string }
): Promise<ReconcileResult> {
  try {
    return await reconcileBrandSheet(db, brand, actor)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[sheet-import] reconcile failed:", msg)
    return {
      importedToDb: [],
      restoredToSheet: [],
      metadataUpdated: [],
      statusPushed: [],
      errors: [msg],
    }
  }
}

export async function POST(req: NextRequest) {
  const profile = await getPreDepartureUser()
  if (!profile)
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    )

  const supabase = createServiceClient()

  const permissions = await getRolePermissions(
    supabase,
    profile?.role ?? "user"
  )
  if (!isAllowed(permissions, "scan_pnr")) {
    return NextResponse.json(
      { success: false, error: "Forbidden" },
      { status: 403 }
    )
  }

  let brand: string
  try {
    const body = await req.json()
    brand = body.brand
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  if (!brand) {
    return NextResponse.json(
      { success: false, error: "brand is required" },
      { status: 400 }
    )
  }

  if (brand === "IT" && profile?.role !== "super_admin") {
    return NextResponse.json(
      { success: false, error: "Forbidden: IT brand is Super Admin only" },
      { status: 403 }
    )
  }

  const scannedBy =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (profile as any)?.full_name ??
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (profile as any)?.email ??
    profile.email ??
    profile.id

  let rows
  try {
    rows = await getSheetRows(brand)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sheet read failed"
    return NextResponse.json({ success: false, error: msg }, { status: 502 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const actor = { profileId: profile?.id ?? null, scannedBy }

  // Filter: rows where column E (marked) is empty (not yet processed) or flags a
  // fetch that previously failed — those are retried on every "Scan Sheet" run
  // until they actually succeed, since nothing is saved for them until then.
  const unsynced = rows.filter(
    (r) => !r.marked?.trim() || r.marked.trim() === "Error/ReScan"
  )
  const alreadySyncedCount = rows.length - unsynced.length

  if (unsynced.length === 0) {
    // Nothing new in the tab, but the two sides can still be out of step.
    const sync = await runReconcile(db, brand, actor)
    return NextResponse.json({
      success: true,
      imported: sync.importedToDb.length,
      skipped: alreadySyncedCount,
      already_synced: alreadySyncedCount,
      already_in_queue: 0,
      no_flight: 0,
      total: rows.length,
      recovered_to_db: sync.importedToDb.length,
      restored_to_sheet: sync.restoredToSheet.length,
      metadata_updated: sync.metadataUpdated.length,
      status_pushed: sync.statusPushed.length,
      sync_errors: sync.errors.length > 0 ? sync.errors : undefined,
    })
  }

  const pnrsToCheck = unsynced.map((r) => r.pnr)
  const brandId = await ensureBrandId(db, brand)

  // Query pnr_queue for duplicates and pnr_history for NO_FLIGHT status in parallel
  const [queueResult, noFlightResult] = await Promise.all([
    db.from("pnr_queue").select("pnr").in("pnr", pnrsToCheck),
    db
      .from("pnr_history")
      .select("pnr")
      .in("pnr", pnrsToCheck)
      .eq("brand_id", brandId)
      .eq("status", "NO_FLIGHT"),
  ])

  const queueSet = new Set<string>(
    (queueResult.data ?? []).map((r: { pnr: string }) => r.pnr)
  )
  const noFlightSet = new Set<string>(
    (noFlightResult.data ?? []).map((r: { pnr: string }) => r.pnr)
  )

  // Three groups (no_flight takes priority over already_in_queue)
  const noFlightRows = unsynced.filter((r) => noFlightSet.has(r.pnr))
  const alreadyInQueueRows = unsynced.filter(
    (r) => !noFlightSet.has(r.pnr) && queueSet.has(r.pnr)
  )
  const toImport = unsynced.filter(
    (r) => !noFlightSet.has(r.pnr) && !queueSet.has(r.pnr)
  )

  const skippedCount =
    alreadySyncedCount + noFlightRows.length + alreadyInQueueRows.length

  // Nothing is written to Supabase or the sheet for `toImport` rows here — that only
  // happens once `/api/sabre/pnr-fetch` actually resolves each one (SYNCED + type/
  // status on success, "Error/ReScan" on failure), so a fetch that never succeeds
  // leaves no trace and gets retried on the next "Scan Sheet" run. Known no-flight
  // and duplicate rows never reach a fetch at all, so those are still marked now.
  const sheetEntries = [
    ...noFlightRows.map((r) => ({
      rowIndex: r.rowIndex,
      colE: "No Flight",
      scannedBy,
    })),
    ...alreadyInQueueRows.map((r) => ({
      rowIndex: r.rowIndex,
      colE: "DUPLICATED",
      scannedBy,
    })),
  ]

  if (sheetEntries.length > 0) {
    await updateSheetRows(brand, sheetEntries).catch((e) =>
      console.error("[sheet-import] Failed to update sheet rows:", e)
    )
  }

  if (toImport.length === 0) {
    const sync = await runReconcile(db, brand, actor)
    return NextResponse.json({
      success: true,
      imported: sync.importedToDb.length,
      skipped: skippedCount,
      already_synced: alreadySyncedCount,
      already_in_queue: alreadyInQueueRows.length,
      already_in_queue_pnrs: alreadyInQueueRows.map((r) => r.pnr),
      no_flight: noFlightRows.length,
      no_flight_pnrs: noFlightRows.map((r) => r.pnr),
      total: rows.length,
      recovered_to_db: sync.importedToDb.length,
      restored_to_sheet: sync.restoredToSheet.length,
      metadata_updated: sync.metadataUpdated.length,
      status_pushed: sync.statusPushed.length,
      sync_errors: sync.errors.length > 0 ? sync.errors : undefined,
    })
  }

  const sync = await runReconcile(db, brand, actor)

  return NextResponse.json({
    success: true,
    imported: sync.importedToDb.length,
    skipped: skippedCount,
    already_synced: alreadySyncedCount,
    already_in_queue: alreadyInQueueRows.length,
    already_in_queue_pnrs: alreadyInQueueRows.map((r) => r.pnr),
    no_flight: noFlightRows.length,
    no_flight_pnrs: noFlightRows.map((r) => r.pnr),
    total: rows.length,
    // Queued for fetch — not yet saved anywhere. The client fetches each of these
    // via /api/sabre/pnr-fetch, which is what actually persists them on success.
    pnrs: toImport.map((r) => ({
      pnr: r.pnr,
      client_name: r.client_name || null,
      departure_date: r.departure_date || null,
      consultant_name: r.consultant_name || null,
      sheet_row: r.rowIndex,
    })),
    recovered_to_db: sync.importedToDb.length,
    restored_to_sheet: sync.restoredToSheet.length,
    metadata_updated: sync.metadataUpdated.length,
    status_pushed: sync.statusPushed.length,
    sync_errors: sync.errors.length > 0 ? sync.errors : undefined,
  })
}

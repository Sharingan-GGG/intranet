import { type NextRequest, NextResponse } from "next/server"

import { createSSRClient } from "@/lib/supabase/ssr-client"
import { createServiceClient } from "@/lib/supabase/server"
import { getRolePermissions, isAllowed } from "@/lib/permissions-server"
import { getSheetRows, updateSheetRows } from "@/lib/google-sheets"
import { type ReconcileResult, reconcileBrandSheet } from "@/lib/sheet-sync"
import { ensureBrandId } from "@/lib/supabase/ensure-brand"
import { upsertPnrHistoryFromSheetRow } from "@/lib/supabase/pnr-queue-metadata"

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
      errors: [msg],
    }
  }
}

export async function POST(req: NextRequest) {
  const ssrClient = await createSSRClient()
  const {
    data: { user },
  } = await ssrClient.auth.getUser()
  if (!user)
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    )

  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, email")
    .eq("auth_id", user.id)
    .single()

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
    user.email ??
    user.id

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

  // Filter: only rows where column E (marked) is empty — not yet processed
  const unsynced = rows.filter((r) => !r.marked?.trim())
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

  // Fire-and-forget: write all sheet updates in one batchUpdate
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
    ...toImport.map((r) => ({
      rowIndex: r.rowIndex,
      colE: "SYNCED",
      colF: r.pnr_type || undefined,
      colG: "Processing",
      scannedBy,
    })),
  ]

  if (toImport.length === 0) {
    // Nothing to insert — write sheet updates, then reconcile any residual drift.
    if (sheetEntries.length > 0) {
      await updateSheetRows(brand, sheetEntries).catch((e) =>
        console.error("[sheet-import] Failed to update sheet rows:", e)
      )
    }

    const sync = await runReconcile(db, brand, actor)
    return NextResponse.json({
      success: true,
      imported: sync.importedToDb.length,
      skipped: skippedCount,
      already_synced: alreadySyncedCount,
      already_in_queue: alreadyInQueueRows.length,
      no_flight: noFlightRows.length,
      total: rows.length,
      recovered_to_db: sync.importedToDb.length,
      restored_to_sheet: sync.restoredToSheet.length,
      metadata_updated: sync.metadataUpdated.length,
      sync_errors: sync.errors.length > 0 ? sync.errors : undefined,
    })
  }

  const queueRows = toImport.map((r) => ({
    pnr: r.pnr,
    brand_id: brandId,
    queue_status: "pending",
    client_name: r.client_name || null,
    departure_date: r.departure_date || null,
    consultant_name: r.consultant_name || null,
    pnr_type: r.pnr_type || null,
    added_by: profile?.id ?? null,
    sheet_row: r.rowIndex,
  }))

  const { error: insertError } = await db
    .from("pnr_queue")
    .upsert(queueRows, { onConflict: "pnr" })

  if (insertError) {
    return NextResponse.json(
      { success: false, error: insertError.message },
      { status: 500 }
    )
  }

  // Clear tombstones for any re-imported PNRs so they reappear in the dashboard.
  const importedPnrs = toImport.map((r) => r.pnr)
  db.from("pnr_deletions").delete().in("pnr", importedPnrs).then().catch(
    (e: unknown) => console.error("[sheet-import] Failed to clear pnr_deletions:", e)
  )

  try {
    await Promise.all(
      toImport.map((r) =>
        upsertPnrHistoryFromSheetRow(db, r.pnr, brandId, {
          client_name: r.client_name,
          departure_date: r.departure_date,
          consultant_name: r.consultant_name,
          pnr_type: r.pnr_type,
        })
      )
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[sheet-import] pnr_history mirror failed:", msg)
    return NextResponse.json(
      { success: false, error: `Queue saved but history sync failed: ${msg}` },
      { status: 500 }
    )
  }

  // Write all status + scanned_by updates to the sheet before reconciling, so the
  // reconcile pass reads the tab in its final state.
  if (sheetEntries.length > 0) {
    await updateSheetRows(brand, sheetEntries).catch((e) =>
      console.error("[sheet-import] Failed to update sheet rows:", e)
    )
  }

  const sync = await runReconcile(db, brand, actor)

  return NextResponse.json({
    success: true,
    imported: toImport.length + sync.importedToDb.length,
    skipped: skippedCount,
    already_synced: alreadySyncedCount,
    already_in_queue: alreadyInQueueRows.length,
    no_flight: noFlightRows.length,
    total: rows.length,
    pnrs: [...toImport.map((r) => r.pnr), ...sync.importedToDb],
    recovered_to_db: sync.importedToDb.length,
    restored_to_sheet: sync.restoredToSheet.length,
    metadata_updated: sync.metadataUpdated.length,
    sync_errors: sync.errors.length > 0 ? sync.errors : undefined,
  })
}

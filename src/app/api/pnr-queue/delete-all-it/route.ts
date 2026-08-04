import { type NextRequest, NextResponse } from "next/server"

import { createSSRClient } from "@/lib/supabase/ssr-client"
import { createServiceClient } from "@/lib/supabase/server"
import {
  getSheetRows,
  appendToSheetTab,
  getSheetIdByTitle,
  deleteSheetRowsByIndex,
} from "@/lib/google-sheets"

const DONE_TAB = "Done"
const IT_BRAND = "IT"

export async function POST(req: NextRequest) {
  const supabase = await createSSRClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let deletedBy = user.email ?? user.id
  try {
    const body = (await req.json().catch(() => null)) as
      | { deletedBy?: string }
      | null
    if (body?.deletedBy) deletedBy = body.deletedBy
  } catch {
    // ignore body parse errors
  }

  const db = createServiceClient()

  type QueueRow = {
    pnr: string
    brand: string | null
    client_name: string | null
    departure_date: string | null
    consultant_name: string | null
    created_at: string
    sheet_row: number | null
  }

  // Fetch all IT rows from pnr_queue
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: queueRows, error: queueError } = await (db as any)
    .from("pnr_queue")
    .select("pnr, brand, client_name, departure_date, consultant_name, created_at, sheet_row")
    .eq("brand", IT_BRAND)

  if (queueError) {
    return NextResponse.json(
      { error: "Failed to fetch IT queue rows", detail: (queueError as { message: string }).message },
      { status: 500 }
    )
  }

  const rows = (queueRows ?? []) as QueueRow[]
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0 })
  }

  const today = new Date().toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

  // Build rows for the Done tab: Branch Code, Client Profile Name, Departure Date, Consultant Name, Flight PNR, Date Sent, Deleted By
  const doneRows = rows.map((r) => [
    IT_BRAND,
    r.client_name ?? "",
    r.departure_date ?? "",
    r.consultant_name ?? "",
    r.pnr,
    today,
    deletedBy,
  ])

  // Resolve row indices from the tab's current layout, matching on column D. The
  // stored sheet_row is not used — row deletions shift the tab and stale indices
  // would remove the wrong PNRs.
  const pnrSet = new Set(rows.map((r) => r.pnr.toUpperCase()))
  let sheetRows: Awaited<ReturnType<typeof getSheetRows>>
  let sheetId: number

  try {
    sheetRows = await getSheetRows(IT_BRAND)
    sheetId = await getSheetIdByTitle(IT_BRAND)
  } catch (e) {
    // Without a readable tab we cannot tell which rows to remove. Deleting from
    // Supabase anyway would strand each sheet row with column E = SYNCED, which
    // import skips forever — so stop before touching the database.
    const errMsg = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      {
        error: "Could not read the IT sheet, so nothing was deleted. Try again.",
        sheetErrors: [`IT sheet read: ${errMsg}`],
      },
      { status: 502 }
    )
  }

  const matchedSheetRowIndices = sheetRows
    .filter((r) => pnrSet.has(r.pnr.toUpperCase()))
    .map((r) => r.rowIndex)

  const errors: string[] = []

  // Delete matched rows from the IT tab first — a failure here aborts before any
  // database change, so a retry starts from a consistent state.
  if (matchedSheetRowIndices.length > 0) {
    try {
      await deleteSheetRowsByIndex(sheetId, matchedSheetRowIndices)
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e)
      return NextResponse.json(
        {
          error:
            "Could not remove rows from the IT sheet, so nothing was deleted from the database. Try again.",
          sheetErrors: [`IT tab delete: ${errMsg}`],
        },
        { status: 502 }
      )
    }
  }

  // Archive to the Done tab. The IT tab and the queue already agree by now, so a
  // failure here costs the audit trail only — it is reported, not fatal.
  try {
    await appendToSheetTab(DONE_TAB, doneRows)
  } catch (e) {
    errors.push(`Done tab append: ${e instanceof Error ? e.message : String(e)}`)
  }

  // Get PNRs to delete
  const pnrsToDelete = rows.map((r) => r.pnr)

  try {
    // Get pnr_history IDs for the PNRs we're deleting
    const { data: historyRows } = await (db as any)
      .from("pnr_history")
      .select("id")
      .in("pnr", pnrsToDelete)

    const historyIds = (historyRows ?? []).map((r: { id: number }) => r.id)

    // Delete from child tables (pnr_json, pnr_p3, pnr_ticket)
    if (historyIds.length > 0) {
      await (db as any).from("pnr_json").delete().in("pnr_history_id", historyIds)
      await (db as any).from("pnr_p3").delete().in("pnr_history_id", historyIds)
      await (db as any).from("pnr_ticket").delete().in("pnr_history_id", historyIds)
      // Delete pnr_history itself
      await (db as any).from("pnr_history").delete().in("id", historyIds)
    }
  } catch (e) {
    // Log but continue - these are cleanup operations
    console.error("[delete-all-it] Failed to delete related tables:", e)
  }

  // Delete from Supabase pnr_queue
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deleteError } = await (db as any)
    .from("pnr_queue")
    .delete()
    .eq("brand", IT_BRAND)

  if (deleteError) {
    return NextResponse.json(
      {
        error: "Queue delete failed",
        detail: (deleteError as { message: string }).message,
        sheetErrors: errors,
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    deleted: rows.length,
    sheetRowsDeleted: matchedSheetRowIndices.length,
    sheetErrors: errors.length > 0 ? errors : undefined,
  })
}

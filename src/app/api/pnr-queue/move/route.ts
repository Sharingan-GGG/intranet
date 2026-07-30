import { type NextRequest, NextResponse } from "next/server"

import { createSSRClient } from "@/lib/supabase/ssr-client"
import { createServiceClient } from "@/lib/supabase/server"
import { getRolePermissions, isAllowed } from "@/lib/permissions-server"
import {
  type SheetRow,
  getSheetRows,
  getSheetIdByTitle,
  deleteSheetRowsByIndex,
  appendToSheetTab,
} from "@/lib/google-sheets"
import { DEFAULT_MARKED, refreshSheetRows } from "@/lib/sheet-sync"

type MoveBody = {
  pnrs: string[]
  toBrand: string
  toProfileId?: string | null
}

type QueuePreRow = {
  pnr: string
  brand: string | null
  client_name: string | null
  departure_date: string | null
  consultant_name: string | null
  pnr_type: string | null
  queue_status: string | null
  sheet_row: number | null
}

/** Map pnr_queue.queue_status → Google Sheet column G value. */
function queueStatusToSheetStatus(status: string | null | undefined): string {
  if (status === "no-flight") return "no-flight"
  if (status === "exception") return "Exception"
  return "Processing"
}

export async function POST(req: NextRequest) {
  try {
    const ssrClient = await createSSRClient()
    const {
      data: { user },
    } = await ssrClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("auth_id", user.id)
      .single()

    const permissions = await getRolePermissions(supabase, profile?.role ?? "user")
    if (!isAllowed(permissions, "move_pnr")) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
    }

    let body: MoveBody
    try {
      body = (await req.json()) as MoveBody
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 })
    }

    const pnrs = (body?.pnrs ?? [])
      .map((p) => String(p).trim().toUpperCase())
      .filter(Boolean)
    const toBrand = String(body?.toBrand ?? "").trim()
    const toProfileId = body?.toProfileId ? String(body.toProfileId).trim() : null

    if (pnrs.length === 0 || !toBrand) {
      return NextResponse.json(
        { success: false, error: "pnrs and toBrand are required" },
        { status: 400 }
      )
    }

    // Snapshot current DB state BEFORE the update — includes pnr_type and queue_status
    const { data: preRows } = await db
      .from("pnr_queue")
      .select("pnr, brand, client_name, departure_date, consultant_name, pnr_type, queue_status, sheet_row")
      .in("pnr", pnrs)

    const preRowMap = new Map<string, QueuePreRow>()
    for (const r of (preRows ?? []) as QueuePreRow[]) {
      preRowMap.set(r.pnr, r)
    }

    // pnr_history supplies column E (Marked) for every PNR, and column F (Type) as a
    // fallback wherever pnr_queue.pnr_type is null.
    const historyTypeMap = new Map<string, string>()
    const historyStatusMap = new Map<string, string>()
    {
      const { data: histRows } = await db
        .from("pnr_history")
        .select("pnr, pnr_type, status")
        .in("pnr", pnrs)
      for (const r of (histRows ?? []) as {
        pnr: string
        pnr_type: string | null
        status: string | null
      }[]) {
        if (r.pnr_type) historyTypeMap.set(r.pnr, r.pnr_type)
        if (r.status) historyStatusMap.set(r.pnr, r.status)
      }
    }

    // Resolve Transfer To user's full_name for Scanned By (col H)
    let scannedByName = ""
    if (toProfileId) {
      const { data: toProfile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", toProfileId)
        .single()
      scannedByName = toProfile?.full_name ?? toProfile?.email ?? ""
    }

    const patch: Record<string, unknown> = { brand: toBrand }
    if (toProfileId) patch.added_by = toProfileId

    const { data: updatedRows, error: updateError } = await db
      .from("pnr_queue")
      .update(patch)
      .in("pnr", pnrs)
      .select("pnr, brand")

    if (updateError) {
      const errMsg: string =
        (updateError as { message?: string }).message ||
        (updateError as { details?: string }).details ||
        (updateError as { hint?: string }).hint ||
        JSON.stringify(updateError)
      console.error("[move] DB error:", JSON.stringify(updateError, null, 2))
      return NextResponse.json(
        { success: false, error: errMsg || "Database update failed" },
        { status: 500 }
      )
    }

    const movedCount = updatedRows?.length ?? 0

    if (movedCount > 0) {
      const nowIso = new Date().toISOString()
      try {
        await db.from("pnr_audit_log").insert(
          (updatedRows as { pnr: string; brand: string }[]).map((r) => ({
            pnr: r.pnr,
            brand: r.brand,
            action: "moved",
            performed_by: profile?.id ?? null,
            meta: { action: "move", toBrand, toProfileId: toProfileId ?? null, at: nowIso },
          }))
        )
      } catch (e) {
        console.error("[move] audit log error:", e)
      }
    }

    // Google Sheets sync — best-effort, errors non-fatal
    const sheetErrors: string[] = []
    if (movedCount > 0) {
      // Group PNRs by source brand; skip same-brand moves
      const byFromBrand = new Map<string, string[]>()
      for (const pnr of pnrs) {
        const fromBrand = preRowMap.get(pnr)?.brand
        if (!fromBrand || fromBrand === toBrand) continue
        if (!byFromBrand.has(fromBrand)) byFromBrand.set(fromBrand, [])
        byFromBrand.get(fromBrand)!.push(pnr)
      }

      for (const [fromBrand, brandPnrs] of byFromBrand) {
        const pnrSet = new Set(brandPnrs)

        // Read source sheet for row data + accurate row indices
        const sheetRowsByPnr = new Map<string, SheetRow>()
        const deleteIndices: number[] = []
        try {
          const sourceRows = await getSheetRows(fromBrand)
          for (const r of sourceRows) {
            if (pnrSet.has(r.pnr)) {
              sheetRowsByPnr.set(r.pnr, r)
              deleteIndices.push(r.rowIndex)
            }
          }
        } catch (e) {
          // No fallback to the stored sheet_row: row deletions shift the tab, so a
          // stale index would delete an unrelated PNR. Leave the source row in
          // place — the next sheet import reconciles it — and report the failure.
          sheetErrors.push(`Read ${fromBrand}: ${e instanceof Error ? e.message : String(e)}`)
        }

        // Delete matched rows from source tab
        if (deleteIndices.length > 0) {
          try {
            const sourceSheetId = await getSheetIdByTitle(fromBrand)
            await deleteSheetRowsByIndex(sourceSheetId, deleteIndices)
          } catch (e) {
            sheetErrors.push(`Delete from ${fromBrand}: ${e instanceof Error ? e.message : String(e)}`)
          }
        }

        // Always append to destination tab
        try {
          const appendRows = brandPnrs.map((pnr) => {
            const sheet = sheetRowsByPnr.get(pnr)
            const pre = preRowMap.get(pnr)

            // Type: pnr_history.pnr_type → pnr_queue.pnr_type → sheet F column
            const pnrType =
              historyTypeMap.get(pnr) ??
              pre?.pnr_type ??
              sheet?.pnr_type ??
              ""

            // Status: derived from queue_status with processing condition
            const sheetStatus = queueStatusToSheetStatus(pre?.queue_status)

            return [
              sheet?.client_name ?? pre?.client_name ?? "",   // A
              sheet?.departure_date ?? pre?.departure_date ?? "", // B
              sheet?.consultant_name ?? pre?.consultant_name ?? "", // C
              pnr,                                            // D
              // E: Marked is always pnr_history.status. Falls back to SYNCED rather
              // than blank — the import reads an empty column E as unprocessed and
              // would re-add a PNR that is already queued.
              historyStatusMap.get(pnr) ?? DEFAULT_MARKED,    // E: Marked = pnr_history.status
              pnrType,                                        // F: Type = pnr_history.pnr_type
              sheetStatus,                                    // G: Status from queue_status
              scannedByName || sheet?.scanned_by || "",       // H: Scanned By
            ]
          })
          await appendToSheetTab(toBrand, appendRows)
        } catch (e) {
          sheetErrors.push(`Append to ${toBrand}: ${e instanceof Error ? e.message : String(e)}`)
        }

        // Rows left the source tab and joined the destination tab, so stored
        // indices on both sides are stale. Re-anchor them.
        for (const affected of [fromBrand, toBrand]) {
          try {
            await refreshSheetRows(db, affected)
          } catch (e) {
            sheetErrors.push(
              `${affected} sheet_row refresh: ${e instanceof Error ? e.message : String(e)}`
            )
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      moved: movedCount,
      sheetErrors: sheetErrors.length > 0 ? sheetErrors : undefined,
    })
  } catch (err) {
    console.error("[move] unhandled exception:", err)
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}

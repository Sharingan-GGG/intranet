/**
 * Google Sheets ↔ Supabase reconciliation for the Pre Departure queue.
 *
 * The brand tabs and `pnr_queue` are two copies of the same list, so they drift
 * apart in four ways. This module closes all four:
 *
 * 1. **Stale row indices.** `pnr_queue.sheet_row` is captured at import time, but
 *    deleting a row shifts every row below it up. Writing to a stored index later
 *    hits the wrong PNR — so nothing here trusts a stored index for a write.
 *    `resolveSheetRowIndices` always re-reads the tab and matches on the PNR in
 *    column D, and `refreshSheetRows` re-anchors the stored values afterwards.
 * 2. **Rows only in the sheet.** Added or re-added by hand, or previously imported
 *    and since lost from the queue. These are inserted into `pnr_queue`.
 * 3. **Rows only in the queue.** The sheet row was deleted by hand while the queue
 *    row survived. These are appended back to the tab in column order.
 * 4. **A stale column G.** Status is one-way: `pnr_queue.queue_status` owns it and
 *    the sheet only mirrors it. A column G that disagrees — hand-edited, or left
 *    behind by a failed write — is overwritten from the queue, never read back.
 *
 * Sheet column order (A–H), shared by every writer here:
 *   A client name · B departure date · C consultant name · D PNR
 *   E marked · F type · G status · H scanned by
 */

import {
  type SheetRow,
  appendToSheetTab,
  getSheetRows,
  updateSheetRows,
} from "@/lib/google-sheets"
import { ensureBrandId } from "@/lib/supabase/ensure-brand"
import { upsertPnrHistoryFromSheetRow } from "@/lib/supabase/pnr-queue-metadata"

/** Untyped service client — `pnr_queue` outpaces the generated Supabase types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

export type QueueSyncRow = {
  pnr: string
  brand: string | null
  queue_status: string | null
  client_name: string | null
  departure_date: string | null
  consultant_name: string | null
  pnr_type: string | null
  sheet_row: number | null
  added_by: string | null
}

const QUEUE_SYNC_COLUMNS =
  "pnr, brand, queue_status, client_name, departure_date, consultant_name, pnr_type, sheet_row, added_by"

/**
 * Map `pnr_queue.queue_status` → the sheet's column G wording.
 *
 * Column G carries two values and no others: work that is finished (`done`) reads
 * Completed, everything else reads Processing. The queue's finer states —
 * `exception`, `failed`, `no-flight` — are an intranet concern and are deliberately
 * flattened here rather than leaked into the tab.
 */
export function queueStatusToSheetStatus(
  status: string | null | undefined
): string {
  return status === "done" ? "Completed" : "Processing"
}

/**
 * Current row index for each PNR, read live from the tab.
 *
 * Use this instead of `pnr_queue.sheet_row` for every sheet write: a stored index
 * is only valid until the next row deletion shifts the tab.
 */
export async function resolveSheetRowIndices(
  brand: string,
  pnrs: string[]
): Promise<Map<string, number>> {
  const wanted = new Set(pnrs.map((p) => p.trim().toUpperCase()))
  const rows = await getSheetRows(brand)
  const out = new Map<string, number>()
  for (const r of rows) {
    const key = r.pnr.toUpperCase()
    if (wanted.has(key)) out.set(key, r.rowIndex)
  }
  return out
}

/**
 * Re-anchor `pnr_queue.sheet_row` for a brand against the tab's current layout.
 *
 * Call after anything that deletes or appends rows. Queue rows with no matching
 * sheet row are set back to null so no later write aims at a shifted index.
 */
export async function refreshSheetRows(
  db: Db,
  brand: string,
  sheetRows?: SheetRow[]
): Promise<void> {
  const rows = sheetRows ?? (await getSheetRows(brand))
  const indexByPnr = new Map(rows.map((r) => [r.pnr.toUpperCase(), r.rowIndex]))

  const { data: queueRows } = await db
    .from("pnr_queue")
    .select("pnr, sheet_row")
    .eq("brand", brand)

  const stale = ((queueRows ?? []) as { pnr: string; sheet_row: number | null }[])
    .map((q) => ({
      pnr: q.pnr,
      current: q.sheet_row,
      next: indexByPnr.get(q.pnr.toUpperCase()) ?? null,
    }))
    .filter((q) => q.current !== q.next)

  await Promise.all(
    stale.map((q) =>
      db.from("pnr_queue").update({ sheet_row: q.next }).eq("pnr", q.pnr)
    )
  )
}

/**
 * Column E (Marked) is always `pnr_history.status`.
 *
 * The fallback matters: the value has to be non-empty, because the import treats a
 * blank column E as "not yet processed" and would re-add a row that is already in
 * the queue. A queued PNR with no `pnr_history` row is reported as SYNCED.
 */
export const DEFAULT_MARKED = "SYNCED"

/**
 * A `pnr_queue` row rendered in the tab's A–H column order, so a PNR missing from
 * the sheet is written back with the same data Supabase holds:
 *
 *   Client Profile Name · Departure Date · Consultant Name · PNR
 *   Marked · Type · Status · Scanned By
 *
 * `marked` comes from `pnr_history.status`. `scannedBy` is the row's own owner
 * (`added_by`), not whoever triggered the sync — the sheet should name the person
 * the PNR belongs to.
 */
export function toSheetRowValues(
  row: {
    client_name: string | null
    departure_date: string | null
    consultant_name: string | null
    pnr: string
    pnr_type: string | null
    queue_status: string | null
  },
  scannedBy: string,
  marked: string
): string[] {
  return [
    row.client_name ?? "", // A Client Profile Name
    row.departure_date ?? "", // B Departure Date
    row.consultant_name ?? "", // C Consultant Name
    row.pnr, // D PNR
    marked, // E Marked — pnr_history.status
    row.pnr_type?.trim() || "", // F Type
    queueStatusToSheetStatus(row.queue_status), // G Status
    scannedBy, // H Scanned By
  ]
}

/** `pnr_history.status` per PNR, for column E. */
export async function fetchHistoryStatuses(
  db: Db,
  pnrs: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (pnrs.length === 0) return out
  const { data } = await db
    .from("pnr_history")
    .select("pnr, status")
    .in("pnr", pnrs)
  for (const r of (data ?? []) as { pnr: string; status: string | null }[]) {
    if (r.status) out.set(r.pnr.toUpperCase(), r.status)
  }
  return out
}

export type ReconcileResult = {
  /** Sheet rows that were missing from `pnr_queue` and have now been inserted. */
  importedToDb: string[]
  /** Queue rows whose sheet row was gone and have now been appended back. */
  restoredToSheet: string[]
  /** Matched rows whose sheet metadata differed and were copied into the queue. */
  metadataUpdated: string[]
  /** Matched rows whose column G disagreed with the queue and were overwritten. */
  statusPushed: string[]
  /** Non-fatal sheet/DB failures encountered along the way. */
  errors: string[]
}

function sheetMetadataDiff(
  sheet: SheetRow,
  queue: QueueSyncRow
): Partial<QueueSyncRow> | null {
  const patch: Record<string, string | null> = {}
  const pairs: [keyof QueueSyncRow, string][] = [
    ["client_name", sheet.client_name],
    ["departure_date", sheet.departure_date],
    ["consultant_name", sheet.consultant_name],
    ["pnr_type", sheet.pnr_type],
  ]
  for (const [field, sheetValue] of pairs) {
    const next = sheetValue.trim() || null
    // The sheet is the source of truth for these four, but a blank cell should
    // not wipe a value the queue already holds.
    if (next !== null && next !== (queue[field] ?? null)) patch[field] = next
  }
  return Object.keys(patch).length > 0 ? patch : null
}

/**
 * Bring one brand tab and `pnr_queue` into agreement, in both directions.
 *
 * Neither side is deleted: a row present on only one side is copied to the other.
 * Tombstoned PNRs (`pnr_deletions`) are the exception — those were deleted on
 * purpose, so a leftover sheet row is not imported back in.
 */
export async function reconcileBrandSheet(
  db: Db,
  brand: string,
  actor: { profileId: string | null; scannedBy: string }
): Promise<ReconcileResult> {
  const result: ReconcileResult = {
    importedToDb: [],
    restoredToSheet: [],
    metadataUpdated: [],
    statusPushed: [],
    errors: [],
  }

  const sheetRows = await getSheetRows(brand)
  const sheetPnrs = sheetRows.map((s) => s.pnr)
  const brandId = await ensureBrandId(db, brand)

  const [queueResult, deletionsResult, anyBrandResult, noFlightResult] =
    await Promise.all([
      db.from("pnr_queue").select(QUEUE_SYNC_COLUMNS).eq("brand", brand),
      db.from("pnr_deletions").select("pnr"),
      // Queue membership under *any* brand. Scoping this to `brand` would make a
      // PNR queued elsewhere look absent, and the onConflict upsert below would
      // then silently re-brand it.
      db.from("pnr_queue").select("pnr").in("pnr", sheetPnrs),
      // PNRs the scan already resolved as having no flight. The import excludes
      // these from the queue on purpose, so reconcile must not add them back.
      db
        .from("pnr_history")
        .select("pnr")
        .in("pnr", sheetPnrs)
        .eq("brand_id", brandId)
        .eq("status", "NO_FLIGHT"),
    ])

  const queueRows = (queueResult.data ?? []) as QueueSyncRow[]
  const queueByPnr = new Map(queueRows.map((q) => [q.pnr.toUpperCase(), q]))
  const sheetByPnr = new Map(sheetRows.map((s) => [s.pnr.toUpperCase(), s]))
  const upperSet = (rows: unknown, key = "pnr") =>
    new Set(
      ((rows ?? []) as Record<string, string>[]).map((r) => r[key].toUpperCase())
    )
  const tombstoned = upperSet(deletionsResult.data)
  const queuedAnywhere = upperSet(anyBrandResult.data)
  const noFlight = upperSet(noFlightResult.data)

  // ── Direction 1: sheet → Supabase ────────────────────────────────────────
  // A PNR the sheet lists but the queue lacks. Covers hand-added rows and rows
  // whose queue entry was lost while the sheet row survived (marked or not).
  // Deduped by PNR: a tab can list the same PNR twice, and an upsert cannot touch
  // the same conflicting row twice in one statement. First occurrence wins.
  const seenInSheet = new Set<string>()
  const missingInDb = sheetRows.filter((s) => {
    const key = s.pnr.toUpperCase()
    if (queuedAnywhere.has(key) || tombstoned.has(key) || noFlight.has(key)) {
      return false
    }
    if (seenInSheet.has(key)) return false
    seenInSheet.add(key)
    return true
  })

  if (missingInDb.length > 0) {
    const { error } = await db.from("pnr_queue").upsert(
      missingInDb.map((s) => ({
        pnr: s.pnr,
        brand_id: brandId,
        queue_status: "pending",
        client_name: s.client_name || null,
        departure_date: s.departure_date || null,
        consultant_name: s.consultant_name || null,
        pnr_type: s.pnr_type || null,
        added_by: actor.profileId,
        sheet_row: s.rowIndex,
      })),
      { onConflict: "pnr" }
    )
    if (error) {
      result.errors.push(`queue insert: ${error.message}`)
    } else {
      result.importedToDb = missingInDb.map((s) => s.pnr)
      const mirrored = await Promise.allSettled(
        missingInDb.map((s) =>
          upsertPnrHistoryFromSheetRow(db, s.pnr, brandId, {
            client_name: s.client_name,
            departure_date: s.departure_date,
            consultant_name: s.consultant_name,
            pnr_type: s.pnr_type,
          })
        )
      )
      for (const m of mirrored) {
        if (m.status === "rejected") {
          result.errors.push(`pnr_history mirror: ${String(m.reason)}`)
        }
      }
    }
  }

  // ── Direction 2: Supabase → sheet ────────────────────────────────────────
  // A PNR the queue holds but the tab no longer lists — the sheet row was deleted
  // by hand. Append it back so both sides carry the same list.
  const missingInSheet = queueRows.filter(
    (q) => !sheetByPnr.has(q.pnr.toUpperCase())
  )

  if (missingInSheet.length > 0) {
    try {
      // Column H names the PNR's owner, so resolve added_by → profile name and
      // fall back to whoever ran the sync only for unowned rows.
      const ownerIds = Array.from(
        new Set(
          missingInSheet.map((q) => q.added_by).filter((v): v is string => !!v)
        )
      )
      const ownerNames = new Map<string, string>()
      if (ownerIds.length > 0) {
        const { data: owners } = await db
          .from("profiles")
          .select("id, full_name, email")
          .in("id", ownerIds)
        for (const o of (owners ?? []) as {
          id: string
          full_name: string | null
          email: string | null
        }[]) {
          const name = o.full_name ?? o.email ?? ""
          if (name) ownerNames.set(o.id, name)
        }
      }

      const historyStatuses = await fetchHistoryStatuses(
        db,
        missingInSheet.map((q) => q.pnr)
      )

      await appendToSheetTab(
        brand,
        missingInSheet.map((q) =>
          toSheetRowValues(
            q,
            (q.added_by ? ownerNames.get(q.added_by) : null) ?? actor.scannedBy,
            historyStatuses.get(q.pnr.toUpperCase()) ?? DEFAULT_MARKED
          )
        )
      )
      result.restoredToSheet = missingInSheet.map((q) => q.pnr)
    } catch (e) {
      result.errors.push(
        `restore to ${brand}: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  // ── Matched rows: copy sheet edits into the queue ─────────────────────────
  // Metadata (A–C, F) flows sheet → queue. Status (column G) flows the other way
  // only: Supabase owns `queue_status`, so a column G that disagrees is a stale or
  // hand-edited cell and gets overwritten, never read back.
  const updates: { pnr: string; patch: Partial<QueueSyncRow> }[] = []
  const statusWrites: { rowIndex: number; colG: string; pnr: string }[] = []
  for (const [key, sheet] of sheetByPnr) {
    const queue = queueByPnr.get(key)
    if (!queue) continue
    const patch = sheetMetadataDiff(sheet, queue)
    if (patch) updates.push({ pnr: queue.pnr, patch })

    const expected = queueStatusToSheetStatus(queue.queue_status)
    if (sheet.status.trim() !== expected) {
      statusWrites.push({ rowIndex: sheet.rowIndex, colG: expected, pnr: queue.pnr })
    }
  }

  if (statusWrites.length > 0) {
    try {
      await updateSheetRows(
        brand,
        statusWrites.map(({ rowIndex, colG }) => ({ rowIndex, colG }))
      )
      result.statusPushed = statusWrites.map((s) => s.pnr)
    } catch (e) {
      result.errors.push(
        `status push to ${brand}: ${e instanceof Error ? e.message : String(e)}`
      )
    }
  }

  if (updates.length > 0) {
    const settled = await Promise.allSettled(
      updates.map(async (u) => {
        const { error } = await db
          .from("pnr_queue")
          .update(u.patch)
          .eq("pnr", u.pnr)
        if (error) throw new Error(`${u.pnr}: ${error.message}`)
        await upsertPnrHistoryFromSheetRow(db, u.pnr, brandId, {
          client_name: u.patch.client_name,
          departure_date: u.patch.departure_date,
          consultant_name: u.patch.consultant_name,
          pnr_type: u.patch.pnr_type,
        })
        return u.pnr
      })
    )
    for (const s of settled) {
      if (s.status === "fulfilled") result.metadataUpdated.push(s.value)
      else result.errors.push(`metadata sync: ${String(s.reason)}`)
    }
  }

  // Re-anchor stored indices last, once every append and insert has landed.
  try {
    await refreshSheetRows(
      db,
      brand,
      result.restoredToSheet.length > 0 ? undefined : sheetRows
    )
  } catch (e) {
    result.errors.push(
      `sheet_row refresh: ${e instanceof Error ? e.message : String(e)}`
    )
  }

  return result
}

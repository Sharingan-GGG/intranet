/**
 * Sheet / queue metadata mirrored on `pnr_history` (same PNR as `pnr_queue`).
 */

/**
 * Normalise a departure date string for a PostgreSQL DATE column.
 * Accepts DD/MM/YYYY (from Google Sheets) and converts to YYYY-MM-DD.
 * Already-ISO strings pass through unchanged. Returns null for invalid input.
 */
function normaliseDateForDb(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = raw.trim()
  // DD/MM/YYYY → YYYY-MM-DD
  const dmyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }
  // Already ISO or another DB-parseable format — return as-is
  return s || null
}

export type PnrSheetMetadata = {
  client_name: string | null
  departure_date: string | null
  consultant_name: string | null
  pnr_type: string | null
}

/** Extract pnr_type from JSON booking data (first flight's sourceType). */
export function extractPnrTypeFromJson(jsonData: unknown): string | null {
  try {
    const obj = jsonData as any
    if (!obj?.flights || !Array.isArray(obj.flights) || obj.flights.length === 0) {
      return null
    }
    const sourceType = obj.flights[0].sourceType
    if (!sourceType) return null
    // If sourceType is ATPCO, map to GDS; otherwise use sourceType as-is
    return sourceType === "ATPCO" ? "GDS" : String(sourceType).trim()
  } catch {
    return null
  }
}

/** Load metadata from `pnr_queue` (unique `pnr`; brand filter not needed). */
export async function fetchPnrQueueMetadata(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  pnr: string,
  _brandId: number
): Promise<PnrSheetMetadata | null> {
  const { data, error } = await db
    .from("pnr_queue")
    .select("client_name, departure_date, consultant_name, pnr_type")
    .eq("pnr", pnr)
    .maybeSingle()

  if (error || !data) return null
  return {
    client_name: data.client_name ?? null,
    departure_date: data.departure_date ?? null,
    consultant_name: data.consultant_name ?? null,
    pnr_type: data.pnr_type ?? null,
  }
}

function nonEmpty(v: string | null | undefined): v is string {
  return v != null && String(v).trim() !== ""
}

/**
 * Prefer queue values when set; fallback to extracted from JSON; otherwise keep existing `pnr_history` fields.
 */
export function mergeSheetMetadataForHistory(
  queue: PnrSheetMetadata | null,
  previous: Partial<PnrSheetMetadata> | null,
  jsonData?: unknown
): PnrSheetMetadata {
  const q: Partial<PnrSheetMetadata> = queue ?? {}
  const p: Partial<PnrSheetMetadata> = previous ?? {}
  const jsonPnrType = extractPnrTypeFromJson(jsonData)

  return {
    client_name: nonEmpty(q.client_name)
      ? String(q.client_name).trim()
      : nonEmpty(p.client_name)
        ? String(p.client_name).trim()
        : null,
    departure_date: nonEmpty(q.departure_date)
      ? normaliseDateForDb(q.departure_date)
      : nonEmpty(p.departure_date)
        ? normaliseDateForDb(p.departure_date)
        : null,
    consultant_name: nonEmpty(q.consultant_name)
      ? String(q.consultant_name).trim()
      : nonEmpty(p.consultant_name)
        ? String(p.consultant_name).trim()
        : null,
    pnr_type: nonEmpty(q.pnr_type)
      ? String(q.pnr_type).trim()
      : jsonPnrType
        ? jsonPnrType
        : nonEmpty(p.pnr_type)
          ? String(p.pnr_type).trim()
          : null,
  }
}

/**
 * After sheet import upserts `pnr_queue`, mirror columns onto `pnr_history`
 * without clobbering status / raw_summary on existing synced rows.
 */
export async function upsertPnrHistoryFromSheetRow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  pnr: string,
  brandId: number,
  row: {
    client_name?: string | null
    departure_date?: string | null
    consultant_name?: string | null
    pnr_type?: string | null
  }
): Promise<void> {
  const patch = {
    brand_id: brandId,
    client_name: row.client_name?.trim() || null,
    departure_date: normaliseDateForDb(row.departure_date),
    consultant_name: row.consultant_name?.trim() || null,
    pnr_type: row.pnr_type?.trim() || null,
  }

  const { data: existing } = await db
    .from("pnr_history")
    .select("id")
    .eq("pnr", pnr)
    .maybeSingle()

  if (existing) {
    const { error } = await db.from("pnr_history").update(patch).eq("pnr", pnr)
    if (error) throw new Error(`pnr_history update: ${error.message}`)
    return
  }

  const { error } = await db.from("pnr_history").insert({
    pnr,
    ...patch,
    status: "PROCESSING",
    processed_at: new Date().toISOString(),
    raw_summary: { source: "sheet_import" },
  })
  if (error) throw new Error(`pnr_history insert: ${error.message}`)
}

/** Dashboard buckets: pending vs exception (see pnr_queue migration). */
export type PnrQueueWorkflowStatus = "pending" | "exception"

/**
 * After Sabre Scan PNR: set `queue_status` from operational total (green → pending, red → exception).
 * Upserts so PNRs without a prior sheet row still appear in the correct dashboard column.
 */
export async function upsertPnrQueueWorkflowAfterScan(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  args: {
    pnr: string
    brandId: number
    queueStatus: PnrQueueWorkflowStatus
    processedAt: string
    meta: PnrSheetMetadata
  }
): Promise<void> {
  const normalizedStatus: PnrQueueWorkflowStatus =
    args.queueStatus === "exception" ? "exception" : "pending"

  const { data: existing } = await db
    .from("pnr_queue")
    .select(
      "added_by, client_name, departure_date, consultant_name, pnr_type, sheet_row"
    )
    .eq("pnr", args.pnr)
    .maybeSingle()

  const row = {
    pnr: args.pnr,
    brand_id: args.brandId,
    queue_status: normalizedStatus,
    processed_at: args.processedAt,
    client_name:
      args.meta.client_name ?? existing?.client_name ?? null,
    departure_date:
      args.meta.departure_date ?? existing?.departure_date ?? null,
    consultant_name:
      args.meta.consultant_name ?? existing?.consultant_name ?? null,
    pnr_type: args.meta.pnr_type ?? existing?.pnr_type ?? null,
    added_by: existing?.added_by ?? null,
    sheet_row: existing?.sheet_row ?? null,
  }

  const { error } = await db
    .from("pnr_queue")
    .upsert(row, { onConflict: "pnr" })
  if (error) throw new Error(`pnr_queue workflow upsert: ${error.message}`)
}

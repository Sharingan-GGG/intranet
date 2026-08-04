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
 *
 * A scan only owns `queue_status`, `processed_at` and the metadata it derived. It
 * must never touch `brand_id`, `sheet_row` or `added_by` on a row that already
 * exists — `args.brandId` is the brand the *scan* ran under (the dashboard tab the
 * user happens to be on), not the brand the PNR belongs to. Writing it back undoes
 * a move seconds after it lands, and re-asserting a `sheet_row` read moments earlier
 * clobbers whatever `refreshSheetRows` re-anchored in the meantime.
 *
 * Those three columns are set once, on insert, for a PNR the queue has never seen.
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
    .select("id")
    .eq("pnr", args.pnr)
    .maybeSingle()

  // Only carry across metadata the scan actually resolved; a null must not blank a
  // value the sheet or an earlier scan already supplied.
  const metaPatch: Record<string, string> = {}
  if (nonEmpty(args.meta.client_name)) metaPatch.client_name = args.meta.client_name
  if (nonEmpty(args.meta.departure_date))
    metaPatch.departure_date = args.meta.departure_date
  if (nonEmpty(args.meta.consultant_name))
    metaPatch.consultant_name = args.meta.consultant_name
  if (nonEmpty(args.meta.pnr_type)) metaPatch.pnr_type = args.meta.pnr_type

  if (existing) {
    const { error } = await db
      .from("pnr_queue")
      .update({
        queue_status: normalizedStatus,
        processed_at: args.processedAt,
        ...metaPatch,
      })
      .eq("pnr", args.pnr)
    if (error) throw new Error(`pnr_queue workflow update: ${error.message}`)
    return
  }

  const { error } = await db.from("pnr_queue").insert({
    pnr: args.pnr,
    brand_id: args.brandId,
    queue_status: normalizedStatus,
    processed_at: args.processedAt,
    ...metaPatch,
  })
  if (error) throw new Error(`pnr_queue workflow insert: ${error.message}`)
}

/**
 * Freeze the first scan verdict for this queue occurrence, for the monthly
 * exception/pending rate in Queue Health.
 *
 * Write-once by construction: the unique `(pnr, queued_at)` makes every later scan of
 * the same occurrence a no-op. That is the point — a month already reported on must
 * not shift because someone re-scanned or approved a PNR afterwards. `queued_at` is
 * the queue row's `created_at`, so a PNR deleted and re-imported later counts again
 * in the month it reappears rather than being masked by its first verdict forever.
 *
 * Only ever called from the scan path. A sheet import writes `queue_status: "pending"`
 * as a placeholder without consulting pnr_json / pnr_p3 / pnr_ticket, and counting
 * that as a verdict would dilute the exception rate with rows nobody scanned.
 */
export async function recordInitialScanOutcome(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  args: {
    pnr: string
    brandId: number
    verdict: PnrQueueWorkflowStatus
    decidedAt: string
    consultantName: string | null
  }
): Promise<void> {
  const { data: queueRow } = await db
    .from("pnr_queue")
    .select("created_at")
    .eq("pnr", args.pnr)
    .maybeSingle()

  const { error } = await db.from("pnr_scan_outcomes").insert({
    pnr: args.pnr,
    brand_id: args.brandId,
    verdict: args.verdict,
    decided_at: args.decidedAt,
    // Copied, not referenced: the row must keep reporting correctly after the queue
    // row is deleted or its consultant reassigned.
    consultant_name: args.consultantName?.trim() || null,
    // created_at is nullable on pnr_queue; fall back so the unique key is never null,
    // which Postgres would treat as distinct and let duplicates through.
    queued_at: queueRow?.created_at ?? args.decidedAt,
  })

  // 23505 is the unique violation: this occurrence already has its first verdict.
  // Expected on every re-scan, and exactly what freezing means — not a failure.
  if (error && error.code !== "23505") {
    throw new Error(`pnr_scan_outcomes insert: ${error.message}`)
  }
}

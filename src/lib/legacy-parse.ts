import { parseTicketSoap } from "@/lib/parse-ticket-soap"
import type { P3FetchResult, PnrJsonData, PnrTicketRow } from "@/lib/pnr-types"

/**
 * Normalize legacy PHP responses for PNR_P3 into P3FetchResult.
 */
export function toP3FetchResult(parsed: unknown): P3FetchResult {
  if (parsed == null) return { error: "empty response" }
  if (typeof parsed === "string") return { body: parsed, soap: true }
  if (typeof parsed !== "object") return { error: "invalid P3 payload" }
  const o = parsed as Record<string, unknown>
  if (typeof o.error === "string" && o.error.trim()) return { error: o.error }
  const body =
    (typeof o.body === "string" && o.body) ||
    (typeof o.xml === "string" && o.xml) ||
    (typeof o.soap === "string" && o.soap) ||
    ""
  return {
    soap: o.soap != null ? o.soap : true,
    encoded: Boolean(o.encoded),
    body: body || JSON.stringify(o),
  }
}

/** fetchDatabase PNR_TICKET: validate `tickets` + `parseTicketSoap` per row (legacy soap_ticket.js) */
export type PnrTicketParseIssue =
  | null
  /** JSON payload error, HTTP error, or { error: ... } with no rows */
  | "load_failed"
  /** No `tickets` array or length 0 (after success / shape checks) */
  | "not_non_empty_tickets"
  | "row_missing_ticket_or_soap"
  /** All rows returned no Ticket blocks or parseTicketSoap was null (SOAP shape / parse) */
  | "all_soap_parsed_empty"
  /** At least one object, but every ticket has no ServiceCoupons (XML content issue, not “wrong table”) */
  | "no_service_coupons_after_parse"

export type PnrTicketLoadResult = {
  rows: PnrTicketRow[] | null
  fetchFailed: boolean
  issue: PnrTicketParseIssue
}

/**
 * `fetchDatabase.php` + `{ table: "PNR_TICKET", pnr }` → JSON with `tickets: [{ ticket, soap }, ...]`.
 * Validates non-empty `tickets` and non-empty `soap` per row, then `parseTicketSoap` each row and flattens.
 * Only the flattened, SOAP-parsed list is used for `compareJsonTravelers` / pipeline.
 */
/**
 * `pnr_ticket.soap_xml` from Supabase: one blob or multiple P4 responses joined by
 * `<!-- p4-doc-boundary -->` (see lib/sabre/transform.ts).
 */
export function ticketsFromStoredP4Soap(
  pnr: string,
  soapXml: string | null | undefined
): PnrTicketLoadResult {
  if (!soapXml?.trim()) {
    return { rows: null, fetchFailed: false, issue: "not_non_empty_tickets" }
  }
  const chunks = soapXml.split(
    /\n<!-- (?:p4-doc-boundary|pnr-fetch:p4-doc) -->\n/
  )
  const allTickets: PnrTicketRow[] = []
  for (const chunk of chunks) {
    const c = chunk.trim()
    if (!c) continue
    const parsed = parseTicketSoap(pnr, c)
    if (parsed && parsed.length > 0)
      allTickets.push(...(parsed as PnrTicketRow[]))
  }
  if (allTickets.length === 0) {
    return { rows: null, fetchFailed: false, issue: "all_soap_parsed_empty" }
  }
  const anyCoupons = allTickets.some(
    (t) =>
      Array.isArray((t as { ServiceCoupons?: unknown[] })?.ServiceCoupons) &&
      (t as { ServiceCoupons: unknown[] }).ServiceCoupons.length > 0
  )
  if (!anyCoupons) {
    return {
      rows: allTickets,
      fetchFailed: false,
      issue: "no_service_coupons_after_parse",
    }
  }
  return { rows: allTickets, fetchFailed: false, issue: null }
}

export function parsePnrTicketDatabaseResponse(
  parsed: unknown
): PnrTicketLoadResult {
  if (parsed == null)
    return { rows: null, fetchFailed: true, issue: "load_failed" }
  /** Test fixtures / pre-parsed client payloads only — production uses `{ tickets, ... }` from fetchDatabase */
  if (Array.isArray(parsed)) {
    return { rows: parsed as PnrTicketRow[], fetchFailed: false, issue: null }
  }
  if (typeof parsed === "object" && parsed !== null) {
    const o = parsed as Record<string, unknown>
    if (typeof o.error === "string" && o.error.trim()) {
      return { rows: null, fetchFailed: true, issue: "load_failed" }
    }
    const rawList = o.tickets
    if (!Array.isArray(rawList) || rawList.length === 0) {
      return { rows: null, fetchFailed: false, issue: "not_non_empty_tickets" }
    }
    for (const item of rawList) {
      if (typeof item !== "object" || item === null) {
        return {
          rows: null,
          fetchFailed: false,
          issue: "row_missing_ticket_or_soap",
        }
      }
      const row = item as Record<string, unknown>
      const tId = row.ticket
      const soap = row.soap
      const tOk = typeof tId === "string" || typeof tId === "number"
      const soapStr =
        typeof soap === "string" ? soap : soap != null ? String(soap) : ""
      if (!tOk || !soapStr.trim()) {
        return {
          rows: null,
          fetchFailed: false,
          issue: "row_missing_ticket_or_soap",
        }
      }
    }
    const allTickets: PnrTicketRow[] = []
    for (const item of rawList) {
      const row = item as Record<string, unknown>
      const tNum = String(row.ticket ?? "")
      const soap =
        typeof row.soap === "string" ? row.soap : String(row.soap ?? "")
      const chunk = parseTicketSoap(tNum, soap)
      if (chunk && chunk.length > 0)
        allTickets.push(...(chunk as PnrTicketRow[]))
    }
    if (allTickets.length === 0) {
      return { rows: null, fetchFailed: false, issue: "all_soap_parsed_empty" }
    }
    const anyCoupons = allTickets.some(
      (t) =>
        Array.isArray((t as { ServiceCoupons?: unknown[] })?.ServiceCoupons) &&
        (t as { ServiceCoupons: unknown[] }).ServiceCoupons.length > 0
    )
    if (!anyCoupons) {
      return {
        rows: allTickets,
        fetchFailed: false,
        issue: "no_service_coupons_after_parse",
      }
    }
    return { rows: allTickets, fetchFailed: false, issue: null }
  }
  return { rows: null, fetchFailed: true, issue: "load_failed" }
}

/**
 * @deprecated Prefer `parsePnrTicketDatabaseResponse` (returns `issue` for PNR_TICKET messages).
 * `fetchFailed` is only true for API / JSON / `{ error }` failures, not for validation/SOAP issues.
 */
export function extractTicketsArray(parsed: unknown): {
  rows: PnrTicketRow[] | null
  fetchFailed: boolean
} {
  const r = parsePnrTicketDatabaseResponse(parsed)
  return { rows: r.rows, fetchFailed: r.fetchFailed }
}

export function parseJsonPayload(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return { error: "JSON parse failed" }
  }
}

/** `pnr_json.data` jsonb from Supabase — already the booking object */
export function parsePnrJsonFromSnapshotData(data: unknown): PnrJsonData | null {
  if (data == null) return null
  if (typeof data === "object") return data as PnrJsonData
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as PnrJsonData
    } catch {
      return null
    }
  }
  return null
}

/** Extract `data` / root PNR object from fetchDatabase PNR_JSON response */
export function parsePnrJsonFromLegacyResponse(
  parsed: unknown
): PnrJsonData | null {
  if (parsed == null) return null
  if (typeof parsed === "object" && parsed !== null && "error" in parsed) {
    const err = (parsed as { error?: string }).error
    if (err) return null
  }
  if (typeof parsed === "string") {
    try {
      return JSON.parse(parsed) as PnrJsonData
    } catch {
      return null
    }
  }
  if (typeof parsed === "object" && parsed !== null && "data" in parsed) {
    const d = (parsed as { data: unknown }).data
    if (typeof d === "string") {
      try {
        return JSON.parse(d) as PnrJsonData
      } catch {
        return null
      }
    }
    return d as PnrJsonData
  }
  return parsed as PnrJsonData
}

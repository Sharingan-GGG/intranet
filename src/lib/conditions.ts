/**
 * Port of rules from /pre/conditions.md — tab status and total aggregation.
 * Pure functions, safe for client and server. No network I/O.
 */

import { evaluateFlightDetailsMother, type BookingJson } from "./flight-details"
import {
  evaluateMessagesAlarmFromPnrJson,
  mergeMessagesAlarmWithP3Codes,
  SPECIAL_MESSAGE_CODES as SPECIAL_MESSAGE_CODES_ARR,
  SPECIAL_MESSAGE_EXCEPTION_CODES as SPECIAL_MESSAGE_EXCEPTION_CODES_ARR,
  CODES_EXCLUDED_FROM_EXCEPTION as CODES_EXCLUDED_FROM_EXCEPTION_ARR,
  OTHER_MESSAGE_CODES as OTHER_MESSAGE_CODES_ARR,
} from "./messages-mother"
import {
  evaluateP3MotherFromFetch,
  p3FetchResultToApiJson,
  p3MotherLabelToTabStatus,
} from "./p3-mother"
import type {
  MotherTabKey,
  P3FetchResult,
  PnrJsonData,
  PnrTicketRow,
  TabStatus,
} from "./pnr-types"
import { getTotalStatusFromMothers } from "./total-mother"
import {
  getTicketStatusFromTickets,
  type PnrVsTicketsPipelineResult,
} from "./pnr-tickets-pipeline"

export { getTotalStatusFromMothers }

// --- Re-export for legacy / dashboard string-set consumers (Set API)
export const SPECIAL_MESSAGE_CODES = new Set<string>(
  SPECIAL_MESSAGE_CODES_ARR as readonly string[]
)
export const SPECIAL_MESSAGE_EXCEPTION_CODES = new Set<string>(
  SPECIAL_MESSAGE_EXCEPTION_CODES_ARR as readonly string[]
)
export const CODES_EXCLUDED_FROM_EXCEPTION = new Set<string>(
  CODES_EXCLUDED_FROM_EXCEPTION_ARR as readonly string[]
)
export const OTHER_MESSAGE_CODES = new Set<string>(
  OTHER_MESSAGE_CODES_ARR as readonly string[]
)

// --- Flights (Flight-details) — same mother rules as /pre/ pnr.js (passenger + TD + GK/TOUR)
export function getFlightTabStatus(
  data: PnrJsonData | null | undefined
): TabStatus {
  const ev = evaluateFlightDetailsMother(data as BookingJson)
  return ev.pnrMotherException ? "exception" : "pending"
}

export {
  evaluateFlightDetailsMother,
  flightHasException as flightRowHasException,
} from "./flight-details"

// --- P3 — js/p3.js mother (SOAP/XML, TKNE vs flights) when PNR_JSON is available
export function getP3TabStatusFromFetch(
  result: P3FetchResult | null,
  pnrData?: PnrJsonData | null
): TabStatus {
  if (pnrData != null) {
    const api = p3FetchResultToApiJson(result)
    const label = evaluateP3MotherFromFetch(
      pnrData as BookingJson,
      api ?? undefined
    )
    return p3MotherLabelToTabStatus(label)
  }
  if (!result) return "exception"
  if (result.error) return "exception"
  const body = typeof result.body === "string" ? result.body : ""
  const soapStr = typeof result.soap === "string" ? result.soap : ""
  if (!soapStr && body && !body.includes("A3S")) return "exception"
  if (!soapStr && !body) return "exception"
  return "pending"
}

/** Placeholder: deep TKNE vs flight comparison — return exception when not implemented and strict mode. */
export function getP3ExceptionFromDeepValidation(): boolean {
  // Parser placeholder: wire SOAP TKNE vs PNR when backend exposes structured data.
  return false
}

// --- Tickets (PNR vs TICKETS) — one pipeline: clone → enrich → compareJsonTravelers once → mother
export function getTicketTabStatus(
  tickets: PnrTicketRow[] | null | undefined,
  parserUnavailable?: boolean,
  pnrData?: PnrJsonData | null,
  /** When set, tab mother matches this (avoids a second compare in the parent). */
  ticketPipelineResult?: PnrVsTicketsPipelineResult | null
): TabStatus {
  if (parserUnavailable) return "exception"
  if (!tickets || tickets.length === 0) return "exception"
  if (pnrData != null) {
    if (ticketPipelineResult) {
      return ticketPipelineResult.motherStatus === "Exception"
        ? "exception"
        : "pending"
    }
    const label = getTicketStatusFromTickets(pnrData, tickets)
    return label === "Exception" ? "exception" : "pending"
  }
  return "exception"
}

// --- Messages — pnr.js specialServices alarm (+ optional P3 SSR merge)
export function getMessagesAlarmLevel(
  data: PnrJsonData | null | undefined,
  p3SsrCodes?: string[] | null
): "none" | "warning" | "exception" {
  if (!data) return "none"
  const base = evaluateMessagesAlarmFromPnrJson(data)
  const merged = mergeMessagesAlarmWithP3Codes(base, p3SsrCodes)
  if (merged.alarmIsRed) return "exception"
  if (merged.alarmIsOrange) return "warning"
  return "none"
}

export function getMessagesTabStatus(
  data: PnrJsonData | null | undefined,
  p3SsrCodes?: string[] | null
): TabStatus {
  const level = getMessagesAlarmLevel(data, p3SsrCodes)
  if (level === "exception") return "exception"
  if (level === "warning") return "warning"
  return "pending"
}

// --- Total — flight / P3 / ticket only (Messages tab excluded from aggregate)

export function computeMotherTabStatuses(
  pnrData: PnrJsonData,
  p3State: { tab: TabStatus } | null
): Record<MotherTabKey, TabStatus> {
  const flight = getFlightTabStatus(pnrData)
  const p3 = p3State?.tab ?? getP3TabStatusFromFetch(null, pnrData)
  const tickets = (pnrData as { _tickets?: PnrTicketRow[] })._tickets
  const ticket = getTicketTabStatus(tickets, false, pnrData)
  const messages = getMessagesTabStatus(pnrData)
  const total = getTotalStatusFromMothers({ flight, p3, ticket })
  return { flight, p3, ticket, messages, total }
}

/**
 * Simpler aggregate used when we only have PNR_JSON: fill P3/ticket with placeholders.
 */
export function buildStatusesFromPnrJsonOnly(
  pnrData: PnrJsonData,
  p3Fetch: P3FetchResult | null
): Record<MotherTabKey, TabStatus> {
  const flight = getFlightTabStatus(pnrData)
  const p3 = getP3TabStatusFromFetch(p3Fetch, pnrData)
  const ticket = getTicketTabStatus(null, true, pnrData)
  const messages = getMessagesTabStatus(pnrData)
  const total = getTotalStatusFromMothers({ flight, p3, ticket })
  return { flight, p3, ticket, messages, total }
}

/** P3 fetch is not performed when there is no confirmation id in PNR_JSON (legacy rule). */
export function shouldSkipP3Fetch(
  pnr: PnrJsonData | null | undefined
): boolean {
  const id = pnr?.request?.confirmationId
  return !id || String(id).trim() === ""
}

/**
 * After PNR_JSON + optional PNR_P3 + PNR_TICKET responses are loaded, compute all mother tab dots.
 */
export function buildDetailedTabStatuses(
  pnr: PnrJsonData | null,
  p3Skipped: boolean,
  p3Result: P3FetchResult | null,
  tickets: PnrTicketRow[] | null,
  ticketParserUnavailable: boolean,
  /** Optional: SSR-style codes from P3 for messages tab merge; pass `undefined` until parsed */
  p3SsrCodes?: string[] | null,
  /** Same object as the UI (runPnrVsTicketsPipeline); avoids a second compareJsonTravelers pass */
  ticketPipelineResult?: PnrVsTicketsPipelineResult | null
): Record<MotherTabKey, TabStatus> {
  if (!pnr) {
    return {
      flight: "pending",
      p3: "pending",
      ticket: "pending",
      messages: "pending",
      total: "pending",
    }
  }
  const flight = getFlightTabStatus(pnr)
  const p3: TabStatus = p3Skipped
    ? "pending"
    : getP3TabStatusFromFetch(p3Result, pnr)
  const ticket = getTicketTabStatus(
    tickets,
    ticketParserUnavailable,
    pnr,
    ticketPipelineResult
  )
  const messages = getMessagesTabStatus(pnr, p3SsrCodes)
  const total = getTotalStatusFromMothers({ flight, p3, ticket })
  return { flight, p3, ticket, messages, total }
}

function tabToDotClass(
  status: TabStatus
): "bg-emerald-500" | "bg-destructive" | "bg-amber-500" {
  if (status === "exception") return "bg-destructive"
  if (status === "warning") return "bg-amber-500"
  return "bg-emerald-500"
}

export function tabStatusDotClass(status: TabStatus): string {
  return `size-2 rounded-full ${tabToDotClass(status)}`
}

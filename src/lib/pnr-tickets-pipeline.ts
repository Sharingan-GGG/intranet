/**
 * PNR vs Tickets — single pipeline (processTicketsFromDatabase + getTicketStatusFromTickets)
 *
 * 1) Deep-clone the full ticket array for the PNR
 * 2) enrichTicketFromBooking (flightTickets metadata) for each ticket
 * 3) compareJsonTravelers(booking, tickets) **once** on the full array (legacy behavior)
 * 4) Derive mother from compared tickets (TE + latest issue date per pax, any !match) — no second compare
 *
 * QA vs legacy: row counts, Match/UNMATCH, sort (TE, issue date desc), mother, empty/fetch → Exception
 */

import {
  attachPnrTicketMetadata,
  compareJsonTravelers,
  sortTicketsForCompareDisplay,
  type TicketRow,
} from "./ticket-mother"

/** Legacy `processTicketsFromDatabase` merge — same as attachPnrTicketMetadata */
export { attachPnrTicketMetadata as enrichTicketFromBooking } from "./ticket-mother"

export type PnrVsTicketsPipelineResult = {
  comparedTickets: TicketRow[]
  /** soap_ticket: TE + latest / pax, any !comparison.match on representative set */
  motherStatus: "Pending" | "Exception"
}

function deriveTicketMotherStatusFromCompared(
  bookingData: Record<string, unknown> | null | undefined,
  comparedTickets: TicketRow[]
): "Pending" | "Exception" {
  if (!bookingData) return "Exception"
  const src = bookingData as {
    flightTickets?: unknown[]
    travelers?: unknown[]
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getIssueDate = (t: any) => {
    const dt = t.details?.LocalIssueDateTime
    return dt ? String(dt).split("T")[0] : ""
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getPassengerName = (t: any) => {
    if (t.passengerName) return String(t.passengerName).trim()
    const ticketNum = String(t.TicketNumber || "").trim()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pnrTicket = (src.flightTickets as any[])?.find((f: any) => {
      const n = String(f.number || "").trim()
      return n === ticketNum || n.split("/")[0] === ticketNum
    })
    const ti = pnrTicket?.travelerIndex ?? 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const travelers = (src.travelers || []) as any[]
    const traveler = ti && travelers.length ? travelers[ti - 1] : null
    return traveler
      ? `${traveler.givenName || ""} ${traveler.surname || ""}`.trim()
      : ""
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getStatusCode = (t: any) =>
    String(t.ticketStatusCode || "")
      .trim()
      .toUpperCase()
  const byPassenger = new Map<
    string,
    { ticket: TicketRow; issueDate: string; statusCode: string }[]
  >()
  comparedTickets.forEach((tick) => {
    const pax = getPassengerName(tick)
    if (!byPassenger.has(pax)) byPassenger.set(pax, [])
    byPassenger.get(pax)!.push({
      ticket: tick,
      issueDate: getIssueDate(tick),
      statusCode: getStatusCode(tick),
    })
  })
  const latestTickets: TicketRow[] = []
  byPassenger.forEach((list) => {
    const teOnly = list.filter((a) => a.statusCode === "TE")
    if (teOnly.length === 0) return
    const sorted = teOnly
      .slice()
      .sort((a, b) => (b.issueDate || "").localeCompare(a.issueDate || ""))
    const best = sorted[0]
    if (best) latestTickets.push(best.ticket)
  })
  const hasMismatch = latestTickets.some(
    (t) =>
      Array.isArray(t.ServiceCoupons) &&
      t.ServiceCoupons.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (coupon: any) =>
          Array.isArray(coupon.comparisons) &&
          coupon.comparisons.some(
            (comparison: { match: boolean }) => !comparison.match
          )
      )
  )
  return hasMismatch ? "Exception" : "Pending"
}

/**
 * Clone → enrich all → **one** compareJsonTravelers on the full list (legacy).
 * Raw parse has ServiceCoupons but no `comparisons` until this runs — do not treat raw parse as compared.
 */
export function runPnrVsTicketsPipeline(
  bookingData: Record<string, unknown> | null | undefined,
  rawTickets: TicketRow[] | null | undefined
): PnrVsTicketsPipelineResult {
  if (!bookingData || !rawTickets || rawTickets.length === 0) {
    return { comparedTickets: [], motherStatus: "Exception" }
  }
  const copies: TicketRow[] = JSON.parse(JSON.stringify(rawTickets))
  for (const t of copies) {
    attachPnrTicketMetadata(bookingData, t)
  }
  compareJsonTravelers(bookingData, copies)
  const motherStatus = deriveTicketMotherStatusFromCompared(bookingData, copies)
  return { comparedTickets: copies, motherStatus }
}

/** One pipeline only — no double compareJsonTravelers */
export function getTicketStatusFromTickets(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bookingData: any,
  rawTickets: TicketRow[] | null | undefined
): "Pending" | "Exception" {
  return runPnrVsTicketsPipeline(bookingData, rawTickets).motherStatus
}

export const getTicketStatusFromTicketsLegacy = getTicketStatusFromTickets

export function getSortedTicketsForCompareUi(
  tickets: TicketRow[]
): TicketRow[] {
  return sortTicketsForCompareDisplay(tickets)
}

export function prepareTicketsForCompareView(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bookingData: any,
  tickets: TicketRow[] | null | undefined
): TicketRow[] {
  return runPnrVsTicketsPipeline(bookingData, tickets).comparedTickets
}

export function rawTicketsLackServiceCoupons(
  tickets: unknown[] | null | undefined
): boolean {
  if (!tickets?.length) return true
  return !tickets.some((t) => {
    const sc = (t as { ServiceCoupons?: unknown[] })?.ServiceCoupons
    return Array.isArray(sc) && sc.length > 0
  })
}

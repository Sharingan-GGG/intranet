/**
 * Flight-details (Flights tab) — ported from /pre/ js/pnr.js (per user spec).
 * Data: PNR_JSON (travelers, flights, allSegments, request, …).
 */

import type {
  PnrJsonData,
  PnrJsonFlight,
  PnrJsonLoyaltyProgram,
  PnrJsonSegment,
  PnrJsonTraveler,
} from "./pnr-types"
import { formatAdlItineraryDateTime } from "./datetime-adl"

export type LoyaltyProgram = PnrJsonLoyaltyProgram
export type FlightSegment = PnrJsonFlight
export type SegmentRow = PnrJsonSegment
export type Traveler = PnrJsonTraveler
export type BookingJson = PnrJsonData

export type FlightDetailsMotherStatus = "Pending" | "Exception"

export type FlightDetailsEvaluation = {
  motherStatus: FlightDetailsMotherStatus
  hasAnyPassengerFlightException: boolean
  hasAnyTdException: boolean
  hasGkTourBooking: boolean
  pnrMotherException: boolean
}

// --- GK / TOUR ---

export function hasTourSegmentForTcBookingFromBookingJson(
  data: BookingJson | null | undefined
): boolean {
  if (!data || !Array.isArray(data.allSegments)) return false
  return data.allSegments.some((seg) => {
    if (seg == null) return false
    const type = String(seg.type || "").toUpperCase()
    const vendor = String(seg.vendorCode || "").toUpperCase()
    if (type !== "TOUR" || vendor !== "YY") return false
    const tourText = seg.text != null ? String(seg.text).trim() : ""
    return tourText.length > 0
  })
}

// --- Segment ordering ---

export type OrderedRow =
  | { kind: "arnk"; segment: SegmentRow }
  | { kind: "flight"; flight: FlightSegment }

export function buildOrderedFlightRowsFromAllSegments(
  data: BookingJson,
  flightsForPassenger: FlightSegment[]
): OrderedRow[] {
  const byItemId = new Map<string, FlightSegment>()
  ;(flightsForPassenger || []).forEach((f) => {
    if (
      f.itemId !== undefined &&
      f.itemId !== null &&
      String(f.itemId) !== ""
    ) {
      byItemId.set(String(f.itemId), f)
    }
  })
  const segments = data.allSegments || []
  const rows: OrderedRow[] = []
  for (const seg of segments) {
    if (seg == null) continue
    const segType = String(seg.type || "").toUpperCase()
    if (segType === "ARNK") {
      rows.push({ kind: "arnk", segment: seg })
      continue
    }
    if (segType === "FLIGHT") {
      const id = seg.id != null ? String(seg.id) : ""
      const flight = id ? byItemId.get(id) : undefined
      if (flight) rows.push({ kind: "flight", flight })
    }
  }
  return rows
}

export function getReceiverInfoForAirline(
  loyaltyPrograms: LoyaltyProgram[],
  airlineCode: string
) {
  if (!airlineCode) return { display: "N/A", matchCount: 0 }
  const air = airlineCode.toUpperCase()
  const matches = loyaltyPrograms.filter(
    (lp) => (lp.receiverCode || "").toUpperCase() === air
  )
  if (!matches.length) return { display: "N/A", matchCount: 0 }
  const receiverCode = air
  const supplierParts = matches
    .map((lp) => {
      const sc = String(lp.supplierCode || "").trim()
      const pn = String(lp.programNumber || "").trim()
      return pn ? `${sc} - ${pn}` : sc || null
    })
    .filter(Boolean) as string[]
  const display = supplierParts.length
    ? `${receiverCode} | ${supplierParts.join(", ")}`
    : receiverCode
  return { display, matchCount: matches.length }
}

/** Legacy: flightHasException — HK/KK flight + HK/KK seat + seat must exist */
export function flightHasException(
  flight: FlightSegment,
  passengerSeatIndex: number
): boolean {
  const flightStatusCode = (flight.flightStatusCode || "").toUpperCase()
  if (flightStatusCode !== "HK" && flightStatusCode !== "KK") return true

  let seatStatusCode = ""
  let hasSeatData = false
  const seatAtIdx = flight.seats && flight.seats[passengerSeatIndex]
  const fallbackSeat = (flight.seats || []).find(
    (s) => s && s.statusCode != null
  )
  if (seatAtIdx && seatAtIdx.statusCode != null) {
    hasSeatData = true
    seatStatusCode = (seatAtIdx.statusCode || "").toUpperCase()
  } else if (fallbackSeat) {
    hasSeatData = true
    seatStatusCode = (fallbackSeat.statusCode || "").toUpperCase()
  }
  if (!hasSeatData) return true
  if (seatStatusCode !== "HK" && seatStatusCode !== "KK") return true
  return false
}

export function passengerHasException(
  data: BookingJson,
  passengerSeatIndex: number
): boolean {
  const travelerIndex = passengerSeatIndex + 1
  const flightsForPassenger = (data.flights || []).filter(
    (f) => !f.travelerIndices || f.travelerIndices.includes(travelerIndex)
  )
  return flightsForPassenger.some((flight) =>
    flightHasException(flight, passengerSeatIndex)
  )
}

export function getRowsToRenderForPassenger(
  data: BookingJson,
  passengerSeatIndex: number
): OrderedRow[] {
  const travelerIndex = passengerSeatIndex + 1
  const flightsForPassenger = (data.flights || []).filter(
    (f) => !f.travelerIndices || f.travelerIndices.includes(travelerIndex)
  )
  const allSegments = data.allSegments || []
  const orderedRows = buildOrderedFlightRowsFromAllSegments(
    data,
    flightsForPassenger
  )
  const flightCountInOrdered = orderedRows.filter(
    (r) => r.kind === "flight"
  ).length
  const useSegmentOrderFallback =
    allSegments.length === 0 ||
    (flightsForPassenger.length > 0 &&
      (orderedRows.length === 0 || flightCountInOrdered === 0))
  return useSegmentOrderFallback
    ? flightsForPassenger.map((flight) => ({ kind: "flight", flight }))
    : orderedRows
}

/**
 * One TD table row: receiver / flight / seat (legacy buildFlightsTableForPassenger condition).
 */
export function tdRowHasException(
  flight: FlightSegment,
  data: BookingJson,
  passengerSeatIndex: number
): boolean {
  const traveler = data.travelers && data.travelers[passengerSeatIndex]
  const loyaltyPrograms = (traveler && traveler.loyaltyPrograms) || []
  const airlineCode = flight.airlineCode || ""

  let seatStatusCode = ""
  let hasSeatData = false
  const seatAtIdx = flight.seats && flight.seats[passengerSeatIndex]
  const fallbackSeat = (flight.seats || []).find(
    (s) => s && s.statusCode != null
  )
  const seat =
    seatAtIdx && seatAtIdx.statusCode != null ? seatAtIdx : fallbackSeat
  if (seat) {
    hasSeatData = true
    seatStatusCode = (seat.statusCode || "").toUpperCase()
  }

  const receiverInfo = getReceiverInfoForAirline(loyaltyPrograms, airlineCode)
  const receiverDisplay = receiverInfo.display
  const receiverNoMatch =
    loyaltyPrograms.length > 0 && receiverDisplay === "N/A"
  const receiverMultipleSc = receiverInfo.matchCount > 1

  const flightStatusCode = (flight.flightStatusCode || "").toUpperCase()
  const flightStatusOk = flightStatusCode === "HK" || flightStatusCode === "KK"
  const seatStatusOk =
    hasSeatData && (seatStatusCode === "HK" || seatStatusCode === "KK")

  if (
    receiverNoMatch ||
    receiverMultipleSc ||
    !flightStatusOk ||
    !seatStatusOk
  ) {
    return true
  }
  return false
}

export function passengerHasTdException(
  data: BookingJson,
  passengerSeatIndex: number
): boolean {
  for (const row of getRowsToRenderForPassenger(data, passengerSeatIndex)) {
    if (row.kind === "arnk") continue
    if (tdRowHasException(row.flight, data, passengerSeatIndex)) return true
  }
  return false
}

export function evaluateFlightDetailsMother(
  data: BookingJson | null | undefined
): FlightDetailsEvaluation {
  const hasGkTourBooking = hasTourSegmentForTcBookingFromBookingJson(data)

  if (!data || !data.flights?.length || !data.travelers?.length) {
    return {
      motherStatus: hasGkTourBooking ? "Exception" : "Pending",
      hasAnyPassengerFlightException: false,
      hasAnyTdException: false,
      hasGkTourBooking,
      pnrMotherException: hasGkTourBooking,
    }
  }

  let hasAnyPassengerFlightException = false
  let hasAnyTdException = false

  data.travelers.forEach((_, t) => {
    if (passengerHasException(data, t)) hasAnyPassengerFlightException = true
    if (passengerHasTdException(data, t)) hasAnyTdException = true
  })

  const hasFlightsException =
    hasAnyPassengerFlightException || hasAnyTdException
  const pnrMotherException = hasFlightsException || hasGkTourBooking

  return {
    motherStatus: pnrMotherException ? "Exception" : "Pending",
    hasAnyPassengerFlightException,
    hasAnyTdException,
    hasGkTourBooking,
    pnrMotherException,
  }
}

// --- Exception reasons (modals / tooltips) ---

export type ExceptionReasonItem = {
  flightDisplay: string
  route: string
  shortReason: string
  flightNumber: string
}

export type ExceptionReasonGroup = {
  passengerName: string
  items: ExceptionReasonItem[]
}

export function getExceptionReasons(
  data: BookingJson | null | undefined
): ExceptionReasonGroup[] {
  const grouped: ExceptionReasonGroup[] = []
  if (!data?.flights || !data.travelers) return grouped

  data.travelers.forEach((traveler, t) => {
    const travelerIndex = t + 1
    const flightsForPassenger = (data.flights || []).filter(
      (f) => !f.travelerIndices || f.travelerIndices.includes(travelerIndex)
    )
    const paxName =
      `${traveler.givenName || ""} ${traveler.surname || ""}`.trim() ||
      `Passenger ${t + 1}`
    const items: ExceptionReasonItem[] = []

    flightsForPassenger.forEach((flight) => {
      const airlineCode = flight.airlineCode || ""
      const flightNumber = flight.flightNumber || ""
      const flightDisplay = `${airlineCode} ${flightNumber}`.trim()
      const route = `(${flight.fromAirportCode || ""}-${flight.toAirportCode || ""})`
      const flightStatus = (flight.flightStatusCode || "").toUpperCase()
      const flightStatusOk = flightStatus === "HK" || flightStatus === "KK"

      let seatStatusCode = ""
      let hasSeatData = false
      const seatAtT = flight.seats && flight.seats[t]
      const fallbackSeat = (flight.seats || []).find(
        (s) => s && s.statusCode != null
      )
      if (seatAtT && seatAtT.statusCode != null) {
        hasSeatData = true
        seatStatusCode = (seatAtT.statusCode || "").toUpperCase()
      } else if (fallbackSeat) {
        hasSeatData = true
        seatStatusCode = (fallbackSeat.statusCode || "").toUpperCase()
      }
      const seatStatusOk =
        hasSeatData && (seatStatusCode === "HK" || seatStatusCode === "KK")

      if (!flightStatusOk && flightStatus) {
        items.push({
          flightDisplay,
          route,
          shortReason: `status is ${flightStatus || "empty"}`,
          flightNumber: String(flightNumber).trim(),
        })
      }
      if (!seatStatusOk) {
        const shortReason = !hasSeatData
          ? "is N/A"
          : `status is ${seatStatusCode || "empty"}`
        items.push({
          flightDisplay,
          route,
          shortReason,
          flightNumber: String(flightNumber).trim(),
        })
      }
    })

    if (items.length > 0) grouped.push({ passengerName: paxName, items })
  })

  return grouped
}

export function paxLabel(t: Traveler | undefined, index: number): string {
  const n = `${t?.givenName || ""} ${t?.surname || ""}`.trim()
  if (n) return n
  const alt = t && "name" in t && t.name != null ? String(t.name).trim() : ""
  if (alt) return alt
  return `Passenger ${index + 1}`
}

const NO_LOYALTY_ACCORDION = "No loyalty program"

/**
 * Flights accordion header: SC / PT / SC+# from `loyaltyPrograms`, then
 * `frequentFlyerNumber` when the legacy JSON omits structured FF rows.
 */
export function getTravelerLoyaltyAccordionFields(t: Traveler | undefined): {
  sc: string
  pt: string
  scAndNum: string
} {
  if (!t) {
    return { sc: "—", pt: NO_LOYALTY_ACCORDION, scAndNum: NO_LOYALTY_ACCORDION }
  }
  const loyalty = t.loyaltyPrograms ?? []
  const primaryLp =
    loyalty.find((lp) => String(lp.programNumber ?? "").trim() !== "") ??
    loyalty[0]

  const scFromLp = (
    primaryLp?.supplierCode ||
    primaryLp?.receiverCode ||
    ""
  ).trim()
  const ptFromLp = (primaryLp?.programType || "").trim()
  const scNumParts = [
    (primaryLp?.supplierCode || primaryLp?.receiverCode || "").trim(),
    primaryLp?.programNumber != null
      ? String(primaryLp.programNumber).trim()
      : "",
  ].filter(Boolean)
  const scAndFromLp =
    scNumParts.length >= 2
      ? `${scNumParts[0]} - ${scNumParts[1]}`
      : scNumParts[0] || ""

  if (scFromLp || ptFromLp || scAndFromLp) {
    return {
      sc: scFromLp || "—",
      pt: ptFromLp || "—",
      scAndNum: scAndFromLp || "—",
    }
  }

  const ff =
    t.frequentFlyerNumber != null ? String(t.frequentFlyerNumber).trim() : ""
  if (ff) {
    return { sc: "—", pt: "—", scAndNum: ff }
  }

  return { sc: "—", pt: NO_LOYALTY_ACCORDION, scAndNum: NO_LOYALTY_ACCORDION }
}

function strField(v: unknown): string {
  if (v == null) return ""
  return String(v).trim()
}

/**
 * IATA + space + flight number (e.g. "EY 499" / "EY 758") — same as P3 “Flights · Airline #”.
 */
function formatIataSpaceFlight(
  airlineCode: string,
  flightNumber: string
): string {
  const a = (airlineCode || "").trim()
  const n = (flightNumber || "").trim()
  if (!a && !n) return "—"
  if (!a || a === "—") return n || "—"
  const alU = a.toUpperCase()
  if (n) return `${alU} ${n}`.replace(/\s+/g, " ").trim()
  return alU
}

/** Marketing / operating carrier + flight number (e.g. EY 499). */
export function formatAirlineNumber(f: FlightSegment): string {
  return formatIataSpaceFlight(
    strField(f.marketingAirline ?? f.airlineCode),
    strField(f.flightNumber)
  )
}

/**
 * Flights table first column: `#1 F6P69C · EY 499` — line index, confirmation, airline + flight
 * (aligned with P3 `flightLineLabel` / “Flights · Airline #”).
 */
export function formatFlightLineDisplay(
  f: FlightSegment,
  lineIndex1Based: number
): string {
  const conf = strField(f.confirmationId) || "—"
  const alNum = formatIataSpaceFlight(
    strField(f.marketingAirline ?? f.airlineCode),
    strField(f.flightNumber)
  )
  return `#${lineIndex1Based} ${conf} · ${alNum}`
}

/** Flight number and PNR segment confirmation in one cell. */
export function formatFlightNumberAndConfirmation(f: FlightSegment): string {
  const fn = strField(f.flightNumber)
  const conf = strField(f.confirmationId)
  if (fn && conf) return `${fn} · ${conf}`
  return fn || conf || "—"
}

export function formatScheduleCell(
  date: string | null | undefined,
  time: string | null | undefined
): string {
  return formatAdlItineraryDateTime(date, time)
}

export function formatCabinTypeAndCode(f: FlightSegment): string {
  const cls = strField(f.cabinClass)
  const code = strField(f.cabinCode ?? f.bookingClass)
  if (cls && code) return `${cls} (${code})`
  return cls || code || "—"
}

import type { BookingJson } from "@/lib/flight-details"
import {
  getP3BodyXmlFromApiResult,
  getP3TkneData,
  hasP3ExceptionFromBodyXml,
} from "@/lib/p3-mother"
import { parseTicketSoap } from "@/lib/parse-ticket-soap"
import type { RawBookingJson } from "./booking-api"

export type UnifiedBooking = {
  pnr: string
  brand: string
  bookingJson: BookingJson
  p3BodyXml: string | null
  p3TkneData: Record<string, string[]>
  hasP3Exception: boolean
  tickets: unknown[] | null
  hasTickets: boolean
  hasFlights: boolean
  rawBooking: RawBookingJson
  rawP3Xml: string
  rawP4Xml: string
}

export function buildBookingObject(
  pnr: string,
  brand: string,
  rawBooking: RawBookingJson,
  rawP3Xml: string,
  rawP4Xml: string | string[]
): UnifiedBooking {
  const bookingJson = rawBooking as unknown as BookingJson

  let p3BodyXml: string | null = null
  let p3TkneData: Record<string, string[]> = {}
  let hasP3Exception = false

  try {
    const p3ApiJson = { soap: rawP3Xml, encoded: false }
    p3BodyXml = getP3BodyXmlFromApiResult(p3ApiJson)
    p3TkneData = getP3TkneData(p3BodyXml)
    hasP3Exception = hasP3ExceptionFromBodyXml(p3BodyXml, bookingJson)
  } catch {
    // P3 parse failure treated as exception
    hasP3Exception = true
  }

  const p4XmlSources = Array.isArray(rawP4Xml)
    ? rawP4Xml.filter((x) => typeof x === "string" && x.trim())
    : rawP4Xml && String(rawP4Xml).trim()
      ? [String(rawP4Xml)]
      : []

  const ticketsParsed = p4XmlSources.flatMap(
    (xml) => parseTicketSoap(pnr, xml) ?? []
  )
  const tickets = ticketsParsed.length ? ticketsParsed : null
  const hasFlights =
    Array.isArray(bookingJson?.flights) && bookingJson.flights.length > 0
  const hasTickets = Array.isArray(tickets) && tickets.length > 0

  const rawP4Joined = p4XmlSources.join("\n<!-- p4-doc-boundary -->\n")

  return {
    pnr,
    brand,
    bookingJson,
    p3BodyXml,
    p3TkneData,
    hasP3Exception,
    tickets,
    hasTickets,
    hasFlights,
    rawBooking,
    rawP3Xml,
    rawP4Xml: rawP4Joined,
  }
}

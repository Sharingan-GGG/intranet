/**
 * P3 Details tab — ported from js/p3.js
 * (getP3PersonNames, getP3TkneData, hasP3ExceptionFromBodyXml, getP3BodyXmlFromResult)
 * DB: PNR_P3.SOAP (often base64 in JSON as result.soap + result.encoded)
 *
 * API: PNR_P3 (loaded via fetchDatabase.php with { table: "PNR_P3", pnr }).
 * Mother: #p3-status → Exception on any fetch/decode/A3S/TKNE failure path; else TKNE rule.
 */

import type { BookingJson, FlightSegment } from "./flight-details"
import type { P3FetchResult, TabStatus } from "./pnr-types"

export type P3ApiJson = {
  error?: string
  soap?: string
  encoded?: boolean
}

/** Map P3FetchResult (legacy normalizer) into the shape P3 mother logic expects. */
export function p3FetchResultToApiJson(
  r: P3FetchResult | null | undefined
): P3ApiJson | null {
  if (r == null) return null
  const soapStr =
    typeof r.soap === "string"
      ? r.soap
      : typeof r.body === "string" && r.body
        ? r.body
        : undefined
  return {
    error: r.error,
    encoded: r.encoded,
    soap: soapStr,
  }
}

function decodeBase64Utf8(b64: string): string {
  if (typeof Buffer !== "undefined")
    return Buffer.from(b64, "base64").toString("utf-8")
  if (typeof atob === "function") {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new TextDecoder("utf-8").decode(bytes)
  }
  throw new Error("No base64 decoder")
}

/** Same throws as getP3BodyXmlFromResult */
export function getP3BodyXmlFromApiResult(result: P3ApiJson): string {
  if (!result || result.error || !result.soap) {
    throw new Error(result?.error || "No SOAP data found")
  }
  let soapText = result.soap
  if (result.encoded === true) {
    soapText = decodeBase64Utf8(soapText)
  }
  const bodyMatch = soapText.match(
    /<soap-env:Body[^>]*>([\s\S]*?)<\/soap-env:Body>/i
  )
  const bodyXml = bodyMatch ? bodyMatch[1] : soapText
  if (!bodyXml || !bodyXml.includes("A3S")) {
    throw new Error("No A3S data found in P3 response")
  }
  return bodyXml
}

export type P3PersonName = {
  nameNumber: string
  fullName: string
  docsVal: string
}

export function getP3PersonNames(bodyXml: string): P3PersonName[] {
  const personNameRegex =
    /<PersonName[^>]*NameNumber="([^"]+)"[^>]*>([^<]+)<\/PersonName>/gi
  const personNames: P3PersonName[] = []
  let pnMatch: RegExpExecArray | null
  while ((pnMatch = personNameRegex.exec(bodyXml)) !== null) {
    const nameNumber = pnMatch[1]
    const fullName = pnMatch[2].trim()
    const nameParts = fullName.split(/\s+/)
    if (nameParts.length < 2) continue
    const lastName = nameParts[0]
    const firstNameParts = nameParts.slice(1, nameParts.length - 1)
    const firstName = firstNameParts.join("").toUpperCase()
    personNames.push({
      nameNumber,
      fullName,
      docsVal: `${lastName}/${firstName}`,
    })
  }
  return personNames.sort(
    (a, b) => parseFloat(a.nameNumber) - parseFloat(b.nameNumber)
  )
}

/** airlineCode -> list of "XX value" strings from TKNE lines */
export function getP3TkneData(bodyXml: string): Record<string, string[]> {
  const tkneData: Record<string, string[]> = {}
  const historicalInfoRegex =
    /<HistoricalInfo\b[^>]*>([\s\S]*?)<\/HistoricalInfo>/g
  let hiMatch: RegExpExecArray | null

  while ((hiMatch = historicalInfoRegex.exec(bodyXml)) !== null) {
    const histInfo = hiMatch[1].trim()
    const generalInfoRegex =
      /<GeneralInfo\b[^>]*Action="A3S"[^>]*>([\s\S]*?)<\/GeneralInfo>/g
    let giMatch: RegExpExecArray | null

    while ((giMatch = generalInfoRegex.exec(histInfo)) !== null) {
      const generalInfoContent = giMatch[1].trim()
      const textMatches = [
        ...generalInfoContent.matchAll(/<Text\b[^>]*>([\s\S]*?)<\/Text>/g),
      ]

      for (const tm of textMatches) {
        const cleanText = (tm[1] || "").replace(/^SSR\s+/i, "").trim()
        const parts = cleanText.split(/\s+/)
        if (parts.length < 3) continue
        const type = parts[0]
        const airlineCode = parts[1]
        const value = parts.slice(2).join(" ")
        if (type === "TKNE") {
          if (!tkneData[airlineCode]) tkneData[airlineCode] = []
          tkneData[airlineCode].push(`${airlineCode} ${value}`)
        }
      }
    }
  }
  return tkneData
}

const hasHkStatus = (val: string) =>
  val &&
  String(val).trim() !== "" &&
  (String(val).toUpperCase().includes("HK") ||
    String(val).toUpperCase().includes("KK"))

const nameNumberToTravelerIndex = (nameNumber: string) =>
  Math.floor(parseFloat(String(nameNumber).trim()) || 1)

/** Legacy hasP3ExceptionFromBodyXml */
export function hasP3ExceptionFromBodyXml(
  bodyXml: string,
  data: BookingJson
): boolean {
  const flights: FlightSegment[] = Array.isArray(data?.flights)
    ? (data.flights as FlightSegment[])
    : []
  if (!flights.length) return false

  const personNames = getP3PersonNames(bodyXml)
  const tkneData = getP3TkneData(bodyXml)

  const getTkneForFlight = (airlineCode: string, from: string, to: string) => {
    const list = tkneData[airlineCode] || []
    if (list.length === 0) return "—"
    const routeKey = ((from || "") + (to || "")).toUpperCase()
    const routeKeyRev = ((to || "") + (from || "")).toUpperCase()
    const match = list.find((s) => {
      const beforeSlash = s.split("/")[0] || ""
      return (
        routeKey &&
        (beforeSlash.includes(routeKey) || beforeSlash.includes(routeKeyRev))
      )
    })
    return match || list[0] || "—"
  }

  for (const flight of flights) {
    const airlineCode = flight.airlineCode || ""
    const from = flight.fromAirportCode || ""
    const to = flight.toAirportCode || ""
    const dep = [flight.departureDate, flight.departureTime]
      .filter(Boolean)
      .join(" ")
    const arr = [flight.arrivalDate, flight.arrivalTime]
      .filter(Boolean)
      .join(" ")
    const travelerIndices = flight.travelerIndices || []

    for (const person of personNames) {
      const travelerNum = nameNumberToTravelerIndex(person.nameNumber)
      if (travelerIndices.length && !travelerIndices.includes(travelerNum))
        continue

      const hasFlightRoute = !!(airlineCode && (from || to || dep || arr))
      if (!hasFlightRoute) continue

      const tkneVal = getTkneForFlight(airlineCode, from, to)
      if (!hasHkStatus(tkneVal)) return true
    }
  }
  return false
}

/** Same as window.getP3StatusFromResult */
export function getP3MotherStatusFromApiResult(
  result: P3ApiJson,
  data: BookingJson
): "Pending" | "Exception" {
  try {
    const bodyXml = getP3BodyXmlFromApiResult(result)
    return hasP3ExceptionFromBodyXml(bodyXml, data) ? "Exception" : "Pending"
  } catch {
    return "Exception"
  }
}

/**
 * If no PNR in booking JSON, legacy does not set P3 mother — treat as Pending (no signal).
 */
export function evaluateP3MotherFromFetch(
  data: BookingJson | null | undefined,
  result: P3ApiJson | null | undefined
): "Pending" | "Exception" {
  if (!data?.request?.confirmationId) return "Pending"
  if (!result) return "Exception"
  return getP3MotherStatusFromApiResult(result, data)
}

export function p3MotherLabelToTabStatus(
  m: "Pending" | "Exception"
): TabStatus {
  return m === "Exception" ? "exception" : "pending"
}

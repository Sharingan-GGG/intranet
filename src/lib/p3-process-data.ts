/**
 * Logical P3 "processP3Data" output — A3S SSR rows, tables for the P3 tab (Next.js),
 * porting the data intent of legacy js/p3.js + HTML tables, without DOM.
 */

import { SPECIAL_MESSAGE_CODES } from "./messages-mother"
import {
  getP3BodyXmlFromApiResult,
  getP3PersonNames,
  getP3TkneData,
  p3FetchResultToApiJson,
  type P3PersonName,
} from "./p3-mother"
import { getDebugEmailsAndPhones } from "./pnr-contact-from-json"
import type {
  P3FetchResult,
  PnrJsonData,
  PnrJsonFlight,
  PnrJsonTraveler,
} from "./pnr-types"

export type P3A3SRow = {
  ssrType: string
  airlineCode: string
  information: string
  travelAssociation: string
  rawText: string
}

export type P3SpecialRequestRow = {
  code: string
  flight: string
  statusCode: string
  originAndDestination: string
}

export type P3MainGridRow = {
  flightKey: string
  flightsAndConf: string
  origin: string
  destination: string
  departure: string
  arrival: string
  status: string
  ctce: string
  ctcm: string
  pax: string
  docs: string
  tkne: string
  /** True when no A3S CTCE row found for this pax/flight */
  ctceIsNa: boolean
  /** True when no A3S CTCM row found for this pax/flight */
  ctcmIsNa: boolean
  /** True when PNR expects DOCS but no A3S DOCS line found for this pax */
  docsException: boolean
  /** True when TKNE is missing or empty ("—") */
  tkneException: boolean
  /** True when TKNE was found via airline fallback (not exact route match) */
  tkneRouteMismatch: boolean
}

export type P3ContactRow = {
  pax: string
  /** From PNR_JSON via getDebugEmailsAndPhones (not P3 SOAP). */
  emails: string[]
  phones: string[]
}

const MEAL_SSR = new Set(
  "SPML AVML BBML DBML BLML FPML HFML HNML JNML KSML LCML LFML LPML LSML MOML NLML ORML PFML PRML RVML SFML VJML VOML VLML MALE CHLD".split(
    " "
  )
)
const SPECIAL_REQUEST_SSR = new Set<string>([
  ...Array.from(SPECIAL_MESSAGE_CODES),
  ...Array.from(MEAL_SSR),
])

function travelAssocFromInfo(info: string): string {
  const m = info.match(/\b(P\d+(\.\d+)?|INF\d*|ADT\d*)\b/i)
  return m ? m[0] : "—"
}

/**
 * All A3S GeneralInfo <Text> lines, parsed (same source as TKNE in p3-mother).
 */
export function extractA3SRowsFromBodyXml(bodyXml: string): P3A3SRow[] {
  const out: P3A3SRow[] = []
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
      for (const tm of generalInfoContent.matchAll(
        /<Text\b[^>]*>([\s\S]*?)<\/Text>/g
      )) {
        const cleanText = (tm[1] || "").replace(/^SSR\s+/i, "").trim()
        if (!cleanText) continue
        const parts = cleanText.split(/\s+/)
        if (parts.length < 2) {
          out.push({
            ssrType: "UNK",
            airlineCode: "—",
            information: cleanText,
            travelAssociation: "—",
            rawText: cleanText,
          })
          continue
        }
        const ssrType = (parts[0] || "UNK").toUpperCase()
        const airlineCode = parts[1] || "—"
        const information = parts.slice(2).join(" ")
        out.push({
          ssrType,
          airlineCode,
          information,
          travelAssociation: travelAssocFromInfo(cleanText),
          rawText: cleanText,
        })
      }
    }
  }
  return out
}

function airlineCodesOnPnr(
  flights: PnrJsonFlight[] | null | undefined
): Set<string> {
  const s = new Set<string>()
  for (const f of flights || []) {
    const c =
      f?.airlineCode != null ? String(f.airlineCode).trim().toUpperCase() : ""
    if (c) s.add(c)
  }
  return s
}

function paxName(t: PnrJsonTraveler | null | undefined, idx: number): string {
  if (!t) return `PAX ${idx + 1}`
  const a = (t.givenName || "").trim()
  const b = (t.surname || "").trim()
  if (a || b) return `${a} ${b}`.trim()
  if (t.name) return String(t.name).trim()
  return `PAX ${idx + 1}`
}

export function passengerLabelForCancelledA3SRow(
  r: P3A3SRow,
  personNames: P3PersonName[],
  travelers: PnrJsonTraveler[] | null | undefined
): string {
  if (r.travelAssociation && r.travelAssociation !== "—") {
    const tNum = r.travelAssociation.replace(/^P/i, "")
    const hit = personNames.find(
      (p) => p.nameNumber === tNum || p.nameNumber === r.travelAssociation
    )
    if (hit?.fullName) return hit.fullName
    const idx = parseInt(tNum.split(".")[0] || tNum, 10) - 1
    if (idx >= 0 && travelers?.[idx]) return paxName(travelers[idx], idx)
    return r.travelAssociation
  }
  const pInText =
    /\b(P\d+(?:\.\d+)?)\b/i.exec(r.rawText) ||
    /\b(P\d+(?:\.\d+)?)\b/i.exec(r.information)
  if (pInText) {
    const n = pInText[1]
    const main = n.replace(/^P/i, "")
    const hit = personNames.find(
      (p) =>
        p.nameNumber === n ||
        p.nameNumber === main ||
        p.nameNumber === main.split(".")[0]
    )
    if (hit?.fullName) return hit.fullName
    const idx = parseInt(main.split(".")[0], 10) - 1
    if (idx >= 0 && travelers?.[idx]) return paxName(travelers[idx], idx)
  }
  const ssrPax = r.ssrType.match(/^(\d)S$/i)
  if (ssrPax) {
    const idx = parseInt(ssrPax[1], 10) - 1
    if (idx >= 0 && travelers?.[idx]) return paxName(travelers[idx], idx)
  }
  const leadS =
    r.rawText.match(/(?:^|\s)(\d)S\s/i) ||
    r.information.match(/(?:^|\s)(\d)S\s/i)
  if (leadS) {
    const idx = parseInt(leadS[1], 10) - 1
    if (idx >= 0 && travelers?.[idx]) return paxName(travelers[idx], idx)
  }
  if (/^\dS$/i.test(r.airlineCode)) {
    const idx = parseInt(r.airlineCode[0], 10) - 1
    if (idx >= 0 && travelers?.[idx]) return paxName(travelers[idx], idx)
  }
  return "—"
}

/** Display as "EY 499" (IATA + space + flight no.). */
function formatAirlineFlightDisplay(
  airlineCode: string,
  flightNumber: string
): string {
  const a = (airlineCode || "").trim()
  if (!a || a === "—") return "—"
  const alU = a.toUpperCase()
  const n = (flightNumber || "").trim()
  if (n) return `${alU} ${n}`
  return alU
}

function flightLineLabel(f: PnrJsonFlight, idx: number): string {
  const n = f.flightNumber != null ? String(f.flightNumber) : ""
  const a = (f.airlineCode != null ? String(f.airlineCode) : "").trim()
  const cRaw = f.confirmationId != null ? String(f.confirmationId).trim() : ""
  const c = cRaw || "—"
  const airlineFlight = formatAirlineFlightDisplay(a, n)
  return `#${idx + 1} ${c} · ${airlineFlight}`
}

function schedule(
  a: string | null | undefined,
  b: string | null | undefined
): string {
  return [a, b].filter(Boolean).join(" ") || "—"
}

/** P2 / P2.1 style ref from A3S row (null = no P-marker → segment-wide / party line). */
function paxRefFromRow(r: P3A3SRow): string | null {
  const ta = r.travelAssociation?.trim()
  if (ta && ta !== "—") {
    const m = ta.match(/^P?(\d+(?:\.\d+)?)$/i)
    if (m) return m[1]
  }
  const src = `${r.rawText} ${r.information}`
  const m2 = /\bP(\d+(?:\.\d+)?)\b/i.exec(src)
  return m2 ? m2[1] : null
}

function nameNumberKeyForTraveler(
  t0: number,
  personNames: P3PersonName[]
): string {
  const want = String(t0 + 1)
  const hit = personNames.find(
    (p) =>
      p.nameNumber === want ||
      String(Math.floor(parseFloat(p.nameNumber))) === want
  )
  return hit?.nameNumber ?? want
}

function rowRefMatchesTraveler(
  ref: string,
  t0: number,
  personNames: P3PersonName[]
): boolean {
  const want = String(t0 + 1)
  const slotKey = nameNumberKeyForTraveler(t0, personNames)
  if (ref === slotKey || ref === want) return true
  const refF = parseFloat(ref)
  const slotF = parseFloat(slotKey)
  if (!Number.isNaN(refF) && !Number.isNaN(slotF) && refF === slotF) return true
  if (refF === Math.floor(refF) && Math.floor(refF) === t0 + 1) return true
  return false
}

function a3sRowMatchesTraveler(
  r: P3A3SRow,
  t0: number,
  personNames: P3PersonName[]
): boolean {
  const ref = paxRefFromRow(r)
  if (ref == null) return false
  return rowRefMatchesTraveler(ref, t0, personNames)
}

function poolForSsrAirline(
  rows: P3A3SRow[],
  ssr: string,
  airline: string
): P3A3SRow[] {
  const al = airline.toUpperCase()
  const withAl = rows.filter(
    (r) => r.ssrType === ssr && r.airlineCode.toUpperCase() === al
  )
  if (withAl.length) return withAl
  return rows.filter((r) => r.ssrType === ssr)
}

/** Prefer SSR line for this traveler; then party-wide line (no P ref); else undefined. */
function findLineForTypeAirlinePax(
  rows: P3A3SRow[],
  ssr: string,
  airline: string,
  t0: number,
  personNames: P3PersonName[]
): P3A3SRow | undefined {
  const pool = poolForSsrAirline(rows, ssr, airline)
  if (!pool.length) return undefined
  const paxLines = pool.filter(
    (r) => paxRefFromRow(r) != null && a3sRowMatchesTraveler(r, t0, personNames)
  )
  if (paxLines.length) return paxLines[0]
  const generic = pool.filter((r) => paxRefFromRow(r) == null)
  if (generic.length) return generic[0]
  return undefined
}

function findLineForSsrPerPax(
  rows: P3A3SRow[],
  ssr: string,
  t0: number,
  personNames: P3PersonName[]
): P3A3SRow | undefined {
  const pool = rows.filter((r) => r.ssrType === ssr)
  if (!pool.length) return undefined
  const paxLines = pool.filter(
    (r) => paxRefFromRow(r) != null && a3sRowMatchesTraveler(r, t0, personNames)
  )
  if (paxLines.length) return paxLines[0]
  const generic = pool.filter((r) => paxRefFromRow(r) == null)
  if (generic.length) return generic[0]
  return undefined
}

function tkneStringsForTraveler(
  list: string[],
  t0: number,
  personNames: P3PersonName[]
): string[] {
  if (list.length === 0) return list
  const anyP = list.some((s) => /\bP\d+(?:\.\d+)?\b/i.test(s))
  if (!anyP) return list
  const filtered = list.filter((s) => {
    const m = /\bP(\d+(?:\.\d+)?)\b/i.exec(s)
    if (!m) return true
    return rowRefMatchesTraveler(m[1], t0, personNames)
  })
  return filtered.length ? filtered : list
}

function getTkneDisplay(
  tkneByLine: ReturnType<typeof getP3TkneData>,
  airline: string,
  from: string,
  to: string
): { value: string; routeMismatch: boolean } {
  const list = tkneByLine[airline] || []
  if (list.length === 0) return { value: "—", routeMismatch: false }
  const routeKey = ((from || "") + (to || "")).toUpperCase()
  const routeKeyRev = ((to || "") + (from || "")).toUpperCase()
  const match = list.find((s) => {
    const beforeSlash = s.split("/")[0] || ""
    return (
      routeKey &&
      (beforeSlash.includes(routeKey) || beforeSlash.includes(routeKeyRev))
    )
  })
  if (match) return { value: match, routeMismatch: false }
  const fallback = list[0]
  return fallback
    ? { value: fallback, routeMismatch: true }
    : { value: "—", routeMismatch: false }
}

function getTkneDisplayForPax(
  tkneByLine: ReturnType<typeof getP3TkneData>,
  airline: string,
  from: string,
  to: string,
  t0: number,
  personNames: P3PersonName[]
): { value: string; routeMismatch: boolean } {
  const raw = tkneByLine[airline] || []
  const list = tkneStringsForTraveler(raw, t0, personNames)
  const sub: Record<string, string[]> = { ...tkneByLine, [airline]: list }
  return getTkneDisplay(sub, airline, from, to)
}

/**
 * Heuristic: extract email/phone from CTCE/CTCM info segments (legacy GDS free text).
 */
function stripContactType(info: string): { email: string; phone: string } {
  const e = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i.exec(info)
  const p = /(\+?\d[\d\s().-]{6,})/.exec(info)
  return { email: e ? e[1] : "—", phone: p ? p[1].trim() : "—" }
}

function contactFromTraveler(t: PnrJsonTraveler | undefined): {
  email: string
  phone: string
} {
  const o = t as
    | { email?: string; phone?: string; Email?: string; Phone?: string }
    | undefined
  const email = o?.email ?? o?.Email
  const phone = o?.phone ?? o?.Phone
  return {
    email: email && String(email).trim() ? String(email).trim() : "—",
    phone: phone && String(phone).trim() ? String(phone).trim() : "—",
  }
}

function docsForPaxFromPersons(
  persons: P3PersonName[],
  travelerIndex0: number
): string {
  const want = String(travelerIndex0 + 1)
  const hit = persons.find(
    (p) =>
      p.nameNumber === want ||
      String(Math.floor(parseFloat(p.nameNumber))) === want
  )
  return hit?.docsVal ?? "—"
}

export type P3ProcessModel = {
  a3sRows: P3A3SRow[]
  specialRequests: P3SpecialRequestRow[]
  travelInfo: P3A3SRow[]
  cancelledLeg: P3A3SRow[]
  mainGrid: P3MainGridRow[]
  pnrInfo: P3ContactRow[]
  personNames: P3PersonName[]
  ssrTypeCodes: string[]
}

function buildModel(
  bodyXml: string,
  booking: PnrJsonData | null | undefined
): P3ProcessModel {
  const a3sRows = extractA3SRowsFromBodyXml(bodyXml)
  const ssrTypeCodes = [...new Set(a3sRows.map((r) => r.ssrType))]

  const travelInfo = a3sRows
  const currentAirlines = airlineCodesOnPnr(booking?.flights)
  const cancelledLeg = a3sRows.filter(
    (r) =>
      r.airlineCode &&
      r.airlineCode !== "—" &&
      !currentAirlines.has(r.airlineCode.toUpperCase())
  )

  const specialRequests: P3SpecialRequestRow[] = a3sRows
    .filter((r) => SPECIAL_REQUEST_SSR.has(r.ssrType))
    .map((r) => ({
      code: r.ssrType,
      flight: "—",
      statusCode: /HK|KK|SS/i.test(r.information)
        ? r.information.toUpperCase().includes("HK")
          ? "HK"
          : "KK"
        : "—",
      originAndDestination: r.information || "—",
    }))

  const persons = getP3PersonNames(bodyXml)
  const tkneByLine = getP3TkneData(bodyXml)
  const flights = Array.isArray(booking?.flights) ? booking!.flights! : []
  const travelers = booking?.travelers || []

  const mainGrid: P3MainGridRow[] = []
  for (let fi = 0; fi < flights.length; fi++) {
    const f = flights[fi]
    const tIdxs =
      f.travelerIndices && f.travelerIndices.length
        ? f.travelerIndices
        : travelers.map((_, i) => i + 1)
    for (const ti of tIdxs) {
      const t0 = (typeof ti === "number" ? ti : parseInt(String(ti), 10)) - 1
      const t = travelers[t0]
      const from = f.fromAirportCode || f.origin || "—"
      const to = f.toAirportCode || f.destination || "—"
      const al = f.airlineCode != null ? String(f.airlineCode) : "—"
      const ctce = findLineForTypeAirlinePax(a3sRows, "CTCE", al, t0, persons)
      const ctcm = findLineForTypeAirlinePax(a3sRows, "CTCM", al, t0, persons)
      const docLine = findLineForTypeAirlinePax(
        a3sRows,
        "DOCS",
        al,
        t0,
        persons
      )
      const ce = ctce
        ? stripContactType(ctce.information)
        : { email: "—", phone: "—" }
      const cm = ctcm
        ? stripContactType(ctcm.information)
        : { email: "—", phone: "—" }
      const local = contactFromTraveler(t)
      const paxN = paxName(t, t0)
      const tkneResult = getTkneDisplayForPax(
        tkneByLine,
        al,
        from,
        to,
        t0,
        persons
      )
      const pnrHasDocs =
        Array.isArray(booking?.specialServices) &&
        booking!.specialServices!.some(
          (s) => (s as { code?: string }).code === "DOCS"
        )
      mainGrid.push({
        flightKey: `${f.itemId ?? fi}-${t0}`,
        flightsAndConf: flightLineLabel(f, fi),
        origin: from,
        destination: to,
        departure: schedule(f.departureDate, f.departureTime),
        arrival: schedule(f.arrivalDate, f.arrivalTime),
        status: (f.flightStatusCode && String(f.flightStatusCode)) || "—",
        ctce: ctce
          ? ce.email !== "—"
            ? ce.email
            : ctce.information
          : local.email,
        ctcm: ctcm
          ? cm.phone !== "—"
            ? cm.phone
            : ctcm.information
          : local.phone,
        pax: paxN,
        docs: docLine
          ? docLine.information
          : docsForPaxFromPersons(persons, t0),
        tkne: tkneResult.value,
        ctceIsNa: !ctce,
        ctcmIsNa: !ctcm,
        docsException: pnrHasDocs && !docLine,
        tkneException: tkneResult.value === "—",
        tkneRouteMismatch: tkneResult.routeMismatch,
      })
    }
  }

  const pnrInfo: P3ContactRow[] = travelers.map((t, i) => {
    const { emails, phones } = getDebugEmailsAndPhones(booking ?? null, t, i)
    return {
      pax: paxName(t, i),
      emails,
      phones,
    }
  })

  return {
    a3sRows,
    specialRequests,
    travelInfo,
    cancelledLeg,
    mainGrid,
    pnrInfo,
    personNames: persons,
    ssrTypeCodes,
  }
}

export function processP3Data(
  bodyXml: string,
  booking: PnrJsonData | null | undefined
): P3ProcessModel {
  return buildModel(bodyXml, booking)
}

export function tryP3ModelFromFetchResult(
  p3: P3FetchResult | null,
  booking: PnrJsonData | null
):
  | { ok: true; model: P3ProcessModel; bodyXml: string }
  | { ok: false; error: string } {
  if (!p3) return { ok: false, error: "No P3 result" }
  if (p3.error) return { ok: false, error: p3.error }
  const api = p3FetchResultToApiJson(p3)
  if (!api) return { ok: false, error: "Empty P3 payload" }
  try {
    const bodyXml = getP3BodyXmlFromApiResult(api)
    const model = processP3Data(bodyXml, booking)
    return { ok: true, model, bodyXml }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "P3 body parse failed",
    }
  }
}

/** SSR type codes (e.g. TKNE, FQTS) for messages-mother P3 merge */
export function getP3SsrCodesForMessagesFromResult(
  p3: P3FetchResult | null
): string[] {
  if (!p3) return []
  const r = tryP3ModelFromFetchResult(p3, null)
  if (!r.ok) return []
  return r.model.ssrTypeCodes
}

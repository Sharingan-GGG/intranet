import xml2js from "xml2js"

import type {
  P3ProcessModel,
  P3A3SRow,
  P3ContactRow,
} from "@/lib/p3-process-data"
import type { P3PersonName } from "@/lib/p3-mother"

/**
 * Check for SOAP fault in parsed envelope and throw with Sabre's error message.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function checkForSoapFault(parsed: any): void {
  const fault = parsed?.Envelope?.Body?.[0]?.Fault?.[0]
  if (fault) {
    const code = fault.faultcode?.[0] ?? "Unknown"
    const msg = fault.faultstring?.[0] ?? "SOAP Fault"
    const detail = fault.detail?.[0] ?? ""
    throw new Error(
      `SOAP Fault [${code}]: ${msg}${detail ? ` — ${detail}` : ""}`
    )
  }
}

/**
 * Parse P3 SOAP response from Sabre Platform into P3ProcessModel.
 * Returns the same shape that legacy code produces — mainGrid, specialRequests,
 * travelInfo, and pnrInfo are left as empty arrays (they require PNR JSON context
 * to build fully, which happens in tryP3ModelFromFetchResult).
 */
export async function parseP3Soap(soapXml: string): Promise<P3ProcessModel> {
  const parser = new xml2js.Parser({
    explicitArray: true,
    mergeAttrs: true,
    tagNameProcessors: [xml2js.processors.stripPrefix],
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: any
  try {
    parsed = await parser.parseStringPromise(soapXml)
  } catch (err) {
    throw new Error(`P3 SOAP parsing failed: ${String(err)}`)
  }

  checkForSoapFault(parsed)

  const personNames = extractPersonNames(parsed)
  const a3sRows = extractA3SRows(parsed)
  const ssrTypeCodes = [...new Set(a3sRows.map((r) => r.ssrType))]
  const pnrInfo: P3ContactRow[] = []

  return {
    personNames,
    a3sRows,
    ssrTypeCodes,
    travelInfo: a3sRows,
    specialRequests: [],
    cancelledLeg: [],
    mainGrid: [],
    pnrInfo,
  }
}

/**
 * Extract PersonName elements from parsed SOAP envelope.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPersonNames(parsed: any): P3PersonName[] {
  try {
    const body =
      parsed?.Envelope?.[0]?.Body?.[0] ??
      parsed?.["soap-env:Envelope"]?.[0]?.["soap-env:Body"]?.[0] ??
      null

    if (!body) return []

    const rsKey = Object.keys(body).find((k) =>
      k.includes("TravelItineraryHistoryRS")
    )
    if (!rsKey) return []

    const rs = body[rsKey]?.[0]
    const historicalInfos = rs?.HistoricalInfo ?? rs?.historicalInfo ?? []

    if (!Array.isArray(historicalInfos)) return []

    const names: P3PersonName[] = []
    for (const hi of historicalInfos) {
      const pnArr = hi.PersonName ?? hi.personName ?? []
      if (!Array.isArray(pnArr)) continue
      for (const pn of pnArr) {
        const nameNumber =
          pn.NameNumber?.[0] ?? pn.nameNumber?.[0] ?? pn._ ?? ""
        const fullName =
          typeof pn === "string"
            ? pn
            : (pn._ ?? pn.PersonName?.[0] ?? pn.personName?.[0] ?? "")
        names.push({
          nameNumber: String(nameNumber),
          fullName: String(fullName),
          docsVal: formatDocsValue(String(fullName)),
        })
      }
    }

    return names
  } catch {
    return []
  }
}

/**
 * Extract A3S lines from parsed SOAP envelope.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractA3SRows(parsed: any): P3A3SRow[] {
  try {
    const body =
      parsed?.Envelope?.[0]?.Body?.[0] ??
      parsed?.["soap-env:Envelope"]?.[0]?.["soap-env:Body"]?.[0] ??
      null

    if (!body) return []

    const rsKey = Object.keys(body).find((k) =>
      k.includes("TravelItineraryHistoryRS")
    )
    if (!rsKey) return []

    const rs = body[rsKey]?.[0]
    const historicalInfos = rs?.HistoricalInfo ?? rs?.historicalInfo ?? []

    if (!Array.isArray(historicalInfos)) return []

    const rows: P3A3SRow[] = []

    for (const hi of historicalInfos) {
      const generalInfos = hi.GeneralInfo ?? hi.generalInfo ?? []
      if (!Array.isArray(generalInfos)) continue

      for (const gi of generalInfos) {
        const action = gi.Action?.[0] ?? gi.action?.[0] ?? ""
        if (action !== "A3S") continue

        const textElements = gi.Text ?? gi.text ?? []
        if (!Array.isArray(textElements)) continue

        for (const text of textElements) {
          const line = typeof text === "string" ? text : (text._ ?? "")
          if (!line.trim()) continue
          const row = parseA3SLine(line)
          if (row) rows.push(row)
        }
      }
    }

    return rows
  } catch {
    return []
  }
}

/**
 * Parse a single A3S line: "SSR CTCE AA 1.1 JOHN@EMAIL.COM"
 */
function parseA3SLine(line: string): P3A3SRow | null {
  const cleanText = line.replace(/^SSR\s+/i, "").trim()
  const parts = cleanText.split(/\s+/)

  if (parts.length < 2) return null

  const ssrType = parts[0] ?? "UNK"
  const airlineCode = parts[1] ?? ""
  const information = parts.slice(2).join(" ")

  const assocMatch = information.match(/\b(\d+(?:\.\d+)?)\b/)
  const travelAssociation = assocMatch ? assocMatch[0] : "—"

  return { ssrType, airlineCode, information, travelAssociation, rawText: line }
}

/**
 * Format name for DOCS matching: "SMITH/JOHN MR" → "SMITH/JOH"
 */
function formatDocsValue(fullName: string): string {
  if (!fullName) return ""
  const parts = fullName.split(/\s+/)
  const firstPart = parts[0] ?? ""

  if (firstPart.includes("/")) {
    const [last, first] = firstPart.split("/")
    return `${last}/${(first ?? "").slice(0, 3)}`.toUpperCase()
  }

  const last = parts[0] ?? ""
  const first = parts[1] ?? ""
  return `${last}/${first.slice(0, 3)}`.toUpperCase()
}

/**
 * Parse P4 SOAP (ticket data) — returns raw parsed structure.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function parseP4Soap(soapXml: string): Promise<any> {
  const parser = new xml2js.Parser({
    explicitArray: false,
    tagNameProcessors: [xml2js.processors.stripPrefix],
  })
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed: any = await parser.parseStringPromise(soapXml)
    checkForSoapFault(parsed)
    return parsed
  } catch (err) {
    throw new Error(`P4 SOAP parsing failed: ${String(err)}`)
  }
}

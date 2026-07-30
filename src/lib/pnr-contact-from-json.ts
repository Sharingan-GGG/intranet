/**
 * PNR information contact columns — legacy parity with pnr.js `getDebugEmailsAndPhones`.
 * Sources: booking JSON only (contactInfo, traveler fields, specialServices CTCE/CTCM).
 * Not populated from P3 SOAP/XML.
 */

import type {
  PnrJsonData,
  PnrJsonSpecialService,
  PnrJsonTraveler,
} from "./pnr-types"

function normalizeSsrCode(code: string | undefined): string {
  return (code || "").toUpperCase().trim()
}

function asTrimmedString(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s || null
}

/** Optional GDS name number on traveler (e.g. "1.1") when present in JSON. */
function travelerNameRefFromBooking(
  t: PnrJsonTraveler | undefined,
  travelerIdx: number
): string {
  const o = t as Record<string, unknown> | undefined
  const nn = o?.nameNumber ?? o?.name_number ?? o?.passengerNameNumber
  const s = asTrimmedString(nn)
  if (s) return s
  return String(travelerIdx + 1)
}

/** CTCE message decode: strip leading `/`, `//` → `@`, remove remaining `/`. */
export function decodeCtceMessage(raw: string): string {
  let s = String(raw).trim()
  s = s.replace(/^\/+/, "")
  s = s.replace(/\/\//g, "@")
  s = s.replace(/\//g, "")
  return s.trim()
}

/** CTCM message decode: strip leading `/`. */
export function decodeCtcmMessage(raw: string): string {
  return String(raw).trim().replace(/^\/+/, "").trim()
}

const EMAIL_RE = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi

function extractEmailsFromDecoded(decoded: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  const re = new RegExp(EMAIL_RE.source, "gi")
  while ((m = re.exec(decoded)) !== null) {
    const e = m[1].trim()
    const k = e.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(e)
  }
  const slashRe = /([A-Z0-9._%+-]+)\/\/([A-Z0-9.-]+\.[A-Z]{2,})/gi
  while ((m = slashRe.exec(decoded)) !== null) {
    const e = `${m[1]}@${m[2]}`.trim()
    const k = e.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(e)
  }
  return out
}

function jsonSsrAppliesToTraveler(
  message: string | null | undefined,
  travelerIdx: number,
  traveler: PnrJsonTraveler | undefined
): boolean {
  const msg = String(message || "")
  const pMatch = /\bP(\d+(?:\.\d+)?)\b/i.exec(msg)
  if (!pMatch) return true
  const ref = pMatch[1]
  const slot = travelerNameRefFromBooking(traveler, travelerIdx)
  if (ref === slot) return true
  const refF = parseFloat(ref)
  const slotF = parseFloat(slot)
  if (!Number.isNaN(refF) && !Number.isNaN(slotF) && refF === slotF) return true
  return false
}

function collectStringsFromUnknownArray(
  raw: unknown,
  pick: (o: Record<string, unknown>) => string | null
): string[] {
  if (!raw) return []
  if (typeof raw === "string") {
    const s = raw.trim()
    return s ? [s] : []
  }
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item === "string") {
      const s = item.trim()
      if (s) out.push(s)
    } else if (item && typeof item === "object") {
      const s = pick(item as Record<string, unknown>)
      if (s) out.push(s)
    }
  }
  return out
}

function emailsFromContactInfo(
  contactInfo: unknown,
  travelerIdx: number
): string[] {
  if (!contactInfo || typeof contactInfo !== "object") return []
  const emails = (contactInfo as Record<string, unknown>).emails
  if (!Array.isArray(emails)) {
    const one = asTrimmedString(emails)
    return one ? [one] : []
  }
  const out: string[] = []
  for (const item of emails) {
    if (typeof item === "string") {
      const s = item.trim()
      if (s) out.push(s)
      continue
    }
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    const ti =
      o.travelerIndex ??
      o.passengerIndex ??
      o.passenger ??
      o.nameNumber ??
      o.traveler
    if (ti != null) {
      const tNum = typeof ti === "number" ? ti : parseFloat(String(ti))
      const want = travelerIdx + 1
      if (
        !Number.isNaN(tNum) &&
        Math.floor(tNum) !== want &&
        String(ti) !== String(want)
      )
        continue
    }
    const e =
      asTrimmedString(o.email) ??
      asTrimmedString(o.address) ??
      asTrimmedString(o.value) ??
      asTrimmedString(o.text)
    if (e) out.push(e)
  }
  return out
}

function phonesFromContactInfo(
  contactInfo: unknown,
  travelerIdx: number
): string[] {
  if (!contactInfo || typeof contactInfo !== "object") return []
  const phones = (contactInfo as Record<string, unknown>).phones
  if (!Array.isArray(phones)) {
    const one = asTrimmedString(phones)
    return one ? [one] : []
  }
  const out: string[] = []
  for (const item of phones) {
    if (typeof item === "string") {
      const s = decodeCtcmMessage(item)
      if (s) out.push(s)
      continue
    }
    if (!item || typeof item !== "object") continue
    const o = item as Record<string, unknown>
    const ti =
      o.travelerIndex ??
      o.passengerIndex ??
      o.passenger ??
      o.nameNumber ??
      o.traveler
    if (ti != null) {
      const tNum = typeof ti === "number" ? ti : parseFloat(String(ti))
      const want = travelerIdx + 1
      if (
        !Number.isNaN(tNum) &&
        Math.floor(tNum) !== want &&
        String(ti) !== String(want)
      )
        continue
    }
    const n =
      asTrimmedString(o.number) ??
      asTrimmedString(o.phone) ??
      asTrimmedString(o.value) ??
      asTrimmedString(o.text)
    if (n) out.push(decodeCtcmMessage(n))
  }
  return out
}

function emailsFromTraveler(t: PnrJsonTraveler | undefined): string[] {
  if (!t) return []
  const o = t as Record<string, unknown>
  const out: string[] = []
  const single = asTrimmedString(o.email ?? o.Email)
  if (single) out.push(single)
  const raw = o.emails
  if (typeof raw === "string") {
    const s = raw.trim()
    if (s) out.push(s)
    return dedupeStringList(out)
  }
  out.push(
    ...collectStringsFromUnknownArray(raw, (x) =>
      asTrimmedString(x.email ?? x.address ?? x.value)
    )
  )
  return dedupeStringList(out)
}

function dedupeStringList(list: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const x of list) {
    const v = x.trim()
    if (!v) continue
    const k = v.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(v)
  }
  return out
}

function phonesFromTraveler(t: PnrJsonTraveler | undefined): string[] {
  if (!t) return []
  const o = t as Record<string, unknown>
  const out: string[] = []
  const single = asTrimmedString(o.phone ?? o.Phone)
  if (single) out.push(decodeCtcmMessage(single))
  const raw = o.phones
  if (!raw) return dedupeStringList(out)
  if (typeof raw === "string") {
    const s = decodeCtcmMessage(raw)
    if (s) out.push(s)
    return dedupeStringList(out)
  }
  if (!Array.isArray(raw)) return dedupeStringList(out)
  for (const item of raw) {
    if (typeof item === "string") {
      const s = decodeCtcmMessage(item)
      if (s) out.push(s)
    } else if (item && typeof item === "object") {
      const n = (item as Record<string, unknown>).number
      const s = asTrimmedString(n)
      if (s) out.push(decodeCtcmMessage(s))
    }
  }
  return dedupeStringList(out)
}

/** Agency / internal domains omitted from PNR information email column. */
const EXCLUDED_EMAIL_DOMAINS = new Set([
  "roundabouttravel.com.au",
  "roundabouttravel.co.nz",
  "onboardluxury.com.au",
  "flatbedstravel.com.au",
  "flatbeds.com.au",
  "thewellconnectedtraveller.com.au",
  "qflyer.com.au",
  "ypremium.com.au",
])

function normalizePhoneKey(phone: string): string {
  return phone.toLowerCase().replace(/[^a-z0-9]/g, "")
}

/** Digits/fragments: excluded if `normalizePhoneKey(phone)` includes any of these (any formatting). */
const EXCLUDED_PHONE_FRAGMENTS = [
  "81331050",
  "81331051",
  "81331052",
  "81331053",
  "81331054",
  "81331055",
  "81331056",
  "81331057",
  "81331058",
  "70931860",
] as const

function isExcludedAgencyEmail(email: string): boolean {
  const at = email.lastIndexOf("@")
  if (at < 0) return false
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase()
  return EXCLUDED_EMAIL_DOMAINS.has(domain)
}

function isExcludedPhone(phone: string): boolean {
  const k = normalizePhoneKey(phone)
  for (const f of EXCLUDED_PHONE_FRAGMENTS) {
    if (k.includes(f)) return true
  }
  return false
}

function dedupeAppendEmail(target: string[], seen: Set<string>, value: string) {
  const v = value.trim()
  if (!v || isExcludedAgencyEmail(v)) return
  const k = v.toLowerCase()
  if (seen.has(k)) return
  seen.add(k)
  target.push(v)
}

function dedupeAppendPhone(target: string[], seen: Set<string>, value: string) {
  const v = value.trim()
  if (!v || isExcludedPhone(v)) return
  const k = v.toLowerCase()
  if (seen.has(k)) return
  seen.add(k)
  target.push(v)
}

/**
 * Emails and phones for one traveler from PNR_JSON (and CTCE/CTCM in `specialServices`), matching legacy pnr.js.
 */
export function getDebugEmailsAndPhones(
  data: PnrJsonData | null | undefined,
  traveler: PnrJsonTraveler | undefined,
  travelerIdx: number
): { emails: string[]; phones: string[] } {
  const emails: string[] = []
  const phones: string[] = []
  const seenE = new Set<string>()
  const seenP = new Set<string>()

  const contactInfo =
    data && typeof data === "object"
      ? (data as Record<string, unknown>).contactInfo
      : undefined

  for (const e of emailsFromContactInfo(contactInfo, travelerIdx))
    dedupeAppendEmail(emails, seenE, e)
  for (const e of emailsFromTraveler(traveler))
    dedupeAppendEmail(emails, seenE, e)

  for (const p of phonesFromContactInfo(contactInfo, travelerIdx))
    dedupeAppendPhone(phones, seenP, p)
  for (const p of phonesFromTraveler(traveler))
    dedupeAppendPhone(phones, seenP, p)

  const services: PnrJsonSpecialService[] = Array.isArray(data?.specialServices)
    ? data!.specialServices!
    : []
  for (const s of services) {
    const code = normalizeSsrCode(s.code)
    const msg = s.message != null ? String(s.message) : ""
    if (!msg.trim()) continue
    if (
      code === "CTCE" &&
      jsonSsrAppliesToTraveler(msg, travelerIdx, traveler)
    ) {
      const decoded = decodeCtceMessage(msg)
      for (const e of extractEmailsFromDecoded(decoded))
        dedupeAppendEmail(emails, seenE, e)
    }
    if (
      code === "CTCM" &&
      jsonSsrAppliesToTraveler(msg, travelerIdx, traveler)
    ) {
      dedupeAppendPhone(phones, seenP, decodeCtcmMessage(msg))
    }
  }

  return { emails, phones }
}

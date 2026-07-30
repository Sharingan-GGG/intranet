/**
 * Messages tab alarm — ported from js/pnr.js (lines ~1374–1378, 128–137, 1431–1446)
 * NOTE: lists match running pnr.js (differs slightly from conditions.md for FQTS / INF / UN).
 */

export type SpecialService = {
  code?: string
  message?: string | null | undefined
}

/** Match pnr.js */
export const SPECIAL_MESSAGE_CODES = [
  "GFML",
  "MPRE",
  "WCHR",
  "WCHS",
  "WCHC",
  "BLND",
  "DEAF",
  "MEDA",
  "OXYG",
  "STCR",
  "XFML",
  "ADOC",
] as const

export const SPECIAL_MESSAGE_EXCEPTION_CODES = [
  "DOCO",
  "DOCT",
  "CTCR",
  "CTCT",
  "FQTV",
  "MAAS",
  "INF",
  "UN",
] as const

export const OTHER_MESSAGE_CODES = ["ADTK", "ADMD", "OTHS", "FQTS"] as const

/** OTHS messages that should appear in P4 Special Messages (orange) instead of Other */
export const SPECIAL_OTHS_MESSAGES = [
  "CHAUFFEUR DRIVE XXLD DUE TO FLT CANCELLATION",
] as const

export const CODES_EXCLUDED_FROM_EXCEPTION = [
  "TKNE",
  "DOCS",
  "CTCE",
  "CTCM",
] as const

function isSpecialOthsEntry(code: string, message: string): boolean {
  if (code !== "OTHS") return false
  const msgUp = message.toUpperCase()
  return SPECIAL_OTHS_MESSAGES.some((m) => msgUp.includes(m))
}

function inConstList<T extends readonly string[]>(
  list: T,
  code: string
): boolean {
  return (list as readonly string[]).includes(code)
}

export function hasCodeAndMessage(
  s: SpecialService | null | undefined
): boolean {
  if (!s || !s.code) return false
  const msg = s.message != null ? String(s.message).trim() : ""
  if (msg === "" || msg.toLowerCase() === "empty") return false
  return true
}

/** Minimal shape — use your full BookingJson if you already have it */
export type BookingJsonLike = { specialServices?: SpecialService[] }

function normalizeCode(code: string | undefined) {
  return (code || "").toUpperCase().trim()
}

export function evaluateMessagesAlarmFromPnrJson(data: BookingJsonLike): {
  hasSpecialMessage: boolean
  hasSpecialMessageException: boolean
  /** For UI: red dot */
  alarmIsRed: boolean
  /** For UI: orange dot (only if not red) */
  alarmIsOrange: boolean
} {
  const list = data.specialServices || []
  const hasSpecialMessage =
    list.some(
      (s) =>
        hasCodeAndMessage(s) &&
        inConstList(SPECIAL_MESSAGE_CODES, normalizeCode(s.code))
    ) ||
    list.some(
      (s) =>
        hasCodeAndMessage(s) &&
        isSpecialOthsEntry(
          normalizeCode(s.code),
          s.message != null ? String(s.message) : ""
        )
    )
  const hasSpecialMessageException = list.some((s) => {
    if (!hasCodeAndMessage(s)) return false
    const code = normalizeCode(s.code)
    if (inConstList(CODES_EXCLUDED_FROM_EXCEPTION, code)) return false
    if (inConstList(SPECIAL_MESSAGE_EXCEPTION_CODES, code)) return true
    if (
      !inConstList(SPECIAL_MESSAGE_CODES, code) &&
      !inConstList(OTHER_MESSAGE_CODES, code)
    )
      return true
    return false
  })

  return {
    hasSpecialMessage,
    hasSpecialMessageException,
    alarmIsRed: hasSpecialMessageException,
    alarmIsOrange: !hasSpecialMessageException && hasSpecialMessage,
  }
}

/** Merge P3 SSR codes into alarm (updateMessagesAlarmFromP3) */
export function mergeMessagesAlarmWithP3Codes(
  pnr: ReturnType<typeof evaluateMessagesAlarmFromPnrJson>,
  p3Codes: string[] | null | undefined
): { alarmIsRed: boolean; alarmIsOrange: boolean } {
  let p3HasException = false
  let p3HasSpecial = false
  ;(p3Codes || []).forEach((raw) => {
    const c = normalizeCode(raw)
    if (
      inConstList(SPECIAL_MESSAGE_EXCEPTION_CODES, c) ||
      (!inConstList(SPECIAL_MESSAGE_CODES, c) &&
        !inConstList(CODES_EXCLUDED_FROM_EXCEPTION, c))
    ) {
      p3HasException = true
    } else if (inConstList(SPECIAL_MESSAGE_CODES, c)) {
      p3HasSpecial = true
    }
  })
  const hasException = pnr.hasSpecialMessageException || p3HasException
  const hasSpecial =
    pnr.hasSpecialMessage ||
    pnr.hasSpecialMessageException ||
    p3HasSpecial ||
    p3HasException
  return {
    alarmIsRed: hasException,
    alarmIsOrange: !hasException && hasSpecial,
  }
}

/**
 * P4 vs Other message tables (buildMessagesContent) — pnr.js filters.
 * P4: hasCode + message, not in OTHER, not in EXCLUDED.
 * Other: hasCode + message, code in OTHER (ADTK, ADMD, OTHS, FQTS, …).
 */
export type MessagesP4TableRow = {
  code: string
  message: string
  /** P4 “special” (orange) vs “exception/unknown” (red) per running pnr.js */
  tone: "special" | "exception"
}

export type MessagesOtherTableRow = { code: string; message: string }

function p4RowToneForCode(code: string): "special" | "exception" {
  const c = normalizeCode(code)
  if (inConstList(SPECIAL_MESSAGE_EXCEPTION_CODES, c)) return "exception"
  if (inConstList(SPECIAL_MESSAGE_CODES, c)) return "special"
  return "exception"
}

export function buildMessagesTablesFromPnr(
  data: BookingJsonLike | null | undefined
): {
  p4: MessagesP4TableRow[]
  other: MessagesOtherTableRow[]
} {
  const p4: MessagesP4TableRow[] = []
  const other: MessagesOtherTableRow[] = []
  for (const s of data?.specialServices || []) {
    if (!hasCodeAndMessage(s)) continue
    const code = normalizeCode(s.code)
    const message = s.message != null ? String(s.message) : ""
    if (isSpecialOthsEntry(code, message)) {
      p4.push({ code, message, tone: "special" })
      continue
    }
    if (inConstList(OTHER_MESSAGE_CODES, code)) {
      other.push({ code, message })
      continue
    }
    if (inConstList(CODES_EXCLUDED_FROM_EXCEPTION, code)) continue
    p4.push({ code, message, tone: p4RowToneForCode(code) })
  }
  return { p4, other }
}

/**
 * Ticket document numbers from Sabre GetBooking JSON (`accountingItems[].ticketNumber`),
 * same logic as n8n: collect, trim, dedupe.
 */
export function extractTicketNumbersFromBookingJson(
  data: unknown
): string[] {
  if (!data || typeof data !== "object") return []
  const rec = data as Record<string, unknown>
  const raw = rec.accountingItems
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const t = (item as Record<string, unknown>).ticketNumber
    if (typeof t === "string") {
      const s = t.trim()
      if (s) out.push(s)
    }
  }
  return [...new Set(out)]
}

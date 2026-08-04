import type { UnifiedBooking } from "./transform"

export type PnrStatus = "SYNCED" | "NO_FLIGHT" | "TICKETED" | "PROCESSING"

export type PnrStatusResult = {
  status: PnrStatus
  marked: string
}

export function determineStatus(booking: UnifiedBooking): PnrStatusResult {
  if (!booking.hasFlights) {
    return { status: "NO_FLIGHT", marked: "No Flight" }
  }

  if (booking.hasTickets && !booking.hasP3Exception) {
    return { status: "TICKETED", marked: "Ticketed" }
  }

  if (booking.hasP3Exception) {
    return { status: "PROCESSING", marked: "Processing" }
  }

  return { status: "SYNCED", marked: "OK" }
}

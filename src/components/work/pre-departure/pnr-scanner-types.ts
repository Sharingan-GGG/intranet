// Pre-Departure Scanner types (stub for compilation)

export interface ScannerPnr {
  pnr: string
  brand?: string
  status?: string
  consultantInitials?: string
  client?: string
  departureDate?: string
}

export interface ScannerSettings {
  fontSize: "sm" | "md" | "lg" | "xl"
  scope?: "all" | "mine"
}

export interface PnrCounts {
  all: number
  exception: number
  pending: number
  complete: number
}

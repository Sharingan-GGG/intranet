/**
 * Normalized types for Pre Departure / PNR dashboard and condition evaluation.
 * Legacy PNR_History row shape (from fetchDatabase.php GET) + computed statuses.
 */

export type TabStatus = "exception" | "pending" | "warning"

export type MotherTabKey = "flight" | "p3" | "ticket" | "messages" | "total"

export type LegacyPnrHistoryRow = {
  PNR: string
  Departure_Date?: string | null
  Profile_Name?: string | null
  Consultant_Name?: string | null
  Status: string
  Source_Type?: string | null
  Frequent_Flyer?: string | null
  Comment?: string | null
  Scanned_By?: string | null
  created_at?: string | null
  Scanned_On?: string | null
  Reported_IT?: string | null
  Brand?: string | null
  Initial?: string | null
}

export type DashboardPnrItem = {
  pnr: string
  client: string
  consultant: string
  source: string
  frequentFlyer: string
  brand?: string
  statusRaw: string
  scannedBy?: string | null
  departureDate?: string | null
  createdAt?: string | null
  scannedOn?: string | null
  reportedIT?: string | null
  statuses: {
    flight: TabStatus
    p3: TabStatus
    ticket: TabStatus
    messages: TabStatus
    total: TabStatus
  }
}

export type PnrJsonFlightSeat = {
  number?: string | null
  statusCode?: string | null
  statusName?: string | null
}
export type PnrJsonFlight = {
  itemId?: string | number | null
  /** IATA; legacy TD "receiver" column matches on this vs loyalty receiverCode */
  airlineCode?: string | null
  flightStatusCode?: string | null
  seats?: PnrJsonFlightSeat[]
  flightNumber?: string | number | null
  marketingAirline?: string | null
  fromAirportCode?: string | null
  toAirportCode?: string | null
  origin?: string | null
  destination?: string | null
  confirmationId?: string | number | null
  /** 1-based traveler indices when a flight applies only to some PAX */
  travelerIndices?: number[] | null
  departureDate?: string | null
  departureTime?: string | null
  arrivalDate?: string | null
  arrivalTime?: string | null
  /** Cabin / booking (when present in legacy JSON) */
  cabinClass?: string | null
  cabinCode?: string | null
  bookingClass?: string | null
}

export type PnrJsonSegment = {
  type?: string | null
  id?: string | number | null
  vendorCode?: string | null
  text?: string | null
}

export type PnrJsonLoyaltyProgram = {
  supplierCode?: string
  programNumber?: string
  receiverCode?: string
  programType?: string
}

/** PNR-level contacts; structure varies by legacy JSON (arrays of strings or objects). */
export type PnrJsonContactInfo = {
  emails?: unknown
  phones?: unknown
}

export type PnrJsonTraveler = {
  id?: string
  name?: string | null
  givenName?: string | null
  surname?: string | null
  type?: string | null
  passengerCode?: string | null
  frequentFlyerNumber?: string | null
  loyaltyPrograms?: PnrJsonLoyaltyProgram[]
  /** GDS-style name number when present (e.g. "1.1") — used for CTCE/CTCM SSR matching. */
  nameNumber?: string | number | null
  emails?: string[] | string | null
  phones?: Array<string | { number?: string | null }> | string | null
}
export type PnrJsonSpecialService = { code?: string; message?: string | null }
export type PnrJsonData = {
  travelers?: PnrJsonTraveler[]
  flights?: PnrJsonFlight[]
  /** ARNK + FLIGHT ordering source (legacy GDS build) */
  allSegments?: PnrJsonSegment[] | null
  specialServices?: PnrJsonSpecialService[]
  /** Booking-level contact lists (legacy getDebugEmailsAndPhones). */
  contactInfo?: PnrJsonContactInfo | null
  /** Legacy: P3 fetch skipped when missing (see conditions.md) */
  request?: { confirmationId?: string | null }
}

export type P3FetchResult = {
  error?: string
  soap?: unknown
  encoded?: boolean
  body?: string
}

export type TicketCoupon = { match?: boolean }
export type PnrTicketRow = { comparisons?: TicketCoupon[] }

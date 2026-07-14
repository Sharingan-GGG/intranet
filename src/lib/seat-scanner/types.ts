export interface BookingClass {
  code: string
  seats: number
  cabinCode?: string
}

export interface FlightSegment {
  airline: string
  flightNumber: string
  originAirport: string
  destinationAirport: string
  originCity: string
  destinationCity: string
  originDateTime: string
  destinationDateTime: string
  equipment?: string
  bookingClasses: BookingClass[]
  stopCount: number
}

export interface FlightRow {
  id: string
  date: string
  route: string
  durationStr: string
  durationMinutes: number
  segments: FlightSegment[]
  minSeats: number
  airlines: string[]
  bookingCodes: string[]
}

export interface RouteOption {
  key: string
  origin: string
  destination: string
  airlines: string[]
}

export interface FlightsResponse {
  flights: FlightRow[]
  routes: RouteOption[]
  availableBookingCodes: string[]
  availableAirlines: string[]
  dateRange: { min: string; max: string }
  totalCount: number
}

export interface FlightFilters {
  route?: string
  routes?: string
  dateStart?: string
  dateEnd?: string
  bookingClass?: string
  airlineCode?: string
  minSeats?: number
  page?: number
}

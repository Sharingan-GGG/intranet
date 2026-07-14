import type { FlightRow, FlightsResponse, RouteOption } from "./types"

function parseDurationToMinutes(d: string): number {
  const [h, m] = d.split(":").map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

const ROUTES: RouteOption[] = [
  { key: "FRA-AMS", origin: "FRA", destination: "AMS", airlines: ["LH", "CL"] },
  { key: "SYD-SIN", origin: "SYD", destination: "SIN", airlines: ["SQ", "QF"] },
  { key: "MEL-BKK", origin: "MEL", destination: "BKK", airlines: ["TG", "EK"] },
]

const BASE_DATES = Array.from({ length: 10 }, (_, i) => {
  const d = new Date("2026-07-02")
  d.setDate(d.getDate() + i)
  return d.toISOString().slice(0, 10)
})

interface RawSegmentTemplate {
  airline: string
  flightNumber: string
  origin: string
  destination: string
  originCity: string
  destinationCity: string
  depHour: number
  depMinute: number
  durationMin: number
  equipment?: string
  bookingClasses: Array<{ code: string; seats: number; cabinCode: string }>
}

const ROUTE_TEMPLATES: Record<string, RawSegmentTemplate[][]> = {
  "FRA-AMS": [
    [
      {
        airline: "LH",
        flightNumber: "986",
        origin: "FRA",
        destination: "AMS",
        originCity: "Frankfurt",
        destinationCity: "Amsterdam",
        depHour: 7,
        depMinute: 50,
        durationMin: 70,
        equipment: "A320",
        bookingClasses: [
          { code: "Z", seats: 9, cabinCode: "C" },
          { code: "P", seats: 9, cabinCode: "C" },
          { code: "Y", seats: 5, cabinCode: "Y" },
        ],
      },
    ],
    [
      {
        airline: "LH",
        flightNumber: "992",
        origin: "FRA",
        destination: "AMS",
        originCity: "Frankfurt",
        destinationCity: "Amsterdam",
        depHour: 12,
        depMinute: 40,
        durationMin: 70,
        equipment: "E190",
        bookingClasses: [
          { code: "Z", seats: 3, cabinCode: "C" },
          { code: "Y", seats: 9, cabinCode: "Y" },
          { code: "M", seats: 2, cabinCode: "Y" },
        ],
      },
    ],
    [
      {
        airline: "CL",
        flightNumber: "988",
        origin: "FRA",
        destination: "AMS",
        originCity: "Frankfurt",
        destinationCity: "Amsterdam",
        depHour: 9,
        depMinute: 30,
        durationMin: 70,
        equipment: "DH4",
        bookingClasses: [{ code: "Z", seats: 6, cabinCode: "C" }],
      },
    ],
  ],
  "SYD-SIN": [
    [
      {
        airline: "SQ",
        flightNumber: "222",
        origin: "SYD",
        destination: "SIN",
        originCity: "Sydney",
        destinationCity: "Singapore",
        depHour: 9,
        depMinute: 0,
        durationMin: 500,
        equipment: "77W",
        bookingClasses: [
          { code: "F", seats: 4, cabinCode: "F" },
          { code: "J", seats: 8, cabinCode: "C" },
          { code: "Y", seats: 9, cabinCode: "Y" },
        ],
      },
    ],
    [
      {
        airline: "QF",
        flightNumber: "1",
        origin: "SYD",
        destination: "SIN",
        originCity: "Sydney",
        destinationCity: "Singapore",
        depHour: 22,
        depMinute: 20,
        durationMin: 490,
        equipment: "A380",
        bookingClasses: [
          { code: "F", seats: 2, cabinCode: "F" },
          { code: "J", seats: 5, cabinCode: "C" },
          { code: "W", seats: 9, cabinCode: "W" },
          { code: "Y", seats: 9, cabinCode: "Y" },
        ],
      },
    ],
  ],
  "MEL-BKK": [
    [
      {
        airline: "TG",
        flightNumber: "465",
        origin: "MEL",
        destination: "BKK",
        originCity: "Melbourne",
        destinationCity: "Bangkok",
        depHour: 15,
        depMinute: 30,
        durationMin: 580,
        equipment: "773",
        bookingClasses: [
          { code: "C", seats: 7, cabinCode: "C" },
          { code: "D", seats: 3, cabinCode: "C" },
          { code: "Y", seats: 9, cabinCode: "Y" },
          { code: "B", seats: 4, cabinCode: "Y" },
        ],
      },
    ],
    [
      {
        airline: "EK",
        flightNumber: "407",
        origin: "MEL",
        destination: "DXB",
        originCity: "Melbourne",
        destinationCity: "Dubai",
        depHour: 22,
        depMinute: 10,
        durationMin: 855,
        equipment: "A388",
        bookingClasses: [
          { code: "F", seats: 1, cabinCode: "F" },
          { code: "J", seats: 6, cabinCode: "C" },
          { code: "Y", seats: 9, cabinCode: "Y" },
        ],
      },
      {
        airline: "EK",
        flightNumber: "370",
        origin: "DXB",
        destination: "BKK",
        originCity: "Dubai",
        destinationCity: "Bangkok",
        depHour: 6,
        depMinute: 55,
        durationMin: 390,
        equipment: "77W",
        bookingClasses: [
          { code: "J", seats: 6, cabinCode: "C" },
          { code: "Y", seats: 9, cabinCode: "Y" },
        ],
      },
    ],
  ],
}

function buildFlightRows(route: string): FlightRow[] {
  const templates = ROUTE_TEMPLATES[route] ?? []
  const rows: FlightRow[] = []

  BASE_DATES.forEach((date) => {
    templates.forEach((segTemplates, solutionIdx) => {
      const durationMin = segTemplates.reduce((sum, s) => sum + s.durationMin, 0)
      const h = Math.floor(durationMin / 60)
      const m = durationMin % 60
      const durationStr = `${h}:${String(m).padStart(2, "0")}`

      const segments = segTemplates.map((t) => {
        const depDt = new Date(`${date}T${String(t.depHour).padStart(2, "0")}:${String(t.depMinute).padStart(2, "0")}:00.000+10:00`)
        const arrDt = new Date(depDt.getTime() + t.durationMin * 60 * 1000)
        return {
          airline: t.airline,
          flightNumber: t.flightNumber,
          originAirport: t.origin,
          destinationAirport: t.destination,
          originCity: t.originCity,
          destinationCity: t.destinationCity,
          originDateTime: depDt.toISOString(),
          destinationDateTime: arrDt.toISOString(),
          equipment: t.equipment,
          bookingClasses: t.bookingClasses.map((bc) => ({
            code: bc.code,
            seats: bc.seats,
            cabinCode: bc.cabinCode,
          })),
          stopCount: 0,
        }
      })

      const allSeats = segments.flatMap((s) => s.bookingClasses.map((bc) => bc.seats))
      const minSeats = Math.min(...allSeats)
      const airlines = [...new Set(segments.map((s) => s.airline))]
      const bookingCodes = [...new Set(segments.flatMap((s) => s.bookingClasses.map((bc) => bc.code)))]

      rows.push({
        id: `${route}-${date}-${solutionIdx}`,
        date,
        route,
        durationStr,
        durationMinutes: parseDurationToMinutes(durationStr),
        segments,
        minSeats,
        airlines,
        bookingCodes,
      })
    })
  })

  return rows
}

const ALL_FLIGHTS = ROUTES.flatMap((r) => buildFlightRows(r.key))

export function getMockFlights(
  routeFilter: string | null,
  dateStart: string | null,
  dateEnd: string | null,
  bookingClasses: string[],
  airlineCodes: string[],
  minSeats: number
): FlightsResponse {
  const selectedRoutes = routeFilter
    ? routeFilter
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean)
    : []

  let flights = ALL_FLIGHTS

  if (selectedRoutes.length > 0) {
    flights = flights.filter((f) => selectedRoutes.includes(f.route))
  }
  if (dateStart) {
    flights = flights.filter((f) => f.date >= dateStart)
  }
  if (dateEnd) {
    flights = flights.filter((f) => f.date <= dateEnd)
  }
  if (bookingClasses.length > 0) {
    flights = flights.filter((f) =>
      bookingClasses.some((bc) => f.bookingCodes.includes(bc))
    )
  }
  if (airlineCodes.length > 0) {
    flights = flights.filter((f) =>
      airlineCodes.some((ac) => f.airlines.includes(ac))
    )
  }
  if (minSeats > 0) {
    flights = flights.filter((f) => f.minSeats >= minSeats)
  }

  const allDates = ALL_FLIGHTS.map((f) => f.date)
  const availableBookingCodes = [
    ...new Set(
      (selectedRoutes.length > 0
        ? ALL_FLIGHTS.filter((f) => selectedRoutes.includes(f.route))
        : ALL_FLIGHTS
      ).flatMap((f) => f.bookingCodes)
    ),
  ].sort()
  const availableAirlines = [
    ...new Set(
      (selectedRoutes.length > 0
        ? ALL_FLIGHTS.filter((f) => selectedRoutes.includes(f.route))
        : ALL_FLIGHTS
      ).flatMap((f) => f.airlines)
    ),
  ].sort()

  return {
    flights,
    routes: ROUTES,
    availableBookingCodes,
    availableAirlines,
    dateRange: {
      min: allDates[0] ?? "",
      max: allDates[allDates.length - 1] ?? "",
    },
    totalCount: flights.length,
  }
}

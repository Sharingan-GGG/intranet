import mysql from "mysql2/promise"
import type { BookingClass, FlightRow, FlightSegment, FlightsResponse, RouteOption } from "./types"

/* ── Connection pool ── */
let pool: mysql.Pool | null = null

function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host:               process.env.MYSQL_HOST!,
      port:               Number(process.env.MYSQL_PORT ?? 3306),
      user:               process.env.MYSQL_USER!,
      password:           process.env.MYSQL_PASSWORD!,
      database:           process.env.MYSQL_DATABASE!,
      waitForConnections: true,
      connectionLimit:    5,
      charset:            "utf8mb4",
      connectTimeout:     8000,
    })
  }
  return pool
}

/* ─────────────────────────────────────────
   DB row shape
   id              | int
   origin-destination | varchar  e.g. "BNE-DFW"
   code            | varchar  e.g. "QF"
   baseDate        | date     (mysql2 returns as JS Date)
   JSON            | longtext
   ───────────────────────────────────────── */
interface DbRow {
  JSON: string
  baseDate: Date | string
  "origin-destination": string
  code: string
}

/* ─────────────────────────────────────────
   JSON column format (always an array of solutions)

   [{
     "duration": "18:45",
     "segments": [{
       "disclosureCode": "QF",
       "flightNumber": "511",
       "originAirport": "BNE",
       "originCity": "BNE",
       "destinationAirport": "SYD",
       "destinationCity": "SYD",
       "originDateTime": "2026-05-26T08:45:00.000+10:00",
       "destinationDateTime": "2026-05-26T10:20:00.000+10:00",
       "availabilities": [{ "bookingClassCode": "I", "seatAvailability": "5", "status": "" }]
     }]
   }]
   ───────────────────────────────────────── */
interface RawAvailability {
  bookingClassCode: string
  seatAvailability: string | number
  status?: string
}
interface RawSegment {
  disclosureCode: string
  flightNumber: string
  originAirport: string
  destinationAirport: string
  originCity: string
  destinationCity: string
  originDateTime: string
  destinationDateTime: string
  availabilities: RawAvailability[]
  airMiles?: string
  originTimezoneOffset?: string
  destinationTimezoneOffset?: string
}
interface RawSolution {
  duration: string
  segments: RawSegment[]
}

/* ── Helpers ── */
function parseDurationToMinutes(dur: string): number {
  const [h, m] = dur.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

function toDateStr(val: Date | string): string {
  if (val instanceof Date) return val.toISOString().slice(0, 10)
  return String(val).slice(0, 10)
}

/* ── Parse one DB row into FlightRow[] ── */
function parseRow(row: DbRow): FlightRow[] {
  let solutions: RawSolution[]
  try {
    const parsed = JSON.parse(row.JSON)
    if (!Array.isArray(parsed)) return []
    solutions = parsed as RawSolution[]
  } catch {
    return []
  }

  const route = row["origin-destination"].replace(/\s*-\s*/g, "-").trim().toUpperCase()
  const rows: FlightRow[] = []
  const seenFingerprints = new Set<string>()

  for (let idx = 0; idx < solutions.length; idx++) {
    const sol = solutions[idx]
    if (!sol.segments?.length) continue

    const date = sol.segments[0].originDateTime?.slice(0, 10) ?? toDateStr(row.baseDate)

    // Fingerprint covers every leg so different connections are kept while true dupes are dropped
    const fingerprint = sol.segments.map((s) => `${s.disclosureCode}${s.flightNumber}|${s.originDateTime}`).join("~")
    if (seenFingerprints.has(fingerprint)) continue
    seenFingerprints.add(fingerprint)

    const segments: FlightSegment[] = sol.segments.map((s): FlightSegment => {
      const bookingClasses: BookingClass[] = s.availabilities.map((a) => ({
        code:  a.bookingClassCode,
        seats: Number(a.seatAvailability),
      }))
      return {
        airline:             s.disclosureCode,
        flightNumber:        s.flightNumber,
        originAirport:       s.originAirport,
        destinationAirport:  s.destinationAirport,
        originCity:          s.originCity,
        destinationCity:     s.destinationCity,
        originDateTime:      s.originDateTime,
        destinationDateTime: s.destinationDateTime,
        bookingClasses,
        stopCount:           0,
      }
    })

    const durationStr     = sol.duration ?? "0:00"
    const durationMinutes = parseDurationToMinutes(durationStr)

    const positiveSeats = segments
      .flatMap((s) => s.bookingClasses.map((bc) => bc.seats))
      .filter((n) => n > 0)
    const minSeats = positiveSeats.length ? Math.min(...positiveSeats) : 0

    rows.push({
      id:             `${route}-${date}-${rows.length}`,
      date,
      route,
      durationStr,
      durationMinutes,
      segments,
      minSeats,
      airlines:     [...new Set(segments.map((s) => s.airline))],
      bookingCodes: [...new Set(segments.flatMap((s) => s.bookingClasses.map((bc) => bc.code)))],
    })
  }

  return rows
}

/* ── Build FlightsResponse metadata from flights ── */
function buildResponse(flights: FlightRow[]): FlightsResponse {
  const routeMap = new Map<string, RouteOption>()
  for (const f of flights) {
    if (!routeMap.has(f.route)) {
      const [origin = "", destination = ""] = f.route.split("-")
      routeMap.set(f.route, { key: f.route, origin, destination, airlines: [] })
    }
    const ro = routeMap.get(f.route)!
    for (const a of f.airlines) {
      if (!ro.airlines.includes(a)) ro.airlines.push(a)
    }
  }

  const dates = flights.map((f) => f.date).filter(Boolean).sort()

  return {
    flights,
    routes:                [...routeMap.values()].sort((a, b) => a.key.localeCompare(b.key)),
    availableBookingCodes: [...new Set(flights.flatMap((f) => f.bookingCodes))].sort(),
    availableAirlines:     [...new Set(flights.flatMap((f) => f.airlines))].sort(),
    dateRange: {
      min: dates[0]                ?? "",
      max: dates[dates.length - 1] ?? "",
    },
    totalCount: flights.length,
  }
}

/* ── Server-side in-memory cache (expires at 6 AM daily) ── */
let serverCache: { data: FlightsResponse; cachedAt: number } | null = null

function last6AMTimestamp(): number {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0, 0, 0)
  if (now < d) d.setDate(d.getDate() - 1)
  return d.getTime()
}

/* ── Public API ── */
export async function fetchFlightsFromDB(): Promise<FlightsResponse> {
  if (serverCache && serverCache.cachedAt >= last6AMTimestamp()) {
    return serverCache.data
  }

  const conn = await getPool().getConnection()
  try {
    const [rows] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT r.\`JSON\`, r.\`baseDate\`, r.\`origin-destination\`, r.\`code\`
       FROM \`results\` r
       INNER JOIN (
         SELECT \`origin-destination\`, \`baseDate\`, MAX(\`id\`) AS max_id
         FROM \`results\`
         WHERE \`JSON\` IS NOT NULL AND \`JSON\` != ''
         GROUP BY \`origin-destination\`, \`baseDate\`
       ) latest ON r.\`id\` = latest.max_id
       ORDER BY r.\`baseDate\` ASC`
    )

    const raw: FlightRow[] = []
    for (const row of rows) {
      raw.push(...parseRow(row as DbRow))
    }

    // Deduplicate across DB rows: the scanner runs daily so the same actual flight
    // (same route, same legs, same departure) can appear in rows with different baseDates.
    const seen = new Set<string>()
    const routeDateCounters = new Map<string, number>()
    const flights: FlightRow[] = []
    for (const f of raw) {
      const key = `${f.route}|${f.segments.map((s) => `${s.airline}${s.flightNumber}|${s.originDateTime}`).join("~")}`
      if (!seen.has(key)) {
        seen.add(key)
        // Reassign IDs globally so distinct flights on the same route+date never share an index
        const routeDate = `${f.route}-${f.date}`
        const n = routeDateCounters.get(routeDate) ?? 0
        routeDateCounters.set(routeDate, n + 1)
        flights.push({ ...f, id: `${routeDate}-${n}` })
      }
    }

    const data = buildResponse(flights)
    serverCache = { data, cachedAt: Date.now() }
    return data
  } finally {
    conn.release()
  }
}

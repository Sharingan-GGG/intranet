"use client"

import { useEffect, useRef, useState } from "react"
import { addDays, format } from "date-fns"
import { Loader2 } from "lucide-react"

function AirplaneSvg() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-8 text-primary">
      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
    </svg>
  )
}
import type { FlightFilters, FlightRow } from "@/lib/seat-scanner/types"
import type { FlightsResponse } from "@/app/api/seat-scanner/flights/route"
import type { StopsFilter } from "./filter-header"
import { FlightTable } from "./flight-table"
import { useFavoriteRoutes } from "./route-multi-select"

/* ── Client-side module cache (persists across re-mounts, expires at 6 AM) ── */
let clientCache: { data: FlightsResponse; fetchedAt: number } | null = null

function last6AMMs(): number {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 6, 0, 0, 0)
  if (now < d) d.setDate(d.getDate() - 1)
  return d.getTime()
}

const now = new Date()
const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

function makeDefaults(dateEnd: Date): FlightFilters & { stops: StopsFilter } {
  return {
    dateStart: format(todayStart, "yyyy-MM-dd"),
    dateEnd:   format(dateEnd,    "yyyy-MM-dd"),
    stops:     "any",
  }
}

const FIRST_WINDOW  = makeDefaults(addDays(todayStart, 14))  // today +14, fast first paint
const SECOND_WINDOW = makeDefaults(addDays(todayStart, 30))  // today +30 default range

const LOADING_STEPS = [
  "Connecting to flight database…",
  "Loading routes…",
  "Fetching flight data…",
  "Preparing results…",
]

function applyFilters(all: FlightRow[], filters: FlightFilters & { stops: StopsFilter }): FlightRow[] {
  let result = all

  if (filters.routes) {
    const selected = filters.routes.split(",")
    result = result.filter((f) => selected.includes(f.route))
  }

  if (filters.dateStart && filters.dateEnd) {
    const start = new Date(filters.dateStart)
    const end   = new Date(filters.dateEnd)
    result = result.filter((f) => {
      const d = new Date(f.date)
      return d >= start && d <= end
    })
  }

  if (filters.bookingClass) {
    const codes = filters.bookingClass.split(",")
    result = result.filter((f) => codes.some((c) => f.bookingCodes.includes(c)))
  }

  if (filters.airlineCode) {
    const codes = filters.airlineCode.split(",")
    result = result.filter((f) => codes.some((c) => f.airlines.includes(c)))
  }

  if (filters.minSeats) {
    result = result.filter((f) => f.minSeats >= filters.minSeats!)
  }

  if (filters.stops && filters.stops !== "any") {
    result = result.filter((f) => {
      const legs = f.segments.length
      if (filters.stops === "direct")   return legs === 1
      if (filters.stops === "stopover") return legs >= 2
      return true
    })
  }

  return result
}

/* ── Loading overlay ── */
function LoadingOverlay() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => (s + 1) % LOADING_STEPS.length)
    }, 900)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex w-[300px] flex-col items-center gap-4 rounded-xl border bg-card px-10 py-8 shadow-xl">
        <Loader2 className="size-12 animate-spin text-primary" />
        <p className="w-full text-center text-[14px] font-medium text-foreground">{LOADING_STEPS[step]}</p>
        <div className="flex gap-1.5">
          {LOADING_STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1 w-5 rounded-full transition-colors duration-300 ${i === step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Shell ── */
export function SeatScannerShell() {
  const [flights, setFlights]               = useState<FlightRow[]>([])
  const [filteredFlights, setFilteredFlights] = useState<FlightRow[]>([])
  const [routes, setRoutes]                 = useState<string[]>([])
  const [bookingCodes, setBookingCodes]     = useState<string[]>([])
  const [airlines, setAirlines]             = useState<string[]>([])
  const [loading, setLoading]               = useState(true)
  const [defaults, setDefaults]             = useState<FlightFilters & { stops: StopsFilter }>(FIRST_WINDOW)
  const [favorites, setFavorites]           = useFavoriteRoutes()
  const [flightFavorites, setFlightFavorites] = useState<string[]>([])

  const activeFiltersRef = useRef<FlightFilters & { stops: StopsFilter }>(FIRST_WINDOW)

  useEffect(() => {
    let cancelled = false

    function applyAndSet(data: FlightsResponse) {
      setFlights(data.flights)
      setRoutes((data.routes ?? []).map((r) => r.key))
      setBookingCodes(data.availableBookingCodes ?? [])
      setAirlines(data.availableAirlines ?? [])

      const first = applyFilters(data.flights, FIRST_WINDOW)
      if (first.length > 0) {
        setFilteredFlights(first)
      } else {
        const second = applyFilters(data.flights, SECOND_WINDOW)
        setDefaults(SECOND_WINDOW)
        activeFiltersRef.current = SECOND_WINDOW
        setFilteredFlights(second)
      }
    }

    // Serve from client module cache if still valid (resets at 6 AM)
    if (clientCache && clientCache.fetchedAt >= last6AMMs()) {
      applyAndSet(clientCache.data)
      setLoading(false)
      return
    }

    setLoading(true)

    fetch("/api/seat-scanner/flights")
      .then((r) => r.json())
      .then((data: FlightsResponse & { error?: string }) => {
        if (cancelled) return
        if (data.error || !Array.isArray(data.flights)) {
          console.error("[SeatScannerShell] API error:", data.error ?? "unexpected response shape")
          return
        }
        clientCache = { data, fetchedAt: Date.now() }
        applyAndSet(data)
      })
      .catch((err) => {
        if (!cancelled) console.error("[SeatScannerShell] failed to load flights:", err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  const handleFilterChange = (filters: FlightFilters & { stops: StopsFilter }) => {
    activeFiltersRef.current = filters
    setFilteredFlights(applyFilters(flights, filters))
  }

  const handleClear = () => {
    activeFiltersRef.current = defaults
    setFilteredFlights(applyFilters(flights, defaults))
  }

  return (
    <>
      {loading && <LoadingOverlay />}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="@container/main flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col">
            <FlightTable
              key={defaults.dateEnd}
              flights={filteredFlights}
              allFlights={flights}
              availableRoutes={routes}
              availableBookingCodes={bookingCodes}
              availableAirlines={airlines}
              initialFilters={defaults}
              onFiltersChange={handleFilterChange}
              onClear={handleClear}
              favoriteRoutes={favorites}
              onFavoritesChange={setFavorites}
              flightFavorites={flightFavorites}
              onFlightFavoritesChange={setFlightFavorites}
              isLoading={loading}
            />
          </div>
        </div>
      </div>
    </>
  )
}

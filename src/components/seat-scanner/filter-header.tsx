"use client"

import { useEffect, useMemo, useState } from "react"
import { addDays, format } from "date-fns"
import { Home, Moon, Sun, Trash2 } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { FlightFilters, FlightRow } from "@/lib/seat-scanner/types"

import { RangeCalendar } from "./range-calendar"
import { RouteMultiSelect } from "./route-multi-select"
import { AirlineSelect, BookingClassSelect } from "./searchable-selects"

export type StopsFilter = "direct" | "stopover" | "any" | "vs"

interface FilterHeaderProps {
  flights: FlightRow[]
  /** Unfiltered dataset — source for cascading filter options. */
  allFlights?: FlightRow[]
  routes: string[]
  bookingCodes: string[]
  airlines: string[]
  favorites: string[]
  onFavoritesChange: (next: string[]) => void
  initial?: Partial<FlightFilters & { stops: StopsFilter }>
  /** Called with the latest filter state — auto-applied on every change. */
  onChange: (filters: FlightFilters & { stops: StopsFilter }) => void
  onClear: () => void
}

const LABEL = "text-[12px] font-medium text-muted-foreground whitespace-nowrap"

function parseDateString(s?: string): Date | undefined {
  return s ? new Date(s + "T00:00:00") : undefined
}

export function FilterHeader({
  flights,
  allFlights,
  routes,
  bookingCodes,
  airlines,
  favorites,
  onFavoritesChange,
  initial,
  onChange,
  onClear,
}: FilterHeaderProps) {
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>(
    initial?.routes ? initial.routes.split(",").filter(Boolean) : []
  )
  const [range, setRange] = useState<DateRange | undefined>(() =>
    initial?.dateStart || initial?.dateEnd
      ? { from: parseDateString(initial?.dateStart), to: parseDateString(initial?.dateEnd) }
      : { from: new Date(), to: addDays(new Date(), 30) }
  )
  const [bookingClasses, setBookingClasses] = useState<string[]>(
    initial?.bookingClass ? initial.bookingClass.split(",").filter(Boolean) : []
  )
  const [airlineCodes, setAirlineCodes] = useState<string[]>(
    initial?.airlineCode ? initial.airlineCode.split(",").filter(Boolean) : []
  )
  const [minSeats, setMinSeats] = useState(String(initial?.minSeats ?? 0))

  // Auto-apply: re-emit filters whenever any control changes.
  // Stops is controlled by FlightTable's info bar, not this header — always emit "any".
  useEffect(() => {
    onChange({
      routes: selectedRoutes.length ? selectedRoutes.join(",") : undefined,
      dateStart: range?.from ? format(range.from, "yyyy-MM-dd") : undefined,
      dateEnd:   range?.to   ? format(range.to,   "yyyy-MM-dd") : undefined,
      bookingClass: bookingClasses.length ? bookingClasses.join(",") : undefined,
      airlineCode: airlineCodes.length ? airlineCodes.join(",") : undefined,
      minSeats: Number(minSeats) > 0 ? Number(minSeats) : undefined,
      page: 1,
      stops: "any",
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoutes, range?.from, range?.to, bookingClasses, airlineCodes, minSeats])

  // ── Cascading filter options ──
  // Scope the full dataset by the selected date range, then by routes, so the
  // Class / Airline pickers and the routes dropdown only offer what actually flies.
  const pool = allFlights ?? flights
  const dateFrom = range?.from ? format(range.from, "yyyy-MM-dd") : undefined
  const dateTo   = range?.to   ? format(range.to,   "yyyy-MM-dd") : undefined

  const flightsInRange = useMemo(
    () => pool.filter((f) => (!dateFrom || f.date >= dateFrom) && (!dateTo || f.date <= dateTo)),
    [pool, dateFrom, dateTo]
  )

  const routeSet = new Set(selectedRoutes)
  const scoped = useMemo(
    () => selectedRoutes.length === 0
      ? flightsInRange
      : flightsInRange.filter((f) =>
          routeSet.has(f.route) ||
          f.segments.some((s) => routeSet.has(`${s.originAirport}-${s.destinationAirport}`))
        ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flightsInRange, selectedRoutes]
  )

  const classesInRoutes = useMemo(
    () => [...new Set(scoped.flatMap((f) =>
        f.segments.flatMap((s) => s.bookingClasses.map((bc) => bc.code))
      ))],
    [scoped]
  )

  const airlinesInScope = useMemo(
    () => [...new Set(scoped.flatMap((f) => f.segments.map((s) => s.airline)))].sort(),
    [scoped]
  )

  // Route → airlines available within the selected date range (for the routes dropdown).
  const routeAirlines = useMemo(() => {
    const map: Record<string, string[]> = {}
    const sets = new Map<string, Set<string>>()
    for (const f of flightsInRange) {
      const set = sets.get(f.route) ?? new Set<string>()
      for (const seg of f.segments) set.add(seg.airline)
      sets.set(f.route, set)
    }
    for (const [route, set] of sets) map[route] = [...set].sort()
    return map
  }, [flightsInRange])

  // Build month×airlines side panel data from flights.
  const monthAirlines = (() => {
    const map = new Map<string, Set<string>>()
    for (const f of flights) {
      const d = new Date(f.date + "T00:00:00")
      const key = `${d.getFullYear()}-${d.getMonth()}`
      const set = map.get(key) ?? new Set<string>()
      for (const s of f.segments) set.add(s.airline)
      map.set(key, set)
    }
    return [...map.entries()].map(([k, set]) => {
      const [y, m] = k.split("-").map(Number)
      return { year: y, month: m, airlines: [...set].sort() }
    })
  })()

  function handleClear() {
    setSelectedRoutes([])
    setRange(undefined)
    setBookingClasses([])
    setAirlineCodes([])
    setMinSeats("0")
    onClear()
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3 md:gap-4">
      <Field label="Routes:">
        <RouteMultiSelect
          routes={routes}
          routeAirlines={routeAirlines}
          value={selectedRoutes}
          onChange={setSelectedRoutes}
          favorites={favorites}
          onFavoritesChange={onFavoritesChange}
        />
      </Field>

      <Field label="Range:">
        <RangeCalendar value={range} onChange={setRange} monthAirlines={monthAirlines} />
      </Field>

      <Field label="Class:">
        <BookingClassSelect
          classes={bookingCodes}
          classesInRoutes={classesInRoutes}
          value={bookingClasses}
          onChange={setBookingClasses}
        />
      </Field>

      <Field label="Airline:">
        <AirlineSelect
          airlinesInRoutes={airlinesInScope.length ? airlinesInScope : airlines}
          value={airlineCodes}
          onChange={setAirlineCodes}
        />
      </Field>

      <Field label="Seats:">
        <Select value={minSeats} onValueChange={setMinSeats}>
          <SelectTrigger className="h-9 w-[84px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Any</SelectItem>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <SelectItem key={n} value={String(n)}>{n}+</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleClear} className="h-9">
          <Trash2 className="size-3.5" />
          Reset
        </Button>
        <Button variant="outline" size="sm" className="h-9 w-9 px-0" asChild>
          <a href="/" aria-label="Home">
            <Home className="size-4" />
          </a>
        </Button>
        <ThemeToggle />
      </div>
    </div>
  )
}

const SEAT_SCANNER_THEME_KEY = "seat-scanner-theme"

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    const stored = window.localStorage.getItem(SEAT_SCANNER_THEME_KEY)
    const current =
      stored === "light" || stored === "dark"
        ? stored
        : document.documentElement.getAttribute("data-theme") === "dark"
          ? "dark"
          : "light"
    document.documentElement.setAttribute("data-theme", current)
    setTheme(current)
  }, [])

  function toggle() {
    const next = theme === "dark" ? "light" : "dark"
    document.documentElement.setAttribute("data-theme", next)
    window.localStorage.setItem(SEAT_SCANNER_THEME_KEY, next)
    setTheme(next)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-9 w-9 px-0"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2">
      <Label className={LABEL}>{label}</Label>
      {children}
    </div>
  )
}

function SegToggle<T extends string>({
  value, onChange, options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: React.ReactNode }[]
}) {
  return (
    <div className="inline-flex h-9 items-center gap-0 rounded-md border border-input bg-muted p-[2px]" role="radiogroup">
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-[30px] rounded px-2.5 text-[12px] font-medium transition",
              active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

"use client"

import { Fragment, useMemo, useState } from "react"
import {
  ChevronsUpDown, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ArrowRight,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { FlightFilters, FlightRow, FlightSegment } from "@/lib/seat-scanner/types"

import { FlightCell } from "./airline-mark"
import { VsIcon } from "./vs-icon"
import { CompareToggle, useCompareSet } from "./compare"
import { FilterHeader, type StopsFilter } from "./filter-header"

const PAGE_SIZE = 30

type SortKey = "date" | "flight" | "route" | "departure" | "arrival" | "duration"

const HEADERS: { key: SortKey | null; label: string; style?: React.CSSProperties }[] = [
  { key: null,        label: "", style: { width: 52 } },
  { key: "date",      label: "Date" },
  { key: "flight",    label: "Flight" },
  { key: "route",     label: "Route" },
  { key: "departure", label: "Depart" },
  { key: "arrival",   label: "Arrive" },
  { key: "duration",  label: "Duration" },
  { key: null,        label: "Class & seats" },
]

interface FlightTableProps {
  flights: FlightRow[]
  allFlights?: FlightRow[]
  availableRoutes: string[]
  availableBookingCodes: string[]
  availableAirlines: string[]
  initialFilters?: Partial<FlightFilters & { stops: StopsFilter }>
  onFiltersChange: (filters: FlightFilters & { stops: StopsFilter }) => void
  onClear: () => void
  favoriteRoutes?: string[]
  onFavoritesChange?: (next: string[]) => void
  flightFavorites?: string[]
  onFlightFavoritesChange?: (next: string[]) => void
  getFlightId?: (f: FlightRow) => string | number
  isLoading?: boolean
}

export function FlightTable({
  flights,
  allFlights,
  availableRoutes,
  availableBookingCodes,
  availableAirlines,
  initialFilters,
  onFiltersChange,
  onClear,
  favoriteRoutes = [],
  onFavoritesChange,
  flightFavorites = [],
  onFlightFavoritesChange,
  getFlightId = (f) => `${f.route}|${f.segments.map((s) => `${s.airline}${s.flightNumber}|${s.originDateTime}`).join("~")}`,
  isLoading,
}: FlightTableProps) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "date", desc: false })
  const [page, setPage] = useState(1)
  const [compare, toggleCompare, clearCompare] = useCompareSet<string | number>()
  const [stops, setStops] = useState<StopsFilter>(initialFilters?.stops ?? "stopover")

  const sorted    = useMemo(() => sortFlights(flights,               sort), [flights,    sort])
  const allSorted = useMemo(() => sortFlights(allFlights ?? flights,  sort), [allFlights, flights, sort])

  const filtered = useMemo(() => {
    if (stops === "vs")       return allSorted.filter((f) => compare.has(getFlightId(f)))
    if (stops === "direct")   return sorted.filter((f) => f.segments.length === 1)
    if (stops === "stopover") return sorted.filter((f) => f.segments.length >= 2)
    return sorted
  }, [sorted, allSorted, stops, compare, getFlightId])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage  = Math.min(page, pageCount)
  const slice     = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: false }))
    setPage(1)
  }

  function handleStopsChange(v: StopsFilter) {
    setStops(v)
    setPage(1)
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-xl border bg-card text-card-foreground">

      {/* ── Sticky header: filter row + info bar ── */}
      <div className="sticky top-0 z-20 rounded-t-xl bg-card">
        <FilterHeader
          flights={flights}
          allFlights={allFlights ?? flights}
          routes={availableRoutes}
          bookingCodes={availableBookingCodes}
          airlines={availableAirlines}
          favorites={favoriteRoutes}
          onFavoritesChange={(next) => onFavoritesChange?.(next)}
          initial={initialFilters}
          onChange={(filters) => { onFiltersChange(filters); setPage(1) }}
          onClear={onClear}
        />

        {/* Info bar — flight count, Stops toggle, seat legend */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <p className="text-[13px] text-muted-foreground">
              <span className="font-medium tabular-nums text-foreground">{filtered.length}</span>{" "}
              flight{filtered.length === 1 ? "" : "s"}
            </p>
            <div className="hidden gap-3 text-[11px] text-muted-foreground sm:flex">
              <Legend tone="good">7+ seats</Legend>
              <Legend tone="warn">3–6 seats</Legend>
              <Legend tone="low">≤ 2 seats</Legend>
            </div>
          </div>

          {/* Stops toggle lives here */}
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-muted-foreground whitespace-nowrap">Stops:</span>
            <StopsToggle value={stops} onChange={handleStopsChange} vsCount={compare.size} />
          </div>
        </div>
      </div>

      {/* ── Scrollable table body ── */}
      <div className="relative min-h-0 w-full flex-1 overflow-auto">
        <table className="w-full caption-bottom text-sm">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                {HEADERS.map((h, i) => (
                  <TableHead
                    key={i}
                    style={h.style}
                    className="h-11 px-3 text-[12px] font-medium text-muted-foreground"
                  >
                    {h.key ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(h.key!)}
                        className="inline-flex items-center gap-1.5 hover:text-foreground"
                      >
                        <span>{h.label}</span>
                        <SortGlyph active={sort.key === h.key} desc={sort.desc} />
                      </button>
                    ) : (
                      <span>{h.label}</span>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={HEADERS.length} className="py-16 text-center text-sm text-muted-foreground">
                    Loading flights…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={HEADERS.length} className="py-16 text-center text-base text-muted-foreground">
                    No flights match the current filters and range date.
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && slice.map((flight, i) => (
                <FlightGroup
                  key={`${flight.id}-${i}`}
                  flight={flight}
                  zebra={i % 2 === 1}
                  favorites={flightFavorites}
                  onToggleFavorite={(id) => onFlightFavoritesChange?.(
                    flightFavorites.includes(id)
                      ? flightFavorites.filter((f) => f !== id)
                      : [...flightFavorites, id]
                  )}
                  isCompared={compare.has(getFlightId(flight))}
                  onToggleCompare={() => toggleCompare(getFlightId(flight))}
                />
              ))}
            </TableBody>
        </table>
      </div>

      {/* ── Pagination ── */}
      <footer className="flex items-center justify-between gap-4 border-t px-4 py-3 text-[13px] text-muted-foreground">
        <p>
          Showing{" "}
          <span className="font-medium tabular-nums text-foreground">
            {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)}
          </span>{" "}
          of{" "}
          <span className="font-medium tabular-nums text-foreground">{filtered.length}</span>
        </p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" disabled={safePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft className="size-3.5" />
            Previous
          </Button>
          <PageButtons page={safePage} pageCount={pageCount} onPageChange={setPage} />
          <Button variant="ghost" size="sm" disabled={safePage === pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>
            Next
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </footer>
    </section>
  )
}

/* ── Page number buttons (windowed, no overflow) ── */
function PageButtons({ page, pageCount, onPageChange }: { page: number; pageCount: number; onPageChange: (n: number) => void }) {
  if (pageCount <= 1) return null

  const pages: (number | "…")[] = []
  const delta = 2

  const addPage = (n: number) => { if (n >= 1 && n <= pageCount) pages.push(n) }
  const addEllipsis = () => { if (pages[pages.length - 1] !== "…") pages.push("…") }

  addPage(1)
  if (page - delta > 2) addEllipsis()
  for (let i = Math.max(2, page - delta); i <= Math.min(pageCount - 1, page + delta); i++) addPage(i)
  if (page + delta < pageCount - 1) addEllipsis()
  addPage(pageCount)

  return (
    <>
      {pages.map((n, i) =>
        n === "…" ? (
          <span key={`e-${i}`} className="px-1 text-muted-foreground">…</span>
        ) : (
          <Button
            key={n}
            variant={n === page ? "default" : "outline"}
            size="sm"
            className="min-w-8 px-2"
            onClick={() => onPageChange(n)}
          >
            {n}
          </Button>
        )
      )}
    </>
  )
}

/* ── Stops toggle ── */
function StopsToggle({ value, onChange, vsCount }: {
  value: StopsFilter
  onChange: (v: StopsFilter) => void
  vsCount: number
}) {
  const options: { value: StopsFilter; label: React.ReactNode }[] = [
    { value: "any",      label: "Any" },
    { value: "direct",   label: "Direct" },
    { value: "stopover", label: "InDirect" },
    {
      value: "vs",
      label: (
        <span className="inline-flex items-center gap-1">
          <VsIcon className="size-3" />
          VS
          {vsCount > 0 && (
            <span className="inline-flex h-[16px] items-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
              {vsCount}
            </span>
          )}
        </span>
      ),
    },
  ]
  return (
    <div className="inline-flex h-9 items-center rounded-md border border-input bg-muted p-[2px]" role="radiogroup" aria-label="Stops filter">
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

/* ── FlightGroup ── */
function FlightGroup({
  flight, zebra, favorites, onToggleFavorite, isCompared, onToggleCompare,
}: {
  flight: FlightRow
  zebra: boolean
  favorites: string[]
  onToggleFavorite?: (id: string) => void
  isCompared: boolean
  onToggleCompare: () => void
}) {
  const { day, dow, yr } = formatDate(flight.date)
  const direct  = flight.segments.length === 1

  function ActionCell() {
    return (
      <div className="inline-flex items-center gap-0.5">
        <CompareToggle active={isCompared} onClick={onToggleCompare} />
      </div>
    )
  }

  if (direct) {
    const s = flight.segments[0]!
    return (
      <TableRow className={cn(zebra && "bg-white dark:bg-white/10")}>
        <TableCell className="px-3 py-3" style={{ width: 52 }}><ActionCell /></TableCell>
        <TableCell className="px-3 py-3">
          <div className="flex flex-col leading-tight">
            <span className="font-medium tabular-nums">{day} {yr}</span>
            <span className="text-[12px] font-normal text-muted-foreground">{dow}</span>
          </div>
        </TableCell>
        <LegCells seg={s} />
      </TableRow>
    )
  }

  return (
    <>
      {flight.segments.map((seg, li) => (
        <TableRow
          key={li}
          className={cn(
            zebra && "bg-white dark:bg-white/10",
            li < flight.segments.length - 1 && "[&>td]:border-b-0"
          )}
        >
          <TableCell className="px-3 py-3" style={{ width: 52 }}>
            {li === 0 ? <ActionCell /> : null}
          </TableCell>
          {li === 0 ? (
            <TableCell className="px-3 py-3">
              <div className="flex flex-col leading-tight">
                <span className="font-medium tabular-nums">{day} {yr}</span>
                <span className="text-[12px] font-normal text-muted-foreground">{dow}</span>
                <span className="mt-1 text-[11px] font-medium text-muted-foreground">
                  {flight.segments.length} legs
                </span>
              </div>
            </TableCell>
          ) : (
            <TableCell className="px-3 py-3">
              <span className="inline-block h-[18px] w-[2px] rounded-full bg-primary/35 align-middle" />
              <span className="ml-2 text-[11px] font-medium text-muted-foreground">Leg {li + 1}</span>
            </TableCell>
          )}
          <LegCells seg={seg} />
        </TableRow>
      ))}
    </>
  )
}

function LegCells({ seg }: { seg: FlightSegment }) {
  return (
    <>
      <TableCell className="px-3 py-3">
        <FlightCell code={seg.airline} flightNumber={seg.flightNumber} />
      </TableCell>
      <TableCell className="px-3 py-3">
        <div className="inline-flex items-center gap-2 tabular-nums">
          <span className="font-semibold">{seg.originAirport}</span>
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <span className="font-semibold">{seg.destinationAirport}</span>
        </div>
      </TableCell>
      <TableCell className="px-3 py-3 font-mono tabular-nums">{formatTime(seg.originDateTime)}</TableCell>
      <TableCell className="px-3 py-3 font-mono tabular-nums">{formatTime(seg.destinationDateTime)}</TableCell>
      <TableCell className="px-3 py-3 tabular-nums text-muted-foreground">{durationFromSegment(seg)}</TableCell>
      <TableCell className="px-3 py-3">
        <div className="flex flex-wrap gap-1.5">
          {seg.bookingClasses.map((bc) => (
            <SeatPill key={bc.code} code={bc.code} seats={bc.seats} />
          ))}
        </div>
      </TableCell>
    </>
  )
}

/* ── Sub-components ── */

function SortGlyph({ active, desc }: { active: boolean; desc: boolean }) {
  if (!active) return <ChevronsUpDown className="size-3 opacity-50" />
  return desc ? <ChevronDown className="size-3 text-foreground" /> : <ChevronUp className="size-3 text-foreground" />
}
function Legend({ tone, children }: { tone: SeatTone; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-1.5 rounded-full", seatDot(tone))} />
      {children}
    </span>
  )
}
type SeatTone = "good" | "warn" | "low"
function seatTone(seats: number): SeatTone {
  if (seats <= 2) return "low"
  if (seats <= 6) return "warn"
  return "good"
}
function seatDot(tone: SeatTone) {
  return { good: "bg-emerald-500", warn: "bg-amber-500", low: "bg-red-500" }[tone]
}
function seatPillClass(tone: SeatTone) {
  return {
    good: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
    warn: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
    low:  "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
  }[tone]
}
function SeatPill({ code, seats }: { code: string; seats: number }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold tabular-nums",
      seatPillClass(seatTone(seats))
    )}>
      <span className="font-mono">{code}</span>
      <span className="opacity-50">·</span>
      <span>{seats}</span>
    </span>
  )
}

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00")
  return {
    day: d.toLocaleDateString("en-AU", { day: "2-digit", month: "short" }),
    dow: d.toLocaleDateString("en-AU", { weekday: "short" }),
    yr:  d.getFullYear(),
  }
}
function formatTime(iso?: string): string {
  if (!iso) return ""
  return iso.match(/T(\d{2}:\d{2})/)?.[1] ?? ""
}
function durationFromSegment(seg: FlightSegment): string {
  const d = new Date(seg.destinationDateTime).getTime() - new Date(seg.originDateTime).getTime()
  if (Number.isNaN(d) || d <= 0) return ""
  const h = Math.floor(d / 3_600_000)
  const m = Math.floor((d % 3_600_000) / 60_000)
  return `${h}h ${String(m).padStart(2, "0")}m`
}

function sortFlights(rows: FlightRow[], { key, desc }: { key: SortKey; desc: boolean }): FlightRow[] {
  const dir = desc ? -1 : 1
  const get = (r: FlightRow): string | number => {
    const seg  = r.segments[0]
    const last = r.segments[r.segments.length - 1]
    switch (key) {
      case "date":      return r.date
      case "flight":    return (seg?.airline ?? "") + (seg?.flightNumber ?? "")
      case "route":     return (seg?.originAirport ?? "") + (last?.destinationAirport ?? "")
      case "departure": return seg?.originDateTime ?? ""
      case "arrival":   return last?.destinationDateTime ?? ""
      case "duration":  return r.durationMinutes
    }
  }
  return [...rows].sort((a, b) => {
    const va = get(a), vb = get(b)
    if (va < vb) return -1 * dir
    if (va > vb) return 1  * dir
    return 0
  })
}

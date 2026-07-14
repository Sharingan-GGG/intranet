"use client"

import { useMemo, useRef, useState } from "react"
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react"
import { addDays, endOfMonth, format, startOfMonth, startOfWeek, endOfWeek } from "date-fns"
import type { DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { AirlineMark } from "./airline-mark"

interface RangeCalendarProps {
  value?: DateRange
  onChange: (range: DateRange | undefined) => void
  monthAirlines?: { year: number; month: number; airlines: string[] }[]
  width?: string
}

const MONTHS_VISIBLE = 12
const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

/** "+N days" presets build from the selected start date (or today if none picked). */
const PRESETS: { id: string; label: string; build: (base: Date) => { from: Date; to: Date } }[] = [
  { id: "thisweek",  label: "This week",  build: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) }) },
  { id: "thismonth", label: "This month", build: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { id: "plus30",    label: "+30 days",   build: (base) => ({ from: base, to: addDays(base, 30) }) },
  { id: "plus60",    label: "+60 days",   build: (base) => ({ from: base, to: addDays(base, 60) }) },
  { id: "plus90",    label: "+90 days",   build: (base) => ({ from: base, to: addDays(base, 90) }) },
]

function sameDay(a: Date | undefined, b: Date | undefined) {
  if (!a || !b) return false
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function inRange(d: Date, from: Date, to: Date) {
  const t = d.getTime()
  const s = new Date(from); s.setHours(0, 0, 0, 0)
  const e = new Date(to);   e.setHours(23, 59, 59, 999)
  return t >= s.getTime() && t <= e.getTime()
}
function addMonthsDate(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

/* ── Single month grid ── */
function MonthGrid({
  monthDate, draftFrom, draftTo,
  onDayClick,
}: {
  monthDate: Date
  draftFrom?: Date
  draftTo?: Date
  onDayClick: (d: Date) => void
}) {
  const today = useMemo(() => { const t = new Date(); t.setHours(0,0,0,0); return t }, [])
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const daysIn = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
  // Monday-first offset: Sunday(0)→6, Mon(1)→0, Tue(2)→1 …
  const firstDow = (first.getDay() + 6) % 7

  const cells: { d: Date; outside: boolean }[] = []
  for (let i = 0; i < firstDow; i++) {
    cells.push({ d: new Date(monthDate.getFullYear(), monthDate.getMonth(), i - firstDow + 1), outside: true })
  }
  for (let day = 1; day <= daysIn; day++) {
    cells.push({ d: new Date(monthDate.getFullYear(), monthDate.getMonth(), day), outside: false })
  }
  while (cells.length % 7 !== 0) {
    const last = cells.length
    cells.push({ d: new Date(monthDate.getFullYear(), monthDate.getMonth(), daysIn + (last - (firstDow + daysIn) + 1)), outside: true })
  }

  const monthLabel = monthDate.toLocaleDateString("en-AU", { month: "long", year: "numeric" })

  return (
    <div className="min-w-[200px]">
      {/* Month heading */}
      <div className="mb-2 flex items-center justify-center text-[13px] font-medium">
        {monthLabel}
      </div>
      {/* 7-col grid */}
      <div className="grid grid-cols-7">
        {DOW.map((d) => (
          <div key={d} className="py-1 text-center text-[11px] font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {cells.map(({ d, outside }, i) => {
          const isStart = sameDay(d, draftFrom)
          const isEnd   = sameDay(d, draftTo)
          const isRange = !!(draftFrom && draftTo && inRange(d, draftFrom, draftTo) && !isStart && !isEnd)
          const isToday = sameDay(d, today)
          return (
            <button
              key={i}
              type="button"
              onClick={() => !outside && onDayClick(d)}
              tabIndex={outside ? -1 : 0}
              className={cn(
                "relative flex h-8 items-center justify-center text-[12px] tabular-nums",
                "border-0 bg-transparent",
                outside && "opacity-40 text-muted-foreground cursor-default",
                !outside && !isStart && !isEnd && !isRange && "hover:bg-accent hover:rounded-md cursor-pointer",
                isToday && !isStart && !isEnd && "font-semibold",
                isRange && "bg-primary/15 text-foreground cursor-pointer",
                isStart && "bg-primary text-primary-foreground font-semibold rounded-l-md cursor-pointer",
                isEnd   && "bg-primary text-primary-foreground font-semibold rounded-r-md cursor-pointer",
                isStart && isEnd && "rounded-md",
              )}
            >
              {d.getDate()}
              {isToday && !isStart && !isEnd && (
                <span className="absolute bottom-0.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-primary" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ── Main component ── */
export function RangeCalendar({ value, onChange, monthAirlines = [], width = "w-[280px]" }: RangeCalendarProps) {
  const [open, setOpen] = useState(false)
  const [draftFrom, setDraftFrom] = useState<Date | undefined>(value?.from)
  const [draftTo,   setDraftTo  ] = useState<Date | undefined>(value?.to)
  const [mode, setMode] = useState<"start" | "end">("start")
  const calRef = useRef<HTMLDivElement>(null)

  function openChange(next: boolean) {
    if (next) {
      setDraftFrom(value?.from)
      setDraftTo(value?.to)
      setMode("start")
    }
    setOpen(next)
  }

  function handleDayClick(d: Date) {
    if (mode === "start" || !draftFrom) {
      setDraftFrom(d); setDraftTo(undefined); setMode("end")
    } else {
      if (d < draftFrom) { setDraftTo(draftFrom); setDraftFrom(d) }
      else setDraftTo(d)
      setMode("start")
    }
  }

  function apply() {
    if (!draftFrom) return
    onChange({ from: draftFrom, to: draftTo ?? draftFrom })
    setOpen(false)
  }
  function reset() {
    setDraftFrom(undefined); setDraftTo(undefined); setMode("start")
    onChange(undefined)
  }

  function jumpTo(year: number, monthIdx: number) {
    setDraftFrom(new Date(year, monthIdx, 1))
    setDraftTo(new Date(year, monthIdx + 1, 0))
    setMode("start")
    // scroll the month into view
    if (calRef.current) {
      const target = calRef.current.querySelector<HTMLElement>(`[data-month-key="${year}-${monthIdx}"]`)
      if (target) calRef.current.scrollTop = target.offsetTop - calRef.current.offsetTop - 4
    }
  }

  const label =
    value?.from && value?.to
      ? `${format(value.from, "dd MMM yyyy")} – ${format(value.to, "dd MMM yyyy")}`
      : value?.from
        ? `${format(value.from, "dd MMM yyyy")} – …`
        : "Any dates"

  const footerLabel =
    draftFrom && draftTo
      ? `${format(draftFrom, "dd MMM yyyy")} – ${format(draftTo, "dd MMM yyyy")}`
      : draftFrom
        ? `${format(draftFrom, "dd MMM yyyy")} – pick end date`
        : "Pick a start date"

  const anchorMonth = useMemo(() => {
    const base = value?.from ?? new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  }, [value?.from])

  const months = useMemo(
    () => Array.from({ length: MONTHS_VISIBLE }, (_, i) => addMonthsDate(anchorMonth, i)),
    [anchorMonth]
  )

  const sortedMonths = useMemo(
    () => [...monthAirlines].sort((a, b) => a.year - b.year || a.month - b.month),
    [monthAirlines]
  )

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          suppressHydrationWarning
          className={cn(
            "flex h-9 items-center justify-between gap-2 rounded-md border border-input bg-background px-2.5",
            "cursor-pointer text-[13px] hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
            open && "ring-2 ring-ring/30",
            width
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="tabular-nums">{label}</span>
          </span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto p-0">
        {/* Presets */}
        <div className="flex flex-wrap gap-1.5 border-b p-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                const r = p.build(draftFrom ?? new Date())
                setDraftFrom(r.from); setDraftTo(r.to); setMode("start")
              }}
              className="cursor-pointer rounded-full border bg-background px-3 py-1 text-[11px] hover:bg-accent"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Calendar + side panel */}
        <div
          className="grid"
          style={{ gridTemplateColumns: sortedMonths.length ? "minmax(660px,auto) 220px" : "auto" }}
        >
          {/* Month grids */}
          <div ref={calRef} className="grid max-h-[420px] grid-cols-3 gap-x-4 gap-y-4 overflow-y-auto p-3 scroll-smooth">
            {months.map((m) => (
              <div key={`${m.getFullYear()}-${m.getMonth()}`} data-month-key={`${m.getFullYear()}-${m.getMonth()}`}>
                <MonthGrid
                  monthDate={m}
                  draftFrom={draftFrom}
                  draftTo={draftTo}
                  onDayClick={handleDayClick}
                />
              </div>
            ))}
          </div>

          {/* Side panel */}
          {sortedMonths.length > 0 && (
            <aside className="max-h-[440px] overflow-y-auto border-l bg-muted/60 p-3">
              <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                Available by month
              </div>
              {sortedMonths.map((m) => (
                <button
                  key={`${m.year}-${m.month}`}
                  type="button"
                  onClick={() => jumpTo(m.year, m.month)}
                  className="mb-1 flex w-full cursor-pointer flex-col gap-1 rounded-md p-2 text-left hover:bg-accent"
                >
                  <span className="text-[12px] font-semibold">
                    {format(new Date(m.year, m.month, 1), "MMMM yyyy")}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {m.airlines.map((a) => <AirlineMark key={a} code={a} size={18} />)}
                  </div>
                </button>
              ))}
            </aside>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-[12px] text-muted-foreground">
          <span className="tabular-nums">{footerLabel}</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={reset}>Reset</Button>
            <Button size="sm" onClick={apply} disabled={!draftFrom}>Apply</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ── Standalone month airlines panel (always visible sidebar) ── */
export function MonthAirlinesPanel({
  monthAirlines = [],
}: {
  monthAirlines?: { year: number; month: number; airlines: string[] }[]
}) {
  const sortedMonths = useMemo(
    () => [...monthAirlines].sort((a, b) => a.year - b.year || a.month - b.month),
    [monthAirlines]
  )

  if (sortedMonths.length === 0) return null

  return (
    <aside className="flex min-h-0 min-w-[240px] flex-col gap-3 border-l bg-muted/40 p-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Available by month
      </div>
      <div className="min-h-0 overflow-y-auto">
        {sortedMonths.map((m) => (
          <div
            key={`${m.year}-${m.month}`}
            className="mb-1 flex flex-col gap-1 rounded-md p-2 text-left"
          >
            <span className="text-[12px] font-semibold">
              {format(new Date(m.year, m.month, 1), "MMM")}
            </span>
            <div className="flex flex-wrap gap-1">
              {m.airlines.map((a) => <AirlineMark key={a} code={a} size={16} />)}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}

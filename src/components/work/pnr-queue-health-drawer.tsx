"use client"

import * as React from "react"
import { ActivityIcon } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DashboardPnrItem } from "@/lib/pnr-types"

type Counts = {
  all: number
  exception: number
  pending: number
  complete: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isDateMatch(
  dateStr: string | null | undefined,
  target: Date,
): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return false
  return (
    d.getFullYear() === target.getFullYear() &&
    d.getMonth() === target.getMonth() &&
    d.getDate() === target.getDate()
  )
}

function isDateInCurrentMonth(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return false
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth()
  )
}

function isOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return false
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  return d.getTime() < startOfToday.getTime()
}

type ScanOutcomeMonth = {
  month: string
  pending: number
  exception: number
}

type ScanOutcomeConsultant = {
  name: string
  pending: number
  exception: number
}

/**
 * Pre Departure palette, from the `--chart-*` tokens in pre-departure.css. Using the
 * tokens rather than literal Tailwind colours keeps the drawer on brand and correct
 * in both themes, since each token carries a light and a dark value.
 *
 * chart-3 is pending (brand navy in light, a lighter blue in dark), chart-4 complete
 * (green), chart-5 exception (red).
 */
const TONE = {
  exception: { bar: "bg-chart-5", text: "text-chart-5", stroke: "text-chart-5" },
  pending: { bar: "bg-chart-3", text: "text-chart-3", stroke: "text-chart-3" },
  complete: { bar: "bg-chart-4", text: "text-chart-4", stroke: "text-chart-4" },
} as const

/** "2026-07-01" → "Jul". Parsed as UTC to match how the API buckets months. */
function formatMonthLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (isNaN(d.getTime())) return "?"
  return d.toLocaleString("en-AU", { month: "short", timeZone: "UTC" })
}

/** "2026-07" → "July 2026", for the picker. */
function formatMonthOption(ym: string): string {
  const d = new Date(`${ym}-01T00:00:00Z`)
  if (isNaN(d.getTime())) return ym
  return d.toLocaleString("en-AU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

/** Sentinel for "no month filter" — Radix Select forbids an empty string value. */
const ALL_MONTHS = "__all__"

function formatConsultantInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

// ─── Main Drawer ──────────────────────────────────────────────────────────────

export function PnrQueueHealthDrawer({
  open,
  onClose,
  counts,
  items,
}: {
  open: boolean
  onClose: () => void
  counts: Counts
  items: DashboardPnrItem[]
}) {
  const now = new Date()

  // Monthly first-scan verdicts. Fetched only while the drawer is open — this is a
  // panel most sessions never expose, so it should not cost a query on every render
  // of the dashboard behind it.
  const [outcomes, setOutcomes] = React.useState<ScanOutcomeMonth[] | null>(null)
  const [outcomeConsultants, setOutcomeConsultants] = React.useState<
    ScanOutcomeConsultant[]
  >([])
  const [availableMonths, setAvailableMonths] = React.useState<string[]>([])
  const [monthFilter, setMonthFilter] = React.useState<string>(ALL_MONTHS)
  const [outcomesError, setOutcomesError] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setOutcomesError(false)
    setOutcomes(null)
    const qs =
      monthFilter === ALL_MONTHS
        ? ""
        : `?month=${encodeURIComponent(monthFilter)}`
    fetch(`/api/pnr-queue/scan-outcomes${qs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(
        (json: {
          months?: ScanOutcomeMonth[]
          consultants?: ScanOutcomeConsultant[]
          available?: string[]
        }) => {
          if (cancelled) return
          setOutcomes(json.months ?? [])
          setOutcomeConsultants(json.consultants ?? [])
          setAvailableMonths(json.available ?? [])
        }
      )
      .catch(() => {
        if (!cancelled) setOutcomesError(true)
      })
    return () => {
      cancelled = true
    }
  }, [open, monthFilter])

  const today = items.filter((p) => isDateMatch(p.departureDate, now)).length
  const thisMonthCount = items.filter((p) =>
    isDateInCurrentMonth(p.departureDate),
  ).length
  const overdueCount = items.filter(
    (p) =>
      isOverdue(p.departureDate) &&
      (p.statusRaw || "").toLowerCase() !== "done",
  ).length

  const totalActive = counts.exception + counts.pending
  const totalAll = totalActive + counts.complete
  const completionRate =
    totalAll > 0 ? Math.round((counts.complete / totalAll) * 100) : 0

  // By consultant breakdown
  const consultantMap = new Map<
    string,
    { exception: number; pending: number; complete: number }
  >()
  for (const item of items) {
    const name = item.consultant || "Unknown"
    if (!consultantMap.has(name)) {
      consultantMap.set(name, { exception: 0, pending: 0, complete: 0 })
    }
    const entry = consultantMap.get(name)!
    const s = (item.statusRaw || "").toLowerCase()
    if (s === "exception") entry.exception++
    else if (s === "pending") entry.pending++
    else if (s === "done") entry.complete++
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent
        side="right"
        className="flex w-[380px] flex-col overflow-y-auto sm:w-[400px]"
      >
        <SheetHeader className="border-b pb-4">
          <div className="flex items-center gap-2.5">
            <ActivityIcon className="size-4 text-chart-4 shrink-0" />
            <div>
              <SheetTitle>Queue health</SheetTitle>
              <p className="text-xs text-muted-foreground">Real-time snapshot</p>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-5 px-4 py-5">
          {/* Headline */}
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Active to clear
            </p>
            <div className="mb-3 flex items-end gap-2">
              <div className="text-4xl font-semibold tabular-nums">
                {totalActive}
              </div>
              <div className="pb-1.5 text-xs text-muted-foreground">
                PNRs in queue
              </div>
            </div>

            {/* Status bar */}
            <div className="flex h-2 overflow-hidden rounded-full bg-muted">
              {totalAll > 0 && (
                <>
                  <div
                    className="bg-chart-5"
                    style={{
                      width: `${(counts.exception / totalAll) * 100}%`,
                    }}
                  />
                  <div
                    className="bg-chart-3"
                    style={{
                      width: `${(counts.pending / totalAll) * 100}%`,
                    }}
                  />
                  <div
                    className="bg-chart-4"
                    style={{
                      width: `${(counts.complete / totalAll) * 100}%`,
                    }}
                  />
                </>
              )}
            </div>

            <div className="mt-2 grid grid-cols-3 gap-1 text-xs">
              <StatusLegend
                dot="bg-chart-5"
                label="Exception"
                value={counts.exception}
                valueClass="text-chart-5"
              />
              <StatusLegend
                dot="bg-chart-3"
                label="Pending"
                value={counts.pending}
                valueClass="text-chart-3"
              />
              <StatusLegend
                dot="bg-chart-4"
                label="Done"
                value={counts.complete}
                valueClass="text-chart-4"
              />
            </div>
          </div>

          {/* Tiles */}
          <div className="grid grid-cols-3 gap-2">
            <HealthTile
              label="Today"
              value={today}
              tone={today > 0 ? "rose" : "muted"}
            />
            <HealthTile
              label="This Month"
              value={thisMonthCount}
              tone={thisMonthCount > 0 ? "amber" : "muted"}
            />
            <HealthTile
              label="Overdue"
              value={overdueCount}
              tone={overdueCount > 0 ? "rose" : "muted"}
            />
          </div>

          {/* Completion donut */}
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Completion rate
            </p>
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 shrink-0">
                <svg
                  viewBox="0 0 36 36"
                  className="h-16 w-16 -rotate-90"
                >
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    className="text-muted"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeDasharray={`${completionRate}, 100`}
                    strokeLinecap="round"
                    className="text-chart-4"
                  />
                </svg>
                <div className="absolute inset-0 grid place-items-center text-sm font-semibold tabular-nums">
                  {completionRate}%
                </div>
              </div>
              <div className="text-sm">
                <p>
                  <span className="font-medium tabular-nums">
                    {counts.complete}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    of {totalAll} cleared
                  </span>
                </p>
                {totalAll > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {totalActive} remaining
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* By consultant */}
          {consultantMap.size > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                By consultant
              </p>
              <div className="space-y-2.5">
                {Array.from(consultantMap.entries()).map(([name, c]) => {
                  const total = c.exception + c.pending + c.complete
                  return (
                    <div key={name}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-[9px] font-semibold">
                            {formatConsultantInitials(name)}
                          </div>
                          <span>{name}</span>
                        </div>
                        <span className="tabular-nums text-muted-foreground">
                          {total}
                        </span>
                      </div>
                      {total > 0 && (
                        <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="bg-chart-5"
                            style={{ width: `${(c.exception / total) * 100}%` }}
                          />
                          <div
                            className="bg-chart-3"
                            style={{ width: `${(c.pending / total) * 100}%` }}
                          />
                          <div
                            className="bg-chart-4"
                            style={{ width: `${(c.complete / total) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Analytics last: it is the historical read, and everything above it is
              the live snapshot the drawer leads with. */}
          <MonthlyVerdictChart
            months={outcomes}
            consultants={outcomeConsultants}
            failed={outcomesError}
            availableMonths={availableMonths}
            monthFilter={monthFilter}
            onMonthFilterChange={setMonthFilter}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Grouped bar chart of the first scan verdict per month: two bars per month, pending
 * in the brand navy and exception in red.
 *
 * Both series share one y-scale — the tallest single value across the window — so a
 * bar's height means the same thing in every month. Built from divs rather than a
 * charting dependency, matching the CSS bars used elsewhere in this drawer.
 *
 * The figures come from `pnr_scan_outcomes` and are frozen at first scan — they do
 * not move when a PNR is later approved or completed, which is what makes a past
 * month comparable to this one.
 */
function MonthlyVerdictChart({
  months,
  consultants,
  failed,
  availableMonths,
  monthFilter,
  onMonthFilterChange,
}: {
  months: ScanOutcomeMonth[] | null
  consultants: ScanOutcomeConsultant[]
  failed: boolean
  availableMonths: string[]
  monthFilter: string
  onMonthFilterChange: (v: string) => void
}) {
  const peak = React.useMemo(
    () =>
      Math.max(1, ...(months ?? []).map((m) => Math.max(m.pending, m.exception))),
    [months]
  )

  const totals = React.useMemo(() => {
    const src = months ?? []
    return {
      pending: src.reduce((a, m) => a + m.pending, 0),
      exception: src.reduce((a, m) => a + m.exception, 0),
    }
  }, [months])

  const scanned = totals.pending + totals.exception


  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Analytics PNR Status
        </p>
        <Select value={monthFilter} onValueChange={onMonthFilterChange}>
          <SelectTrigger className="h-6 w-auto gap-1 border-none px-1.5 text-[10px] shadow-none focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value={ALL_MONTHS} className="text-xs">
              Last 6 months
            </SelectItem>
            {availableMonths.map((ym) => (
              <SelectItem key={ym} value={ym} className="text-xs">
                {formatMonthOption(ym)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {scanned > 0 && (
        <p className="mb-2 text-[10px] tabular-nums text-muted-foreground">
          {Math.round((totals.exception / scanned) * 100)}% exception across{" "}
          {scanned} scan{scanned !== 1 ? "s" : ""}
        </p>
      )}

      {failed ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          Could not load scan history.
        </p>
      ) : months === null ? (
        <div className="flex h-24 items-end gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex-1 animate-pulse rounded-sm bg-muted" style={{ height: `${30 + ((i * 17) % 50)}%` }} />
          ))}
        </div>
      ) : scanned === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          {monthFilter === ALL_MONTHS
            ? "No scans recorded yet."
            : `No scans in ${formatMonthOption(monthFilter)}.`}
        </p>
      ) : (
        <>
          {/* One month on its own would stretch to the full card width and stop
              reading as a bar, so a single group keeps a column-like footprint. */}
          <div
            className={`flex h-24 items-end gap-2 border-b pb-px ${
              months.length === 1 ? "mx-auto w-20" : ""
            }`}
          >
            {months.map((m) => (
              <div
                key={m.month}
                className="flex h-full flex-1 items-end justify-center gap-1"
              >
                {/* min-height keeps a zero month visible as a hairline rather than
                    disappearing, so the group still reads as a month with no scans. */}
                <div
                  className={`w-1/2 min-w-[3px] rounded-t-sm transition-[height] ${TONE.pending.bar}`}
                  style={{ height: `${Math.max((m.pending / peak) * 100, 1)}%` }}
                  title={`${formatMonthLabel(m.month)}: ${m.pending} pending`}
                />
                <div
                  className={`w-1/2 min-w-[3px] rounded-t-sm transition-[height] ${TONE.exception.bar}`}
                  style={{ height: `${Math.max((m.exception / peak) * 100, 1)}%` }}
                  title={`${formatMonthLabel(m.month)}: ${m.exception} exception`}
                />
              </div>
            ))}
          </div>

          <div
            className={`mt-1.5 flex text-[9px] text-muted-foreground ${
              months.length === 1 ? "justify-center" : ""
            }`}
          >
            {months.map((m) => (
              <span key={m.month} className="flex-1 text-center">
                {formatMonthLabel(m.month)}
              </span>
            ))}
          </div>

          <div className="mt-3 flex justify-center gap-4 border-t pt-2 text-xs">
            <StatusLegend
              dot="bg-chart-3"
              label="Pending"
              value={totals.pending}
              valueClass="text-chart-3"
            />
            <StatusLegend
              dot="bg-chart-5"
              label="Exception"
              value={totals.exception}
              valueClass="text-chart-5"
            />
          </div>

          <ConsultantOutcomes consultants={consultants} />
        </>
      )}
    </div>
  )
}

/**
 * Per-consultant split of the same frozen verdicts the chart above shows, and so it
 * follows the month filter with it.
 *
 * Distinct from the "By consultant" section further down, which counts live queue
 * state: this one cannot change after the fact, so it answers "how did their work
 * land when it was first scanned" rather than "what is on their plate now".
 */
function ConsultantOutcomes({
  consultants,
}: {
  consultants: ScanOutcomeConsultant[]
}) {
  if (consultants.length === 0) return null

  return (
    <div className="mt-3 border-t pt-3">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        By consultant
      </p>
      <div className="space-y-2">
        {consultants.map((c) => {
          const total = c.pending + c.exception
          return (
            <div key={c.name}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="truncate">{c.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {c.exception}/{total} exc
                </span>
              </div>
              <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={TONE.exception.bar}
                  style={{ width: `${(c.exception / total) * 100}%` }}
                />
                <div
                  className={TONE.pending.bar}
                  style={{ width: `${(c.pending / total) * 100}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatusLegend({
  dot,
  label,
  value,
  valueClass,
}: {
  dot: string
  label: string
  value: number
  valueClass: string
}) {
  return (
    <div className="flex items-center gap-1">
      <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className={`ml-0.5 font-medium tabular-nums ${valueClass}`}>
        {value}
      </span>
    </div>
  )
}

function HealthTile({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "rose" | "amber" | "muted"
}) {
  const valueClass =
    tone === "rose"
      ? "text-chart-5"
      : tone === "amber"
        ? "text-chart-3"
        : "text-muted-foreground"

  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${valueClass}`}
      >
        {value}
      </p>
    </div>
  )
}

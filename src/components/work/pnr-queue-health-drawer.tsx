"use client"

import * as React from "react"
import { ActivityIcon } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
            <ActivityIcon className="size-4 text-emerald-500 shrink-0" />
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
                    className="bg-rose-500"
                    style={{
                      width: `${(counts.exception / totalAll) * 100}%`,
                    }}
                  />
                  <div
                    className="bg-amber-400"
                    style={{
                      width: `${(counts.pending / totalAll) * 100}%`,
                    }}
                  />
                  <div
                    className="bg-emerald-400"
                    style={{
                      width: `${(counts.complete / totalAll) * 100}%`,
                    }}
                  />
                </>
              )}
            </div>

            <div className="mt-2 grid grid-cols-3 gap-1 text-xs">
              <StatusLegend
                dot="bg-rose-500"
                label="Exception"
                value={counts.exception}
                valueClass="text-rose-500"
              />
              <StatusLegend
                dot="bg-amber-400"
                label="Pending"
                value={counts.pending}
                valueClass="text-amber-500"
              />
              <StatusLegend
                dot="bg-emerald-400"
                label="Done"
                value={counts.complete}
                valueClass="text-emerald-500"
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
                    className="text-emerald-500"
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
                            className="bg-rose-500"
                            style={{ width: `${(c.exception / total) * 100}%` }}
                          />
                          <div
                            className="bg-amber-400"
                            style={{ width: `${(c.pending / total) * 100}%` }}
                          />
                          <div
                            className="bg-emerald-400"
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
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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
      ? "text-rose-500"
      : tone === "amber"
        ? "text-amber-500"
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

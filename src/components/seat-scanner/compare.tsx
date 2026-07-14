"use client"

import { useEffect, useState } from "react"
import { ArrowLeftRight, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { FlightRow } from "@/lib/seat-scanner/types"

import { FlightCell } from "./airline-mark"

/**
 * Persist a Set<string | number> of "compare bookmarks" to localStorage.
 * Used by the VS popover + the per-row compare toggle.
 */
export function useCompareSet<T extends string | number>(
  key = "ss.compare"
): readonly [
  Set<T>,
  (id: T) => void,
  () => void,
] {
  const [ids, setIds] = useState<Set<T>>(new Set())

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) setIds(new Set(JSON.parse(raw)))
    } catch {}
  }, [key])

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify([...ids]))
  }, [ids, key])

  function toggle(id: T) {
    setIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function clear() {
    setIds(new Set())
  }

  return [ids, toggle, clear] as const
}

/**
 * Inline compare-icon toggle, used per row.
 */
export function CompareToggle({
  active,
  onClick,
  className,
}: {
  active: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={active ? "Remove from comparison" : "Add to comparison"}
      title={active ? "Remove from comparison" : "Add to comparison"}
      className={cn(
        "inline-flex size-6 items-center justify-center rounded text-muted-foreground",
        active && "bg-primary/10 text-primary",
        className
      )}
    >
      <ArrowLeftRight className="size-3.5" />
    </button>
  )
}

/**
 * "VS" button + popover listing the compared flights. Place in the
 * filter row or wherever a quick-access entry point makes sense.
 */
export function CompareButton<T extends string | number>({
  flights,
  selectedIds,
  onToggle,
  onClear,
  getId,
}: {
  flights: FlightRow[]
  selectedIds: Set<T>
  onToggle: (id: T) => void
  onClear: () => void
  /** How to extract the id you're tracking from a FlightRow. */
  getId: (f: FlightRow) => T
}) {
  const [open, setOpen] = useState(false)
  const count = selectedIds.size
  const selected = flights.filter((f) => selectedIds.has(getId(f)))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2">
          <ArrowLeftRight className="size-3.5" />
          <span className="font-bold tracking-[0.08em]">VS</span>
          {count > 0 && (
            <span className="inline-flex h-[18px] items-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
          <span className="text-[13px] font-semibold">Comparison</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={count === 0}
            className="h-6 px-2 text-[11px]"
          >
            Clear all
          </Button>
        </div>
        {count === 0 ? (
          <div className="px-3 py-6 text-center text-[13px] text-muted-foreground">
            Tap the <ArrowLeftRight className="inline-block size-3 -translate-y-px" /> icon on a flight to add it for comparison.
          </div>
        ) : (
          <div>
            {selected.map((f) => {
              const seg = f.segments[0]
              const last = f.segments[f.segments.length - 1]
              const stops = f.segments.length - 1
              return (
                <div
                  key={String(getId(f))}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 border-b px-3 py-2 last:border-b-0"
                >
                  <FlightCell code={seg?.airline ?? ""} flightNumber={seg?.flightNumber ?? ""} />
                  <div className="flex flex-col leading-tight">
                    <span className="text-[13px] font-medium tabular-nums">
                      {seg?.originAirport} → {last?.destinationAirport}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDate(f.date)} · {stops === 0 ? "Direct" : `${stops} stop${stops > 1 ? "s" : ""}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggle(getId(f))}
                    className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Remove"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00")
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", weekday: "short" })
}

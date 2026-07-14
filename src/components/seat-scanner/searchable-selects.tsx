"use client"

import { useRef, useState } from "react"
import { Check, ChevronDown, Search } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

import { AirlineMark, ALL_AIRLINES, airlineName } from "./airline-mark"

interface SearchableSelectProps {
  value: string
  onChange: (next: string) => void
  options: { value: string; label?: React.ReactNode; searchText?: string }[]
  placeholder?: string
  emptyText?: string
  width?: string
  searchPlaceholder?: string
}

export function SearchableSelect({
  value, onChange, options,
  placeholder = "All", emptyText = "No matches",
  width = "w-[150px]", searchPlaceholder = "Search…",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const current = options.find((o) => o.value === value)

  const q = search.toLowerCase()
  const filtered = options.filter((o) =>
    !q || (o.searchText ?? o.value).toLowerCase().includes(q)
  )

  function select(v: string) {
    onChange(v)
    setOpen(false)
    setSearch("")
  }

  return (
    <Popover open={open} onOpenChange={(v: boolean) => { setOpen(v); if (!v) setSearch("") }}>
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
          <span className="truncate text-left">
            {value ? (current?.label ?? value) : <span className="text-muted-foreground">{placeholder}</span>}
          </span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[280px] p-0"
        onOpenAutoFocus={(e: Event) => { e.preventDefault(); setTimeout(() => inputRef.current?.focus(), 0) }}
      >
        <div className="flex items-center gap-2 border-b px-3 py-2 text-muted-foreground">
          <Search className="size-3.5 shrink-0" />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="py-6 text-center text-[13px] text-muted-foreground">{emptyText}</div>
          )}
          <button
            type="button"
            onClick={() => select("")}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-[13px] hover:bg-accent hover:text-accent-foreground",
              value === "" && "bg-accent/50"
            )}
          >
            <Check className={cn("size-3.5 shrink-0", value === "" ? "opacity-100" : "opacity-0")} />
            <span>{placeholder}</span>
          </button>
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => select(o.value)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-[13px] hover:bg-accent hover:text-accent-foreground",
                value === o.value && "bg-accent/50"
              )}
            >
              <Check className={cn("size-3.5 shrink-0", value === o.value ? "opacity-100" : "opacity-0")} />
              {o.label ?? o.value}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Multi-select airline picker. Pass `airlinesInRoutes` to restrict to
 * carriers on selected routes; omit/empty to show all.
 */
export function AirlineSelect({
  airlinesInRoutes,
  value,
  onChange,
}: {
  airlinesInRoutes: string[]
  value: string[]
  onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const pool = airlinesInRoutes.length > 0 ? [...airlinesInRoutes].sort() : ALL_AIRLINES

  const q = search.toLowerCase()
  const filtered = pool.filter(
    (a) => !q || a.toLowerCase().includes(q) || airlineName(a).toLowerCase().includes(q)
  )

  function toggle(code: string) {
    onChange(value.includes(code) ? value.filter((a) => a !== code) : [...value, code])
  }

  return (
    <Popover open={open} onOpenChange={(v: boolean) => { setOpen(v); if (!v) setSearch("") }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          suppressHydrationWarning
          className={cn(
            "flex h-9 min-w-[140px] items-center justify-between gap-2 rounded-md border border-input bg-background px-2.5",
            "cursor-pointer text-[13px] hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
            open && "ring-2 ring-ring/30"
          )}
        >
          <span className="flex flex-1 items-center gap-1 overflow-hidden truncate text-left">
            {value.length === 0 ? (
              <span className="text-muted-foreground">All</span>
            ) : value.length === 1 ? (
              <span className="inline-flex items-center gap-1.5">
                <AirlineMark code={value[0]} size={16} />
                <span className="font-medium">{value[0]}</span>
              </span>
            ) : (
              <span className="font-medium">{value.length} airlines</span>
            )}
          </span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[260px] p-0"
        onOpenAutoFocus={(e: Event) => { e.preventDefault(); setTimeout(() => inputRef.current?.focus(), 0) }}
      >
        <div className="flex items-center gap-2 border-b px-3 py-2 text-muted-foreground">
          <Search className="size-3.5 shrink-0" />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search airlines…"
            className="flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="py-6 text-center text-[13px] text-muted-foreground">No matches</div>
          )}
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              Clear selection
            </button>
          )}
          {filtered.map((a) => {
            const selected = value.includes(a)
            return (
              <button
                key={a}
                type="button"
                onClick={() => toggle(a)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-[13px] hover:bg-accent hover:text-accent-foreground",
                  selected && "bg-accent/50"
                )}
              >
                <span className={cn(
                  "inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm border",
                  selected ? "border-primary bg-primary text-primary-foreground" : "border-input"
                )}>
                  {selected && <Check className="size-2.5" strokeWidth={3} />}
                </span>
                <AirlineMark code={a} size={20} />
                <span className="font-medium">{airlineName(a)}</span>
                <span className="ml-auto font-mono text-[11px] text-muted-foreground">{a}</span>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Booking-class picker. 4-column grid of class-letter tiles — multi-select.
 * Classes NOT available on the currently selected routes are rendered disabled.
 */
export function BookingClassSelect({
  classes,
  classesInRoutes,
  value,
  onChange,
}: {
  classes: string[]
  classesInRoutes: string[]
  value: string[]
  onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const available = new Set(
    classesInRoutes.length > 0 ? classesInRoutes : classes
  )
  const filtered = classes.filter((c) => !search || c.toLowerCase().includes(search.toLowerCase()))

  function toggle(c: string) {
    onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c])
  }

  return (
    <Popover open={open} onOpenChange={(v: boolean) => { setOpen(v); if (!v) setSearch("") }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          suppressHydrationWarning
          className={cn(
            "flex h-9 min-w-[110px] items-center justify-between gap-2 rounded-md border border-input bg-background px-2.5",
            "text-[13px] hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
            open && "ring-2 ring-ring/30"
          )}
        >
          <span className="truncate text-left tabular-nums">
            {value.length === 0 ? (
              <span className="text-muted-foreground">All</span>
            ) : value.length === 1 ? (
              <span className="font-mono font-semibold">{value[0]}</span>
            ) : (
              <span className="font-medium">{value.length} classes</span>
            )}
          </span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] p-0">
        <div className="flex items-center gap-2 border-b px-3 py-2 text-muted-foreground">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search classes…"
            className="flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Clear selection
          </button>
        )}
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-[13px] text-muted-foreground">
            No matches
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1.5 p-1.5">
            {filtered.map((c) => {
              const isSel = value.includes(c)
              const isDisabled = !available.has(c)
              return (
                <button
                  key={c}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => toggle(c)}
                  aria-disabled={isDisabled}
                  className={cn(
                    "flex h-10 items-center justify-center rounded-md border text-[14px] font-mono font-semibold transition",
                    isSel
                      ? "border-primary/40 bg-primary/10 text-primary dark:bg-primary/20"
                      : "border-border bg-background hover:bg-accent",
                    isDisabled && "cursor-not-allowed opacity-35"
                  )}
                >
                  {c}
                </button>
              )
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

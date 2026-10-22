"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowRight, Check, ChevronDown, Plane, Star, X } from "lucide-react"
import { Search } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

import { AirlineMark, airlineName } from "./airline-mark"

interface RouteMultiSelectProps {
  routes: string[]
  /** Route → airline codes available in the selected date range. */
  routeAirlines?: Record<string, string[]>
  /** Route → airline codes across the whole dataset, regardless of date range. */
  routeAirlinesAll?: Record<string, string[]>
  value: string[]
  onChange: (next: string[]) => void
  favorites: string[]
  onFavoritesChange: (next: string[]) => void
  placeholder?: string
}

export function RouteMultiSelect({
  routes,
  routeAirlines,
  routeAirlinesAll,
  value,
  onChange,
  favorites,
  onFavoritesChange,
  placeholder = "All routes",
}: RouteMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [airlineSearch, setAirlineSearch] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  function toggle(route: string) {
    onChange(value.includes(route) ? value.filter((r) => r !== route) : [...value, route])
  }
  function toggleFav(route: string) {
    onFavoritesChange(
      favorites.includes(route)
        ? favorites.filter((r) => r !== route)
        : [...favorites, route]
    )
  }
  function remove(route: string) {
    onChange(value.filter((r) => r !== route))
  }

  // Normalise: strip spaces and hyphens so "ADL SIN", "ADLSIN", "adl-sin" all match "ADL-SIN"
  const norm = (s: string) => s.replace(/[\s-]/g, "").toLowerCase()
  const q = norm(search)
  // Logos shown per route: what flies in the selected range, else everything the
  // route has ever had — so the logo never disappears when the dates miss.
  const inRange = (r: string) => (routeAirlines?.[r]?.length ?? 0) > 0
  const airlinesFor = (r: string) => (inRange(r) ? routeAirlines![r] : routeAirlinesAll?.[r]) ?? []
  // Airline search matches the code ("AY") or the name ("Finnair").
  const aq = airlineSearch.trim().toLowerCase()
  const matchesAirline = (r: string) =>
    !aq || airlinesFor(r).some((a) => a.toLowerCase().includes(aq) || airlineName(a).toLowerCase().includes(aq))
  const filtered = routes.filter((r) => (!q || norm(r).includes(q)) && matchesAirline(r))
  const favList = filtered.filter((r) => favorites.includes(r))
  const restList = filtered.filter((r) => !favorites.includes(r))

  return (
    <Popover open={open} onOpenChange={(v: boolean) => { setOpen(v); if (!v) { setSearch(""); setAirlineSearch("") } }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          suppressHydrationWarning
          className={cn(
            "flex h-9 items-center gap-2 rounded-md border border-input bg-background px-2.5",
            "min-w-[220px] cursor-pointer text-[13px] hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
            open && "ring-2 ring-ring/30"
          )}
        >
          <div className="flex flex-1 flex-wrap items-center gap-1 overflow-hidden text-left">
            {value.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              <>
                {value.slice(0, 2).map((r) => {
                  const [from, to] = r.split("-")
                  return (
                    <span
                      key={r}
                      className="inline-flex h-[22px] items-center gap-1 rounded-full border bg-muted py-0.5 pl-2 pr-1 text-[11px] font-medium tabular-nums"
                    >
                      {from} → {to}
                      <span
                        role="button"
                        aria-label={`Remove ${r}`}
                        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); remove(r) }}
                        className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
                      >
                        <X className="size-2.5" />
                      </span>
                    </span>
                  )
                })}
                {value.length > 2 && (
                  <span className="text-[11px] text-muted-foreground">+{value.length - 2} more</span>
                )}
              </>
            )}
          </div>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        className="w-[calc(100vw-2rem)] max-h-[calc(var(--radix-popover-content-available-height)-8px)] gap-0 p-0 sm:w-[360px]"
        onOpenAutoFocus={(e: Event) => { e.preventDefault(); setTimeout(() => inputRef.current?.focus(), 0) }}
      >
        {/* Search */}
        <div className="flex items-center gap-2 border-b px-3 py-2 text-muted-foreground">
          <Search className="size-3.5 shrink-0" />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search routes…"
            className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-[13px]"
          />
        </div>
        <div className="flex items-center gap-2 border-b px-3 py-2 text-muted-foreground">
          <Plane className="size-3.5 shrink-0" />
          <input
            value={airlineSearch}
            onChange={(e) => setAirlineSearch(e.target.value)}
            placeholder="Search airlines (AY or Finnair)…"
            aria-label="Search airlines"
            className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-[13px]"
          />
          {airlineSearch && (
            <button
              type="button"
              onClick={() => setAirlineSearch("")}
              aria-label="Clear airline search"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground sm:size-5"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        {/* List */}
        <div className="min-h-0 max-h-[300px] flex-1 overflow-y-auto overscroll-contain py-1">
          {filtered.length === 0 && (
            <div className="py-6 text-center text-[13px] text-muted-foreground">No routes found</div>
          )}
          {favList.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground">Favorites</div>
              {favList.map((r) => (
                <RouteRow key={r} route={r} selected={value.includes(r)} favorite
                  airlines={airlinesFor(r)} unavailable={!inRange(r)}
                  onToggle={() => toggle(r)} onToggleFavorite={() => toggleFav(r)} />
              ))}
            </>
          )}
          {restList.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground">
                {favList.length ? "All routes" : "Select routes"}
              </div>
              {restList.map((r) => (
                <RouteRow key={r} route={r} selected={value.includes(r)} favorite={false}
                  airlines={airlinesFor(r)} unavailable={!inRange(r)}
                  onToggle={() => toggle(r)} onToggleFavorite={() => toggleFav(r)} />
              ))}
            </>
          )}
        </div>

        <div className="border-t px-3 py-2 text-[11px] text-muted-foreground">
          <span className="hidden sm:inline">Tip: right-click a route to star it as favorite.</span>
          <span className="sm:hidden">Tip: tap the star to favorite a route.</span>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function RouteRow({
  route, selected, favorite, airlines, unavailable, onToggle, onToggleFavorite,
}: {
  route: string
  selected: boolean
  favorite: boolean
  airlines?: string[]
  /** No flights for this route in the selected date range. */
  unavailable?: boolean
  onToggle: () => void
  onToggleFavorite: () => void
}) {
  const [from, to] = route.split("-")
  return (
    <div
      role="option"
      aria-selected={selected}
      onContextMenu={(e) => { e.preventDefault(); onToggleFavorite() }}
      className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground sm:py-1.5"
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1 text-left"
      >
        <span
          className={cn(
            "inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm border",
            selected ? "border-primary bg-primary text-primary-foreground" : "border-input"
          )}
        >
          {selected && <Check className="size-2.5" strokeWidth={3} />}
        </span>
        <span className="inline-flex items-center gap-2.5">
          <span className="font-medium tabular-nums">{from}</span>
          <ArrowRight className="size-3 text-muted-foreground" />
          <span className="font-medium tabular-nums">{to}</span>
        </span>
        {airlines && airlines.length > 0 && (
          <span className="inline-flex items-center gap-1">
            {airlines.slice(0, 5).map((a) => (
              <AirlineMark key={a} code={a} size={15} />
            ))}
            {airlines.length > 5 && (
              <span className="text-[10px] text-muted-foreground">+{airlines.length - 5}</span>
            )}
          </span>
        )}
        {unavailable && (
          <span
            className="inline-flex h-4 items-center whitespace-nowrap rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 text-[10px] font-medium leading-none text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300"
            title="No flights for this route in the selected date range"
          >
            Try Different Dates
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
        className={cn(
          "ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent sm:size-6",
          favorite && "text-amber-500"
        )}
        aria-label={favorite ? "Unfavorite route" : "Favorite route"}
      >
        <Star className={cn("size-3.5", favorite && "fill-current")} />
      </button>
    </div>
  )
}

/** Hook to persist favorites in localStorage. */
export function useFavoriteRoutes(key = "ss.favs") {
  const [favs, setFavs] = useState<string[]>([])
  useEffect(() => {
    try { setFavs(JSON.parse(localStorage.getItem(key) || "[]")) } catch {}
  }, [key])
  useEffect(() => { localStorage.setItem(key, JSON.stringify(favs)) }, [favs, key])
  return [favs, setFavs] as const
}

"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowRight, Check, ChevronDown, Star, X } from "lucide-react"
import { Search } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface RouteMultiSelectProps {
  routes: string[]
  value: string[]
  onChange: (next: string[]) => void
  favorites: string[]
  onFavoritesChange: (next: string[]) => void
  placeholder?: string
}

export function RouteMultiSelect({
  routes,
  value,
  onChange,
  favorites,
  onFavoritesChange,
  placeholder = "All routes",
}: RouteMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
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
  const filtered = routes.filter((r) => !q || norm(r).includes(q))
  const favList = filtered.filter((r) => favorites.includes(r))
  const restList = filtered.filter((r) => !favorites.includes(r))

  return (
    <Popover open={open} onOpenChange={(v: boolean) => { setOpen(v); if (!v) setSearch("") }}>
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
        className="w-[320px] p-0"
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
            className="flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* List */}
        <div className="max-h-[300px] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="py-6 text-center text-[13px] text-muted-foreground">No routes found</div>
          )}
          {favList.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground">Favorites</div>
              {favList.map((r) => (
                <RouteRow key={r} route={r} selected={value.includes(r)} favorite
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
                  onToggle={() => toggle(r)} onToggleFavorite={() => toggleFav(r)} />
              ))}
            </>
          )}
        </div>

        <div className="border-t px-3 py-2 text-[11px] text-muted-foreground">
          Tip: right-click a route to star it as favorite.
        </div>
      </PopoverContent>
    </Popover>
  )
}

function RouteRow({
  route, selected, favorite, onToggle, onToggleFavorite,
}: {
  route: string
  selected: boolean
  favorite: boolean
  onToggle: () => void
  onToggleFavorite: () => void
}) {
  const [from, to] = route.split("-")
  return (
    <div
      role="option"
      aria-selected={selected}
      onContextMenu={(e) => { e.preventDefault(); onToggleFavorite() }}
      className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex flex-1 items-center gap-2.5"
      >
        <span
          className={cn(
            "inline-flex size-3.5 shrink-0 items-center justify-center rounded-sm border",
            selected ? "border-primary bg-primary text-primary-foreground" : "border-input"
          )}
        >
          {selected && <Check className="size-2.5" strokeWidth={3} />}
        </span>
        <span className="font-medium tabular-nums">{from}</span>
        <ArrowRight className="size-3 text-muted-foreground" />
        <span className="font-medium tabular-nums">{to}</span>
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
        className={cn(
          "ml-auto inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent",
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

/**
 * Shared query-key and query-string shape for the Pre Departure queue.
 *
 * Deliberately framework-neutral (no `"use client"`, no React) so the server
 * component that prefetches the queue and the client hook that refetches it derive
 * their cache key from the same code. A drift between the two would hydrate into a
 * cache miss and refetch on first paint, defeating the point of the SSR pass.
 */

export type PnrQueueFilters = {
  pnr: string
  brand: string
  admin: string
  statusFilter: string
  ff: string
}

/** The dashboard's initial filter state, and what the server prefetches. */
export const DEFAULT_PNR_QUEUE_FILTERS: PnrQueueFilters = {
  pnr: "",
  brand: "all",
  admin: "all",
  statusFilter: "all",
  ff: "all",
}

/** Query string for `/api/legacy/dashboard` (and for `loadDashboard` directly). */
export function pnrQueueSearch(f: PnrQueueFilters): string {
  const p = new URLSearchParams()
  if (f.pnr.trim()) p.set("pnr", f.pnr.trim())
  if (f.brand !== "all") p.set("brand", f.brand)
  if (f.admin !== "all") p.set("admin", f.admin)
  if (f.statusFilter !== "all") p.set("status", f.statusFilter)
  if (f.ff !== "all") p.set("frequentFlyer", f.ff)
  return p.toString() ? `?${p.toString()}` : ""
}

/** TanStack Query cache key. Must match on both sides of hydration. */
export function pnrQueueQueryKey(f: PnrQueueFilters) {
  return ["pnr-queue", f] as const
}

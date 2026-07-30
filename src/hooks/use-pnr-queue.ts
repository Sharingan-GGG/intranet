"use client"

import { useQuery } from "@tanstack/react-query"

import type { DashboardApiResponse } from "@/lib/pnr-dashboard-data"
import type { DashboardPnrItem } from "@/lib/pnr-types"
import {
  type PnrQueueFilters,
  pnrQueueQueryKey,
  pnrQueueSearch,
} from "@/lib/pnr-queue-query"

export type { PnrQueueFilters }

export function usePnrQueue(filters: PnrQueueFilters) {
  const qs = pnrQueueSearch(filters)
  return useQuery<DashboardPnrItem[], Error>({
    queryKey: pnrQueueQueryKey(filters),
    queryFn: async () => {
      const res = await fetch(`/api/legacy/dashboard${qs}`, {
        cache: "no-store",
      })
      const json = (await res.json()) as DashboardApiResponse
      if (!res.ok || !json.ok)
        throw new Error(json.error ?? "Queue load failed")
      return json.items ?? []
    },
    staleTime: 30 * 1000,
    // Keep previous data only for background refetches (same filters).
    // When any filter key changes, drop the stale data immediately so the
    // skeleton shows instead of a flash of wrong-brand rows.
    placeholderData: (previousData, previousQuery) => {
      const prevFilters = previousQuery?.queryKey[1] as
        | PnrQueueFilters
        | undefined
      if (
        !prevFilters ||
        prevFilters.brand !== filters.brand ||
        prevFilters.pnr !== filters.pnr ||
        prevFilters.admin !== filters.admin ||
        prevFilters.statusFilter !== filters.statusFilter ||
        prevFilters.ff !== filters.ff
      ) {
        return undefined
      }
      return previousData
    },
  })
}

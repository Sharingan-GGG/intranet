"use client"

import { useMutation } from "@tanstack/react-query"

import type { P3ProcessModel } from "@/lib/p3-process-data"

export type SabrePnrFetchResponse = {
  success: boolean
  data: {
    json: Record<string, unknown> | null
    p3: P3ProcessModel | null
    p4: Record<string, unknown> | null
  } | null
  steps: Array<{
    name: string
    status: "pending" | "success" | "error"
    duration_ms?: number
    error?: string
  }>
  error: string | null
}

export type SabrePnrFetchParams = {
  pnr: string
  brand?: string
  includeP3?: boolean
  includeP4?: boolean
}

export function useSabrePnrFetch() {
  return useMutation<SabrePnrFetchResponse, Error, SabrePnrFetchParams>({
    mutationFn: async (params) => {
      const res = await fetch("/api/sabre/pnr-fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      })

      if (!res.ok) {
        const json = (await res
          .json()
          .catch(() => null)) as SabrePnrFetchResponse | null
        throw new Error(json?.error ?? `Sabre fetch failed: ${res.status}`)
      }

      const json = (await res.json()) as SabrePnrFetchResponse
      if (!json.success) {
        throw new Error(json.error ?? "Sabre fetch failed")
      }

      return json
    },
  })
}

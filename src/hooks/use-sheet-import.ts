"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

type SheetImportResponse = {
  success: boolean
  imported: number
  skipped: number
  already_synced?: number
  already_in_queue?: number
  no_flight?: number
  total: number
  pnrs?: string[]
  error?: string
  /** Reconcile pass: sheet rows that were missing from Supabase. */
  recovered_to_db?: number
  /** Reconcile pass: queue rows whose sheet row was gone and was appended back. */
  restored_to_sheet?: number
  /** Reconcile pass: rows whose sheet metadata was copied into the queue. */
  metadata_updated?: number
  sync_errors?: string[]
}

export function useSheetImport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (brand: string): Promise<SheetImportResponse> => {
      const res = await fetch("/api/sheet-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand }),
      })
      const json = (await res.json()) as SheetImportResponse
      if (!res.ok || !json.success)
        throw new Error(json.error ?? `HTTP ${res.status}`)
      return json
    },
    onSuccess: (data, brand) => {
      void queryClient.invalidateQueries({ queryKey: ["pnr-queue"] })

      const descParts: string[] = []
      if (data.already_in_queue && data.already_in_queue > 0)
        descParts.push(`${data.already_in_queue} DUPLICATED`)
      if (data.no_flight && data.no_flight > 0)
        descParts.push(`${data.no_flight} No Flight`)
      if (data.already_synced && data.already_synced > 0)
        descParts.push(`${data.already_synced} already synced`)
      if (data.restored_to_sheet && data.restored_to_sheet > 0)
        descParts.push(`${data.restored_to_sheet} restored to sheet`)
      if (data.metadata_updated && data.metadata_updated > 0)
        descParts.push(`${data.metadata_updated} updated from sheet`)

      if (data.sync_errors && data.sync_errors.length > 0) {
        toast.warning(`${brand} sync finished with warnings`, {
          description: data.sync_errors.join(" · "),
        })
      }

      if (data.imported === 0) {
        toast.info(`No new PNRs to import from ${brand}`, {
          description: descParts.length > 0 ? descParts.join(" · ") : undefined,
        })
      } else {
        toast.success(
          `${data.imported} SYNCED from ${brand}`,
          {
            description: descParts.length > 0 ? descParts.join(" · ") : undefined,
          }
        )
      }
    },
    onError: (err, brand) => {
      toast.error(`Failed to import from ${brand}`, {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    },
  })
}

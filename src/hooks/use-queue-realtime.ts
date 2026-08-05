"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { createClient } from "@/lib/supabase/client"

/** Shape of the `pnr_queue` fields this hook reads off a realtime payload. */
type QueuePayloadRow = { pnr?: string | null }

/**
 * Keep the dashboard in step with `pnr_queue` changes made anywhere — including
 * moves and deletes performed by another user in a shared queue.
 *
 * The queue list is always invalidated. The changed PNR's cached detail is dropped
 * too: a move rewrites the row's brand and owner, and a delete removes it outright,
 * so any detail held for it is stale.
 */
export function useQueueRealtime() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("pnr-queue-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "pre_departure", table: "pnr_queue" },
        (payload) => {
          void queryClient.invalidateQueries({ queryKey: ["pnr-queue"] })

          // DELETE carries the removed row in `old`, and only when the table is set
          // to REPLICA IDENTITY FULL — otherwise it is empty. When the PNR cannot be
          // identified, drop every cached detail rather than serve a stale one.
          const row = (
            payload.eventType === "DELETE" ? payload.old : payload.new
          ) as QueuePayloadRow | null
          const pnr = row?.pnr

          if (pnr) {
            queryClient.removeQueries({ queryKey: ["pnr-detail", pnr] })
          } else if (payload.eventType === "DELETE") {
            queryClient.removeQueries({ queryKey: ["pnr-detail"] })
          }
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])
}

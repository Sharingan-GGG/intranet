"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"

import { shouldSkipP3Fetch } from "@/lib/conditions"
import {
  parsePnrJsonFromSnapshotData,
  ticketsFromStoredP4Soap,
  toP3FetchResult,
  type PnrTicketParseIssue,
} from "@/lib/legacy-parse"
import type { P3FetchResult, PnrJsonData, PnrTicketRow } from "@/lib/pnr-types"

export type PnrSnapshotRaw = {
  source: "supabase"
  brandCode: string | null
  processedAt: string | null
  historyId: number
  pnrJson: unknown
  pnrP3Soap: string | null
  pnrP4Soap: string | null
}

export type PnrDetailResult = {
  pnrData: PnrJsonData | null
  jsonError: string | null
  p3Result: P3FetchResult | null
  p3Skipped: boolean
  tickets: PnrTicketRow[] | null
  ticketParseIssue: PnrTicketParseIssue
  ticketFetchFailed: boolean
  /** Present when Supabase had any snapshot row; includes raw payloads for the Raw tab */
  snapshotRaw: PnrSnapshotRaw | null
}

type SnapshotApiOk = {
  found: boolean
  pnr?: string
  brand_code?: string | null
  history_id?: number
  processed_at?: string | null
  pnr_json?: unknown
  pnr_p3_soap?: string | null
  pnr_p4_soap?: string | null
  /** Present when found === false: whether the PNR is still in pnr_queue. */
  in_queue?: boolean
}

async function fetchSnapshotJson(
  pnr: string,
  brand: string,
  signal: AbortSignal
): Promise<SnapshotApiOk | null> {
  const u = new URL("/api/pnr-snapshot", window.location.origin)
  u.searchParams.set("pnr", pnr)
  const brandParam = brand === "all" ? "" : brand.trim()
  if (brandParam) u.searchParams.set("brand", brandParam)
  const res = await fetch(u.toString(), { signal, cache: "no-store" })
  if (res.status === 401) return null
  if (!res.ok) return null
  return (await res.json()) as SnapshotApiOk
}

function toSnapshot(snap: SnapshotApiOk | null) {
  return snap && snap.found === true && typeof snap.history_id === "number"
    ? snap
    : null
}

/** Live Sabre JSON+SOAP fetch (fetchJsonPnr/fetchSoapP3/fetchSoapP4), persisted server-side into pnr_history/pnr_json/pnr_p3/pnr_ticket. */
async function fetchFromSabre(
  pnr: string,
  brand: string,
  signal: AbortSignal
): Promise<boolean> {
  const brandParam = brand === "all" ? "" : brand.trim()
  const res = await fetch("/api/sabre/pnr-fetch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pnr,
      brand: brandParam || "SABRE",
      includeP3: true,
      includeP4: true,
    }),
    signal,
  })
  if (!res.ok) return false
  const json = (await res.json().catch(() => null)) as { success?: boolean } | null
  return Boolean(json?.success)
}

export async function fetchPnrDetail(
  pnr: string,
  brand: string,
  signal: AbortSignal
): Promise<PnrDetailResult> {
  return fetchPnrDetailWithStep(pnr, brand, signal, () => {})
}

async function fetchPnrDetailWithStep(
  pnr: string,
  brand: string,
  signal: AbortSignal,
  setStep: (s: string) => void
): Promise<PnrDetailResult> {
  setStep("Loading Supabase snapshot…")
  const snapshotRes = await fetchSnapshotJson(pnr, brand, signal)
  let snapshot = toSnapshot(snapshotRes)

  // Only fall back to a live Sabre fetch if the PNR is still queued. If it's
  // gone from pnr_queue (deleted), re-fetching would silently resurrect it.
  const deleted = snapshotRes != null && snapshotRes.found === false && snapshotRes.in_queue === false

  if (!snapshot && !deleted) {
    setStep("Fetching live PNR from Sabre…")
    const fetched = await fetchFromSabre(pnr, brand, signal).catch(() => false)
    if (fetched) {
      setStep("Loading Supabase snapshot…")
      snapshot = toSnapshot(await fetchSnapshotJson(pnr, brand, signal))
    }
  }

  setStep("Parsing PNR data…")
  let snapshotRaw: PnrSnapshotRaw | null = null
  if (snapshot) {
    snapshotRaw = {
      source: "supabase",
      brandCode: snapshot.brand_code ?? null,
      processedAt: snapshot.processed_at ?? null,
      historyId: snapshot.history_id!,
      pnrJson: snapshot.pnr_json ?? null,
      pnrP3Soap:
        typeof snapshot.pnr_p3_soap === "string"
          ? snapshot.pnr_p3_soap
          : null,
      pnrP4Soap:
        typeof snapshot.pnr_p4_soap === "string"
          ? snapshot.pnr_p4_soap
          : null,
    }
  }

  // —— PNR JSON ——
  let pnrData: PnrJsonData | null = null
  let jsonError: string | null = null
  if (snapshot && snapshot.pnr_json != null) {
    pnrData = parsePnrJsonFromSnapshotData(snapshot.pnr_json)
    if (!pnrData) jsonError = "PNR JSON snapshot empty or invalid"
  } else {
    jsonError = deleted
      ? "This PNR was removed from the queue"
      : "No PNR data in Supabase and live Sabre fetch failed"
  }

  // —— Tickets (P4 stored in pnr_ticket) ——
  setStep("Parsing ticket data…")
  const snapP4Soap =
    snapshot && typeof snapshot.pnr_p4_soap === "string"
      ? snapshot.pnr_p4_soap
      : null
  const tLoad = ticketsFromStoredP4Soap(pnr, snapP4Soap)
  const tickets: PnrTicketRow[] | null = tLoad.rows
  const ticketParseIssue: PnrTicketParseIssue = tLoad.issue
  const ticketFetchFailed = tLoad.fetchFailed

  // —— P3 ——
  setStep("Fetching P3 history…")
  const skipP3 = shouldSkipP3Fetch(pnrData)
  let p3Result: P3FetchResult | null = null
  if (
    !skipP3 &&
    snapshot &&
    snapshot.pnr_p3_soap != null &&
    String(snapshot.pnr_p3_soap).trim()
  ) {
    p3Result = toP3FetchResult({
      soap: true,
      body: String(snapshot.pnr_p3_soap),
    })
  }

  setStep("Building model…")
  return {
    pnrData,
    jsonError,
    p3Result,
    p3Skipped: skipP3,
    tickets,
    ticketParseIssue,
    ticketFetchFailed,
    snapshotRaw,
  }
}

export function usePnrDetail(pnr: string | null, brand: string) {
  const [step, setStep] = React.useState("")

  const query = useQuery<PnrDetailResult, Error>({
    queryKey: ["pnr-detail", pnr, brand],
    queryFn: ({ signal }) =>
      fetchPnrDetailWithStep(pnr!, brand, signal, setStep),
    enabled: !!pnr,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })

  return { ...query, step }
}

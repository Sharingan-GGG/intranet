/**
 * Map operational mother total (green vs red) to pnr_queue.workflow buckets after Sabre scan.
 */

import { buildDetailedTabStatuses, shouldSkipP3Fetch } from "@/lib/conditions"
import {
  parsePnrJsonFromSnapshotData,
  ticketsFromStoredP4Soap,
  toP3FetchResult,
} from "@/lib/legacy-parse"
import { getP3SsrCodesForMessagesFromResult } from "@/lib/p3-process-data"
import {
  rawTicketsLackServiceCoupons,
  runPnrVsTicketsPipeline,
} from "@/lib/pnr-tickets-pipeline"
import type { PnrQueueWorkflowStatus } from "@/lib/supabase/pnr-queue-metadata"

export function deriveQueueWorkflowStatusFromScan(args: {
  pnr: string
  jsonData: Record<string, unknown>
  p3Xml: string | null
  p4Xml: string | null
}): PnrQueueWorkflowStatus {
  const pnrData = parsePnrJsonFromSnapshotData(args.jsonData)
  if (!pnrData) return "exception"

  const p3Skipped = shouldSkipP3Fetch(pnrData)
  let p3Result = null
  if (!p3Skipped) {
    if (args.p3Xml?.trim()) {
      p3Result = toP3FetchResult({ soap: true, body: args.p3Xml })
    } else {
      p3Result = { error: "missing P3 XML" }
    }
  }

  let tickets = null
  let ticketFetchFailed = false
  if (args.p4Xml?.trim()) {
    const t = ticketsFromStoredP4Soap(args.pnr, args.p4Xml)
    tickets = t.rows
    ticketFetchFailed = t.fetchFailed
  }

  const ticketParserUnavailable =
    ticketFetchFailed ||
    (!!tickets?.length && rawTicketsLackServiceCoupons(tickets))
  const pipeline =
    !ticketParserUnavailable && tickets?.length
      ? runPnrVsTicketsPipeline(pnrData, tickets)
      : null
  const p3Ssr = p3Skipped
    ? null
    : getP3SsrCodesForMessagesFromResult(p3Result)

  const tabs = buildDetailedTabStatuses(
    pnrData,
    p3Skipped,
    p3Result,
    tickets,
    ticketParserUnavailable,
    p3Ssr,
    pipeline
  )

  return tabs.total === "exception" ? "exception" : "pending"
}

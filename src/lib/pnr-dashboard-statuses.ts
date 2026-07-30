/**
 * Mother tab dots for queue rows — same rules as PnrWorkDashboard detail memo.
 * Used after Scan PNR only (not on row select).
 */

import { buildDetailedTabStatuses } from "@/lib/conditions"
import { getP3SsrCodesForMessagesFromResult } from "@/lib/p3-process-data"
import {
  rawTicketsLackServiceCoupons,
  runPnrVsTicketsPipeline,
} from "@/lib/pnr-tickets-pipeline"
import type {
  DashboardPnrItem,
  P3FetchResult,
  PnrJsonData,
  PnrTicketRow,
} from "@/lib/pnr-types"
export type DetailLikeForStatuses = {
  pnrData: PnrJsonData | null
  p3Result: P3FetchResult | null
  p3Skipped: boolean
  tickets: PnrTicketRow[] | null
  ticketFetchFailed: boolean
}

export function dashboardStatusesFromDetailLike(
  d: DetailLikeForStatuses
): DashboardPnrItem["statuses"] | null {
  const { pnrData, p3Skipped, p3Result, tickets, ticketFetchFailed } = d
  if (!pnrData) return null
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
  return buildDetailedTabStatuses(
    pnrData,
    p3Skipped,
    p3Result,
    tickets,
    ticketParserUnavailable,
    p3Ssr,
    pipeline
  )
}

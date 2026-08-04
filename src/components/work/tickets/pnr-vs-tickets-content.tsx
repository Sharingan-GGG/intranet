"use client"

import * as React from "react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ticketBlockHasUnmatch,
  type TicketComparisonRow,
  type TicketRow,
} from "@/lib/ticket-mother"
import type { PnrTicketParseIssue } from "@/lib/legacy-parse"
import type { PnrJsonData } from "@/lib/pnr-types"
import { formatAdlDate } from "@/lib/datetime-adl"
import { cn } from "@/lib/utils"

function formatCell(v: unknown): string {
  if (v == null) return "—"
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean")
    return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function statusFromRow(c: TicketComparisonRow): string {
  if (typeof c.matchDisplay === "string" && c.matchDisplay.trim())
    return c.matchDisplay
  return c.match ? "Match" : "UNMATCH"
}

function couponRowsHaveUnmatch(rows: TicketComparisonRow[]): boolean {
  return rows.some((r) => !r.match)
}

function formatRelatedOrOriginalRef(doc: unknown): string {
  if (doc == null) return "/"
  if (typeof doc === "string") {
    const s = doc.trim()
    return s || "/"
  }
  if (typeof doc === "object" && !Array.isArray(doc)) {
    const o = doc as Record<string, unknown>
    if (Object.keys(o).length === 0) return "/"
    const n = o.number ?? o.Number ?? o.ticketNumber
    if (n != null && String(n).trim() !== "") return String(n).trim()
    return "/"
  }
  const s = String(doc).trim()
  return s || "/"
}

function fieldOrDash(v: unknown): string {
  if (v == null) return "—"
  const s = String(v).trim()
  return s || "—"
}

function issueDateFromTicket(ticket: TicketRow): string {
  const dt = ticket?.details?.LocalIssueDateTime
  if (dt == null) return "—"
  const s = String(dt).trim()
  if (!s) return "—"
  const parseable = /T\d/.test(s) ? s : `${s}T12:00:00Z`
  return formatAdlDate(parseable)
}

function TicketComparisonHeader({ ticket }: { ticket: TicketRow }) {
  const tNum = String(ticket?.TicketNumber ?? ticket?.Ticket?.Number ?? "—")
  const hasUnmatch = ticketBlockHasUnmatch(ticket)
  const pax = String(ticket?.passengerName || "").trim() || "—"
  return (
    <div className="comparison-header flex w-full max-w-full min-w-0 justify-between gap-0 text-left align-middle">
      <p className="my-0.5 text-xs leading-tight text-foreground">
        <span
          className={
            hasUnmatch
              ? "text-destructive"
              : "text-emerald-600 dark:text-emerald-400"
          }
          aria-hidden
        >
          ●
        </span>{" "}
        {pax}
      </p>
      <p className="my-0.5 text-xs font-semibold text-foreground">
        Ticket: {tNum}
      </p>
      <p className="my-0.5 text-xs text-muted-foreground">
        Related: {formatRelatedOrOriginalRef(ticket?.Conjunctive)}
      </p>
      <p className="my-0.5 text-xs text-muted-foreground">
        Original: {formatRelatedOrOriginalRef(ticket?.Original)}
      </p>
      <p className="my-0.5 text-xs text-muted-foreground">
        Issue Date: {issueDateFromTicket(ticket)}
      </p>
      <p className="my-0.5 text-xs text-muted-foreground">
        Status Code: {fieldOrDash(ticket?.ticketStatusCode)}
      </p>
      <p className="my-0.5 text-xs text-muted-foreground">
        Ticket Status: {fieldOrDash(ticket?.ticketStatusName)}
      </p>
      <p className="my-0.5 text-xs text-muted-foreground">
        PCC: {fieldOrDash(ticket?.ticketingPcc)}
      </p>
      <p className="my-0.5 text-xs text-foreground">
        Status: {hasUnmatch ? "UNMATCH" : "Match"}
      </p>
    </div>
  )
}

function messageForTicketIssue(
  issue: PnrTicketParseIssue | null | undefined
): string | null {
  if (issue == null) return null
  switch (issue) {
    case "not_non_empty_tickets":
      return "Response had no `tickets` array (or it was empty). Check fetchDatabase PNR_TICKET for this PNR."
    case "row_missing_ticket_or_soap":
      return "Each PNR_TICKET row must have non-empty `ticket` and `soap`."
    case "all_soap_parsed_empty":
      return "SOAP did not yield any <Ticket> blocks. Check the stored SOAP payload."
    case "no_service_coupons_after_parse":
      return "Ticket XML parsed, but there are no <ServiceCoupons> (SOAP / data content issue, not the wrong table)."
    case "load_failed":
      return "Could not load or parse the PNR_TICKET JSON payload from legacy."
    default:
      return null
  }
}

type Props = {
  booking: PnrJsonData | null
  /** After runPnrVsTicketsPipeline + getSortedTicketsForCompareUi only — has coupon.comparisons */
  comparedTickets: TicketRow[]
  ticketParserUnavailable: boolean
  ticketFetchFailed: boolean
  /** From parsePnrTicketDatabaseResponse (validation + parseTicketSoap) */
  ticketParseIssue?: PnrTicketParseIssue | null
}

export function PnrVsTicketsContent({
  booking,
  comparedTickets,
  ticketParserUnavailable,
  ticketFetchFailed,
  ticketParseIssue = null,
}: Props) {
  if (ticketFetchFailed) {
    return (
      <p className="text-destructive">
        PNR_TICKET request failed (legacy) or error payload from fetchDatabase.
      </p>
    )
  }
  if (!booking) {
    return (
      <p className="text-muted-foreground">Load PNR JSON to compare tickets.</p>
    )
  }
  const issueText = messageForTicketIssue(ticketParseIssue)
  if (ticketParserUnavailable) {
    return (
      <p className="text-destructive">
        {issueText ??
          "Ticket data is not available for PNR vs tickets (no ServiceCoupons or no rows after parse)."}
      </p>
    )
  }
  if (comparedTickets.length === 0) {
    return <p className="text-muted-foreground">No tickets for this PNR.</p>
  }

  return (
    <Accordion type="multiple" className="w-full space-y-2">
      {comparedTickets.map((ticket, tIdx) => {
        const tNum = String(
          ticket?.TicketNumber ?? ticket?.Ticket?.Number ?? tIdx
        )
        const coupons = (
          Array.isArray(ticket?.ServiceCoupons) ? ticket.ServiceCoupons : []
        ) as Array<{
          coupon?: string | number
          comparisons?: TicketComparisonRow[]
        }>
        return (
          <AccordionItem
            key={`${tNum}-${tIdx}`}
            value={`ticket-${tIdx}`}
            className="comparison w-full max-w-full min-w-0 rounded-md border border-border bg-card"
          >
            <AccordionTrigger className="static w-full max-w-full min-w-0 items-center justify-center px-3 py-2 text-left align-middle text-sm font-normal hover:no-underline">
              <TicketComparisonHeader ticket={ticket} />
            </AccordionTrigger>
            <AccordionContent className="px-2 pb-2">
              {coupons.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No coupons for this ticket.
                </p>
              ) : (
                <Accordion type="multiple" className="w-full">
                  {coupons.map((coupon, cIdx) => {
                    const cid = String(coupon?.coupon ?? cIdx)
                    const rows = Array.isArray(coupon.comparisons)
                      ? coupon.comparisons
                      : []
                    return (
                      <AccordionItem
                        key={`c-${tIdx}-${cIdx}`}
                        value={`coupon-${tIdx}-${cIdx}`}
                        className="record mt-1 rounded border border-border/80"
                      >
                        <AccordionTrigger
                          className={cn(
                            "rounded-none px-2 py-1.5 text-xs hover:no-underline",
                            couponRowsHaveUnmatch(rows) &&
                              "bg-destructive/10 hover:bg-destructive/15 dark:bg-destructive/20 dark:hover:bg-destructive/25"
                          )}
                        >
                          Coupon {cid}
                        </AccordionTrigger>
                        <AccordionContent className="px-0 pb-1">
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[9rem]">
                                    DETAILS
                                  </TableHead>
                                  <TableHead>PNR</TableHead>
                                  <TableHead>TICKETS</TableHead>
                                  <TableHead className="w-[7rem]">
                                    STATUS
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {rows.length === 0 ? (
                                  <TableRow>
                                    <TableCell
                                      colSpan={4}
                                      className="text-muted-foreground"
                                    >
                                      No comparison rows (run compare on full
                                      ticket set).
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  rows.map((row, rIdx) => (
                                    <TableRow key={rIdx}>
                                      <TableCell className="align-top font-mono text-xs">
                                        {row.field}
                                      </TableCell>
                                      <TableCell className="max-w-[14rem] text-xs break-words">
                                        {formatCell(row.leftValue)}
                                      </TableCell>
                                      <TableCell className="max-w-[14rem] text-xs break-words">
                                        {formatCell(row.rightValue)}
                                      </TableCell>
                                      <TableCell
                                        className={cn(
                                          "text-xs whitespace-nowrap",
                                          row.match
                                            ? "text-emerald-700 dark:text-emerald-300"
                                            : "text-destructive"
                                        )}
                                      >
                                        {statusFromRow(row)}
                                      </TableCell>
                                    </TableRow>
                                  ))
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )
                  })}
                </Accordion>
              )}
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}

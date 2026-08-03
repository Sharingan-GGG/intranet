"use client"

import * as React from "react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { P3DetailsContent } from "@/components/work/p3/p3-details-content"
import { MessagesTabContent } from "@/components/work/messages/messages-tab-content"
import { PnrVsTicketsContent } from "@/components/work/tickets/pnr-vs-tickets-content"
import { PnrNotesTab } from "@/components/work/pnr-notes-tab"
import { PnrReportItTab } from "@/components/work/pnr-report-it-tab"
import type { OperationStatus } from "@/components/ui/operation-modal"
import {
  buildDetailedTabStatuses,
  shouldSkipP3Fetch,
  tabStatusDotClass,
} from "@/lib/conditions"
import {
  formatAirlineNumber,
  formatCabinTypeAndCode,
  formatFlightLineDisplay,
  formatScheduleCell,
  getReceiverInfoForAirline,
  getRowsToRenderForPassenger,
  getTravelerLoyaltyAccordionFields,
  hasTourSegmentForTcBookingFromBookingJson,
  passengerHasException,
  passengerHasTdException,
  paxLabel,
  tdRowHasException,
  type BookingJson,
  type FlightSegment,
  type SegmentRow,
} from "@/lib/flight-details"
import {
  getP3SsrCodesForMessagesFromResult,
  tryP3ModelFromFetchResult,
} from "@/lib/p3-process-data"
import {
  getSortedTicketsForCompareUi,
  rawTicketsLackServiceCoupons,
  runPnrVsTicketsPipeline,
} from "@/lib/pnr-tickets-pipeline"
import type {
  MotherTabKey,
  P3FetchResult,
  PnrJsonData,
  PnrTicketRow,
  TabStatus,
} from "@/lib/pnr-types"
import { cn } from "@/lib/utils"
import type { PnrTicketParseIssue } from "@/lib/legacy-parse"
import type { PnrSnapshotRaw } from "@/hooks/use-pnr-detail"

function TabStatusDot({ status }: { status: TabStatus }) {
  return (
    <span className={cn(tabStatusDotClass(status), "inline-block shrink-0")} />
  )
}

function DetailSkeleton() {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-busy="true"
      aria-label="Loading PNR details"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="no-scrollbar flex w-full min-w-0 flex-wrap gap-0.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-[6.5rem] rounded-md sm:w-28" />
        ))}
      </div>
      <div className="min-h-[6rem] space-y-2 pt-1">
        <Skeleton className="h-3 max-w-2xl" />
        <Skeleton className="h-3 max-w-xl" />
        <Skeleton className="h-3 w-2/3 max-w-md" />
      </div>
    </div>
  )
}

function StickyDetailHeader({
  pnr,
  tabStatuses,
  pnrData,
}: {
  pnr: string
  tabStatuses: Record<MotherTabKey, TabStatus>
  pnrData: PnrJsonData | null
}) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border bg-card px-3 py-2 text-xs">
      <span className="font-semibold tracking-wider text-foreground">
        {pnr}
      </span>
      {pnrData?.travelers && pnrData.travelers.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {pnrData.travelers.map((p, idx) => (
            <span key={p.id ?? idx} className="rounded bg-muted px-2 py-1 font-medium text-foreground">
              {paxLabel(p, idx)}
            </span>
          ))}
        </div>
      )}
      {pnrData &&
      hasTourSegmentForTcBookingFromBookingJson(pnrData as BookingJson) ? (
        <span className="rounded bg-red-500/15 px-1.5 py-0.5 font-bold uppercase text-red-700 dark:text-red-400">
          GK Detected
        </span>
      ) : null}
      {pnrData && tabStatuses.ticket === "exception" ? (
        <span className="rounded bg-destructive/15 px-1.5 py-0.5 font-bold uppercase text-destructive">
          Ticket mismatch
        </span>
      ) : null}
      <div className="ms-auto flex items-center gap-2">
        {(["flight", "p3", "ticket", "messages"] as const).map((key) => (
          <span
            key={key}
            className="flex items-center gap-1 font-bold uppercase text-muted-foreground"
          >
            <TabStatusDot status={tabStatuses[key]} />
            {key === "flight"
              ? "FLT"
              : key === "messages"
                ? "MSG"
                : key.toUpperCase()}
          </span>
        ))}
        <span className="ms-1 flex items-center gap-1 font-bold uppercase">
          <TabStatusDot status={tabStatuses.total} />
          {tabStatuses.total === "exception" ? (
            <span className="text-destructive">Exception</span>
          ) : tabStatuses.total === "warning" ? (
            <span className="text-amber-600 dark:text-amber-400">Warning</span>
          ) : (
            <span className="text-blue-600 dark:text-blue-400">Pending</span>
          )}
        </span>
      </div>
    </div>
  )
}

function EmptyTabState({ message }: { message: string }) {
  return (
    <div className="flex h-24 items-center justify-center rounded-md border border-dashed">
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  )
}

type Props = {
  selectedPnr: string | null
  client?: string
  brand?: string
  role?: string
  pnrData: PnrJsonData | null
  p3Result: P3FetchResult | null
  p3Skipped: boolean
  tickets: PnrTicketRow[] | null
  ticketParseIssue: PnrTicketParseIssue
  ticketFetchFailed: boolean
  jsonError: string | null
  snapshotRaw: PnrSnapshotRaw | null
  isLoading: boolean
  detailTab: string
  onDetailTabChange: (tab: string) => void
  onShowModal?: (
    operation: string,
    status: OperationStatus,
    currentStep?: string,
    error?: string,
    onRetry?: () => void
  ) => void
  onCloseModal?: () => void
}

export function PnrDetailPanel({
  selectedPnr,
  client,
  brand,
  role,
  pnrData,
  p3Result,
  p3Skipped,
  tickets,
  ticketParseIssue,
  ticketFetchFailed,
  jsonError,
  snapshotRaw,
  isLoading,
  detailTab,
  onDetailTabChange,
  onShowModal,
  onCloseModal,
}: Props) {
  const ticketParserUnavailable = React.useMemo(() => {
    if (ticketFetchFailed) return true
    if (tickets && tickets.length > 0)
      return rawTicketsLackServiceCoupons(tickets)
    return false
  }, [tickets, ticketFetchFailed])

  const ticketPipeline = React.useMemo(() => {
    if (!pnrData || !tickets?.length) return null
    if (rawTicketsLackServiceCoupons(tickets)) return null
    return runPnrVsTicketsPipeline(pnrData, tickets)
  }, [pnrData, tickets])

  const comparedTicketsForUi = React.useMemo(
    () =>
      ticketPipeline
        ? getSortedTicketsForCompareUi(ticketPipeline.comparedTickets)
        : [],
    [ticketPipeline]
  )

  // Global 1-based row line index — matches P3's flightLineLabel numbering, so
  // "#1", "#2"… keep counting across the whole PNR instead of resetting per
  // passenger. Every row in allSegments consumes a number, including ARNK and
  // any segment that can't be resolved to a flight — nothing is skipped, so
  // the sequence never breaks even though only flight rows show a line number.
  const flightGlobalLineIndex = React.useMemo(() => {
    const map = new Map<FlightSegment | SegmentRow, number>()
    if (!pnrData) return map
    const flights = pnrData.flights ?? []
    const byItemId = new Map<string, FlightSegment>()
    flights.forEach((f) => {
      if (f.itemId != null && String(f.itemId) !== "") {
        byItemId.set(String(f.itemId), f)
      }
    })
    let n = 0
    for (const seg of pnrData.allSegments ?? []) {
      if (!seg) continue
      n += 1
      const segType = String(seg.type || "").toUpperCase()
      if (segType !== "FLIGHT") {
        map.set(seg, n)
        continue
      }
      const id = seg.id != null ? String(seg.id) : ""
      const flight = id ? byItemId.get(id) : undefined
      if (flight) map.set(flight, n)
    }
    // Any flight not resolvable via allSegments (missing/blank segment link)
    // still gets numbered, continuing the same running count.
    flights.forEach((f) => {
      if (!map.has(f)) {
        n += 1
        map.set(f, n)
      }
    })
    return map
  }, [pnrData])

  const p3SsrCodes = React.useMemo(
    () => (p3Skipped ? null : getP3SsrCodesForMessagesFromResult(p3Result)),
    [p3Skipped, p3Result]
  )

  const p3A3sForMessages = React.useMemo(() => {
    if (p3Skipped || !p3Result || !pnrData) return null
    const r = tryP3ModelFromFetchResult(p3Result, pnrData)
    return r.ok ? r.model.travelInfo : null
  }, [p3Skipped, p3Result, pnrData])

  const tabStatuses = React.useMemo(
    () =>
      buildDetailedTabStatuses(
        pnrData,
        p3Skipped,
        p3Result,
        tickets,
        ticketParserUnavailable,
        p3SsrCodes,
        ticketPipeline
      ),
    [
      pnrData,
      p3Skipped,
      p3Result,
      tickets,
      ticketParserUnavailable,
      p3SsrCodes,
      ticketPipeline,
    ]
  )

  if (isLoading) return <DetailSkeleton />

  return (
    <>
      {jsonError && selectedPnr ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {jsonError}
        </p>
      ) : null}

      {selectedPnr && pnrData && (
        <StickyDetailHeader
          pnr={selectedPnr}
          tabStatuses={tabStatuses}
          pnrData={pnrData}
        />
      )}

      <Tabs
        value={detailTab}
        onValueChange={onDetailTabChange}
        className="w-full"
      >
        <TabsList className="detail-tabs-list no-scrollbar h-auto w-full min-w-0 flex-wrap justify-start gap-0.5">
          <TabsTrigger value="flights" className="flight-details gap-1.5 text-xs">
            {pnrData ? (
              <TabStatusDot status={tabStatuses.flight} />
            ) : (
              <span className="size-2 rounded-full bg-muted" />
            )}
            Flights Details
          </TabsTrigger>
          <TabsTrigger value="p3" className="p3-details gap-1.5 text-xs">
            {pnrData ? (
              <TabStatusDot status={tabStatuses.p3} />
            ) : (
              <span className="size-2 rounded-full bg-muted" />
            )}
            P3 Details
          </TabsTrigger>
          <TabsTrigger value="tickets" className="pnr-vs-tickets gap-1.5 text-xs">
            {pnrData ? (
              <TabStatusDot status={tabStatuses.ticket} />
            ) : (
              <span className="size-2 rounded-full bg-muted" />
            )}
            PNR VS TICKETS
          </TabsTrigger>
          <TabsTrigger value="messages" className="messages-tab gap-1.5 text-xs">
            {pnrData ? (
              <TabStatusDot status={tabStatuses.messages} />
            ) : (
              <span className="size-2 rounded-full bg-muted" />
            )}
            Messages
          </TabsTrigger>
          <TabsTrigger value="notes" className="notes-tab gap-1.5 text-xs">
            <span className="size-2 shrink-0 rounded-full bg-muted" /> Notes
          </TabsTrigger>
          <TabsTrigger value="report" className="report-it-tab gap-1.5 text-xs">
            <span className="size-2 shrink-0 rounded-full bg-muted" /> Report IT
          </TabsTrigger>
          {role === "super_admin" && (
            <TabsTrigger value="raw" className="raw-payloads-tab gap-1.5 text-xs">
              <span className="size-2 rounded-full bg-muted" />
              JSON · P3 · P4
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="flights" className="flight-details-content pt-2">
          {!pnrData ? (
            <EmptyTabState
              message={
                selectedPnr
                  ? "No PNR JSON loaded for this booking."
                  : "Select a PNR above."
              }
            />
          ) : !pnrData.travelers?.length ? (
            <p className="text-sm text-destructive">No Traveler Found</p>
          ) : (
            <Accordion type="multiple" className="w-full flex-col gap-[10px]">
              {pnrData.travelers.map((p, idx) => {
                const booking = pnrData as BookingJson
                const orderedRows = getRowsToRenderForPassenger(booking, idx)
                const loyalty = p.loyaltyPrograms ?? []
                const {
                  sc: scLabel,
                  pt: ptLabel,
                  scAndNum,
                } = getTravelerLoyaltyAccordionFields(p)
                const paxFlightStatus: TabStatus =
                  hasTourSegmentForTcBookingFromBookingJson(booking) ||
                  passengerHasException(booking, idx) ||
                  passengerHasTdException(booking, idx)
                    ? "exception"
                    : "pending"

                return (
                  <AccordionItem
                    key={p.id ?? String(idx)}
                    value={`pax-${idx}`}
                    className="not-last:border-b-0"
                  >
                    <AccordionTrigger>
                      <div className="accordion-trigger-block">
                        <div className="accordion-trigger-details">
                          <div className="accordion-header-left">
                            <span className="inline-flex items-center gap-1.5">
                              <TabStatusDot status={paxFlightStatus} />
                              <strong>PAX</strong> {idx + 1}.1
                            </span>
                            <span>{paxLabel(p, idx)}</span>
                            <span>{p.type?.trim() || "ADULT"}</span>
                            <span>SC: {scLabel}</span>
                            <span>
                              PT:{" "}
                              {ptLabel === "—" ||
                              ptLabel === "No loyalty program"
                                ? ptLabel
                                : ptLabel.toUpperCase()}
                            </span>
                            <span>SC and #: {scAndNum}</span>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div
                        className={cn(
                          "rounded-[8px] border text-xs",
                          pnrData.flights?.length
                            ? "border-border bg-card"
                            : "border-amber-500/30 bg-amber-500/5"
                        )}
                      >
                        <ScrollArea className="max-h-[min(32rem,60vh)] w-full">
                          <div className="min-w-max">
                            <Table>
                              <TableCaption className="sr-only">
                                Flight and ARNK rows for {paxLabel(p, idx)}
                              </TableCaption>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="table-bottom-border whitespace-nowrap">
                                    Flights # & Conf ID
                                  </TableHead>
                                  <TableHead className="table-bottom-border whitespace-nowrap">
                                    Airline Number
                                  </TableHead>
                                  <TableHead className="table-bottom-border whitespace-nowrap">
                                    RC | FF Number
                                  </TableHead>
                                  <TableHead className="table-bottom-border whitespace-nowrap">
                                    Origin
                                  </TableHead>
                                  <TableHead className="table-bottom-border whitespace-nowrap">
                                    Destination
                                  </TableHead>
                                  <TableHead className="table-bottom-border whitespace-nowrap">
                                    Departure
                                  </TableHead>
                                  <TableHead className="table-bottom-border whitespace-nowrap">
                                    Arrival
                                  </TableHead>
                                  <TableHead className="table-bottom-border whitespace-nowrap">
                                    Status
                                  </TableHead>
                                  <TableHead className="table-bottom-border whitespace-nowrap">
                                    Cabin Type & Code
                                  </TableHead>
                                  <TableHead className="table-bottom-border whitespace-nowrap">
                                    Seat
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {!pnrData.flights?.length ? (
                                  <TableRow>
                                    <TableCell
                                      colSpan={10}
                                      className="text-muted-foreground"
                                    >
                                      No Flight Found
                                    </TableCell>
                                  </TableRow>
                                ) : orderedRows.length === 0 ? (
                                  <TableRow>
                                    <TableCell
                                      colSpan={10}
                                      className="text-muted-foreground"
                                    >
                                      No flight segments for this passenger
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  orderedRows.map((row, ri) => {
                                    if (row.kind === "arnk") {
                                      const txt =
                                        row.segment.text != null &&
                                        String(row.segment.text).trim() !== ""
                                          ? String(row.segment.text)
                                          : ""
                                      const arnkLine =
                                        flightGlobalLineIndex.get(row.segment)
                                      return (
                                        <TableRow
                                          key={`arnk-${ri}`}
                                          className="bg-muted/30"
                                        >
                                          <TableCell
                                            colSpan={10}
                                            className="text-muted-foreground"
                                          >
                                            {arnkLine != null
                                              ? `#${arnkLine} `
                                              : ""}
                                            <span className="font-medium">
                                              ARNK
                                            </span>
                                            {txt ? ` — ${txt}` : ""}
                                          </TableCell>
                                        </TableRow>
                                      )
                                    }
                                    const f = row.flight
                                    const from =
                                      f.fromAirportCode || f.origin || "—"
                                    const to =
                                      f.toAirportCode || f.destination || "—"
                                    const rc = getReceiverInfoForAirline(
                                      loyalty,
                                      f.airlineCode || ""
                                    )
                                    const recDisplay = rc.display
                                    const recWarn =
                                      loyalty.length > 0 && recDisplay === "N/A"
                                        ? "receiver"
                                        : rc.matchCount > 1
                                          ? "multi"
                                          : null
                                    const bad = tdRowHasException(
                                      f,
                                      booking,
                                      idx
                                    )
                                    const fsc =
                                      (
                                        f.flightStatusCode || ""
                                      ).toUpperCase() || "—"
                                    const seatAt = f.seats?.[idx]
                                    const seatFb = (f.seats || []).find(
                                      (s) => s && s.statusCode != null
                                    )
                                    const st =
                                      seatAt && seatAt.statusCode != null
                                        ? seatAt
                                        : seatFb
                                    const ssc =
                                      (st?.statusCode || "").toUpperCase() ||
                                      "—"
                                    const num =
                                      st?.number != null &&
                                      String(st.number).trim() !== ""
                                        ? st.number
                                        : null
                                    const flightLine1Based =
                                      flightGlobalLineIndex.get(f) ??
                                      orderedRows
                                        .slice(0, ri + 1)
                                        .filter((r) => r.kind === "flight")
                                        .length

                                    return (
                                      <TableRow
                                        key={`fl-${f.itemId ?? f.confirmationId ?? ri}`}
                                        className={cn(
                                          bad && "bg-destructive/10"
                                        )}
                                      >
                                        <TableCell className="whitespace-nowrap">
                                          {formatFlightLineDisplay(
                                            f,
                                            flightLine1Based
                                          )}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                          {formatAirlineNumber(f)}
                                        </TableCell>
                                        <TableCell
                                          className={cn(
                                            "max-w-[14rem] truncate",
                                            recWarn === "receiver" &&
                                              "text-destructive",
                                            recWarn === "multi" &&
                                              "text-amber-700 dark:text-amber-200"
                                          )}
                                          title={recDisplay}
                                        >
                                          {recDisplay}
                                          {recWarn === "multi" ? " (×)" : null}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                          {from}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                          {to}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                          {formatScheduleCell(
                                            f.departureDate,
                                            f.departureTime
                                          )}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                          {formatScheduleCell(
                                            f.arrivalDate,
                                            f.arrivalTime
                                          )}
                                        </TableCell>
                                        <TableCell
                                          className={cn(
                                            "whitespace-nowrap",
                                            fsc &&
                                              fsc !== "—" &&
                                              fsc !== "HK" &&
                                              fsc !== "KK" &&
                                              "text-destructive"
                                          )}
                                        >
                                          {fsc}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                          {formatCabinTypeAndCode(f)}
                                        </TableCell>
                                        <TableCell
                                          className={cn(
                                            "whitespace-nowrap",
                                            ssc &&
                                              ssc !== "—" &&
                                              ssc !== "HK" &&
                                              ssc !== "KK" &&
                                              "text-destructive"
                                          )}
                                        >
                                          {num != null && num !== "" ? (
                                            <span>
                                              {num}{" "}
                                              <span className="text-muted-foreground">
                                                ({ssc})
                                              </span>
                                            </span>
                                          ) : ssc && ssc !== "—" ? (
                                            ssc
                                          ) : (
                                            <span className="text-[#FF6467]">
                                              N/A
                                            </span>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    )
                                  })
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </ScrollArea>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          )}
        </TabsContent>

        <TabsContent
          value="p3"
          className="p3-details-content min-w-0 pt-2 text-sm text-muted-foreground"
        >
          {!selectedPnr ? (
            <EmptyTabState message="Select a PNR to view P3 details." />
          ) : p3Skipped ? (
            <p>
              Skipped: no <code className="text-xs">confirmationId</code> in PNR
              request.
            </p>
          ) : (
            <P3DetailsContent p3Result={p3Result} booking={pnrData} />
          )}
        </TabsContent>

        <TabsContent
          value="tickets"
          className="pnr-vs-tickets-content pt-2 text-sm text-muted-foreground"
        >
          {!selectedPnr ? (
            <EmptyTabState message="Select a PNR to view ticket comparison." />
          ) : (
            <PnrVsTicketsContent
              booking={pnrData}
              comparedTickets={comparedTicketsForUi}
              ticketParserUnavailable={ticketParserUnavailable}
              ticketFetchFailed={ticketFetchFailed}
              ticketParseIssue={ticketParseIssue}
            />
          )}
        </TabsContent>

        <TabsContent
          value="messages"
          className="messages-tab-content pt-2 text-sm text-muted-foreground"
        >
          {!selectedPnr ? (
            <EmptyTabState message="Select a PNR to view messages." />
          ) : pnrData ? (
            <MessagesTabContent
              pnrData={pnrData}
              p3A3sSample={p3A3sForMessages}
            />
          ) : (
            <p>Load a PNR with JSON to see messages.</p>
          )}
        </TabsContent>

        <TabsContent value="notes" className="notes-tab-content pt-2">
          {!selectedPnr ? (
            <EmptyTabState message="Select a PNR to view notes." />
          ) : (
            <PnrNotesTab
              pnr={selectedPnr}
              onShowModal={onShowModal}
              onCloseModal={onCloseModal}
            />
          )}
        </TabsContent>

        <TabsContent value="report" className="report-it-content pt-2">
          {!selectedPnr ? (
            <EmptyTabState message="Select a PNR to report an IT issue." />
          ) : (
            <PnrReportItTab
              pnr={selectedPnr}
              brand={brand}
              onShowModal={onShowModal}
              onCloseModal={onCloseModal}
            />
          )}
        </TabsContent>

        {role === "super_admin" && <TabsContent value="raw" className="raw-payloads-content min-w-0 pt-2">
          {!selectedPnr ? (
            <EmptyTabState message="Select a PNR to view stored payloads." />
          ) : !snapshotRaw ? (
            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                No Supabase snapshot row for this PNR yet. Run{" "}
                <strong>Scan PNR</strong> or a queue scan to persist{" "}
                <code className="text-[10px]">pnr_json</code>,{" "}
                <code className="text-[10px]">pnr_p3</code>, and{" "}
                <code className="text-[10px]">pnr_ticket</code> (P4 SOAP).
              </p>
              <p>
                The other tabs still combine legacy MySQL data with any snapshot
                when present.
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                {snapshotRaw.brandCode ? (
                  <span>
                    Brand <span className="font-medium">{snapshotRaw.brandCode}</span>
                  </span>
                ) : null}
                {snapshotRaw.processedAt ? (
                  <span>Snapshot {snapshotRaw.processedAt}</span>
                ) : null}
                <span className="font-mono">history #{snapshotRaw.historyId}</span>
              </div>

              <Tabs defaultValue="json" className="raw-payload-tabs w-full">
                <TabsList className="h-auto">
                  <TabsTrigger value="json" className="raw-json-tab text-xs">
                    JSON
                  </TabsTrigger>
                  <TabsTrigger value="p3" className="raw-p3-tab text-xs">
                    P3
                  </TabsTrigger>
                  <TabsTrigger value="p4" className="raw-p4-tab text-xs">
                    P4
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="json" className="raw-json-content pt-2">
                  <ScrollArea className="h-[min(28rem,60vh)] w-full rounded-md border bg-muted/30 p-2">
                    <pre className="m-0 whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed">
                      {snapshotRaw.pnrJson == null
                        ? "—"
                        : JSON.stringify(snapshotRaw.pnrJson, null, 2)}
                    </pre>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="p3" className="raw-p3-content pt-2">
                  <ScrollArea className="h-[min(28rem,60vh)] w-full rounded-md border bg-muted/30 p-2">
                    <pre className="m-0 whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed">
                      {snapshotRaw.pnrP3Soap?.trim()
                        ? snapshotRaw.pnrP3Soap
                        : "—"}
                    </pre>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="p4" className="raw-p4-content pt-2">
                  <ScrollArea className="h-[min(28rem,60vh)] w-full rounded-md border bg-muted/30 p-2">
                    <pre className="m-0 whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed">
                      {snapshotRaw.pnrP4Soap?.trim()
                        ? snapshotRaw.pnrP4Soap
                        : "—"}
                    </pre>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </TabsContent>}
      </Tabs>
    </>
  )
}

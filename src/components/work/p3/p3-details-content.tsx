"use client"

import * as React from "react"
import {
  tryP3ModelFromFetchResult,
  type P3ProcessModel,
} from "@/lib/p3-process-data"
import type { P3FetchResult, PnrJsonData } from "@/lib/pnr-types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { P3CancelledLegSsrTable } from "./p3-cancelled-leg-ssr-table"
import { P3PnrContactTable } from "./p3-pnr-contact-table"
import { P3PnrMainGridTable } from "./p3-pnr-main-grid"

function P3TableShell({
  className,
  title,
  children,
  description,
}: {
  className: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("w-full min-w-0 space-y-1.5", className)}>
      {title || description ? (
        <div>
          {title ? (
            <h3 className="text-xs font-medium text-foreground">{title}</h3>
          ) : null}
          {description ? (
            <p className="text-[11px] text-muted-foreground">{description}</p>
          ) : null}
        </div>
      ) : null}
      <div
        className={cn(
          "min-h-0 w-full max-w-full min-w-0 overflow-auto overscroll-x-contain rounded-md border",
          className === "p3-pnr-information" ? "" : "max-h-[min(20rem,40vh)]",
        )}
      >
        <div className="w-full min-w-0 p-0">{children}</div>
      </div>
    </div>
  )
}

export function P3DetailsContent({
  p3Result,
  booking,
}: {
  p3Result: P3FetchResult | null
  booking: PnrJsonData | null
}) {
  const [showRaw, setShowRaw] = React.useState(false)

  if (!p3Result) {
    return <p className="text-sm text-muted-foreground">No P3 response.</p>
  }
  if (p3Result.error) {
    return <p className="text-sm text-destructive">{p3Result.error}</p>
  }

  const parsed = tryP3ModelFromFetchResult(p3Result, booking)
  const raw = typeof p3Result.body === "string" ? p3Result.body : ""

  if (!parsed.ok) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-destructive">{parsed.error}</p>
        {raw ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setShowRaw(!showRaw)}
            >
              {showRaw ? "Hide" : "Show"} raw response
            </Button>
            {showRaw ? (
              <pre className="max-h-[24rem] overflow-auto rounded border bg-muted/40 p-3 text-[10px] leading-relaxed text-foreground">
                {raw.length > 12_000 ? `${raw.slice(0, 12_000)}…` : raw}
              </pre>
            ) : null}
          </>
        ) : null}
      </div>
    )
  }

  const m = parsed.model
  return <P3ProcessTables model={m} booking={booking} />
}

function P3ProcessTables({
  model: m,
  booking,
}: {
  model: P3ProcessModel
  booking: PnrJsonData | null
}) {
  const mainEmpty =
    booking?.flights && booking.flights.length > 0
      ? "No PAX / flight matrix rows (check traveler scope)."
      : "No flights in PNR JSON — main grid is empty."

  const hasCancelledLeg = m.cancelledLeg.length > 0

  return (
    <div className="min-w-0 space-y-6 text-foreground">
      {hasCancelledLeg ? (
        <div className="grid w-full min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
          <P3TableShell
            className="pnr-information min-w-0"
            title="PNR information"
          >
            <P3PnrContactTable rows={m.pnrInfo} />
          </P3TableShell>
          <P3TableShell
            className="cancelled-leg-ssr-information min-w-0"
            title="Cancelled Leg"
          >
            <P3CancelledLegSsrTable
              rows={m.cancelledLeg}
              personNames={m.personNames}
              travelers={booking?.travelers}
            />
          </P3TableShell>
        </div>
      ) : (
        <P3TableShell className="pnr-information" title="PNR information">
          <P3PnrContactTable rows={m.pnrInfo} />
        </P3TableShell>
      )}

      <P3TableShell className="p3-pnr-information" title="">
        <P3PnrMainGridTable rows={m.mainGrid} emptyHint={mainEmpty} />
      </P3TableShell>
    </div>
  )
}

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { P3MainGridRow } from "@/lib/p3-process-data"
import { cn } from "@/lib/utils"

const P3_PNR_GRID_HEADERS = [
  "Flights · Airline #",
  "Origin",
  "Destination",
  "Departure",
  "Arrival",
  "Status",
  "CTCE",
  "CTCM",
  "PAX",
  "DOCS",
  "TKNE",
] as const

// "—", "-", "N/A", or empty counts as a missing value
function isMissingValue(v: string | null | undefined): boolean {
  const t = (v ?? "").trim()
  return t === "" || t === "—" || t === "-" || t.toUpperCase() === "N/A"
}

// Row exception: missing/unmatched data from PNR, P3 (CTCE/CTCM/DOCS) or P4 (TKNE)
function rowHasException(r: P3MainGridRow): boolean {
  return (
    r.ctceIsNa ||
    r.ctcmIsNa ||
    r.docsException ||
    r.tkneException ||
    r.tkneRouteMismatch ||
    isMissingValue(r.status) ||
    isMissingValue(r.ctce) ||
    isMissingValue(r.ctcm) ||
    isMissingValue(r.docs) ||
    isMissingValue(r.tkne)
  )
}

export function P3PnrMainGridTable({
  rows,
  emptyHint,
}: {
  rows: P3MainGridRow[]
  emptyHint: string
}) {
  return (
    <Table>
      <TableCaption className="sr-only">
        Flights, contacts, DOCS, TKNE (SSR ticket coupon line)
      </TableCaption>
      <TableHeader>
        <TableRow>
          {P3_PNR_GRID_HEADERS.map((h) => (
            <TableHead
              key={h}
              className="table-bottom-border text-xs whitespace-nowrap"
            >
              {h}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={11} className="text-xs text-muted-foreground">
              {emptyHint}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((r) => (
            <TableRow
              key={r.flightKey}
              className={cn(rowHasException(r) && "bg-destructive/10")}
            >
              <TableCell className="text-xs whitespace-nowrap">
                {r.flightsAndConf}
              </TableCell>
              <TableCell className="text-xs">{r.origin}</TableCell>
              <TableCell className="text-xs">{r.destination}</TableCell>
              <TableCell className="text-xs whitespace-nowrap">
                {r.departure}
              </TableCell>
              <TableCell className="text-xs whitespace-nowrap">
                {r.arrival}
              </TableCell>
              <TableCell className="text-xs">{r.status}</TableCell>
              <TableCell
                className={cn(
                  "max-w-sm align-middle text-xs whitespace-normal",
                  r.ctceIsNa && "text-amber-600 dark:text-amber-400"
                )}
                title={r.ctceIsNa ? "A3S CTCE missing or empty" : undefined}
              >
                {r.ctce}
              </TableCell>
              <TableCell
                className={cn(
                  "align-top text-xs whitespace-nowrap",
                  r.ctcmIsNa && "text-amber-600 dark:text-amber-400"
                )}
                title={r.ctcmIsNa ? "A3S CTCM missing or empty" : undefined}
              >
                {r.ctcm}
              </TableCell>
              <TableCell className="text-xs whitespace-nowrap">
                {r.pax}
              </TableCell>
              <TableCell
                className={cn(
                  "text-xs whitespace-nowrap",
                  r.docsException && "text-destructive"
                )}
                title={
                  r.docsException
                    ? "PNR expects DOCS; no A3S line for this pax"
                    : undefined
                }
              >
                {r.docs}
              </TableCell>
              <TableCell
                className={cn(
                  "text-xs whitespace-nowrap",
                  (r.tkneException && "text-destructive") ||
                    (r.tkneRouteMismatch &&
                      "text-amber-600 dark:text-amber-400")
                )}
                title={
                  r.tkneException
                    ? "TKNE missing, empty, or not HK/KK"
                    : r.tkneRouteMismatch
                      ? "TKNE line did not match this route; showing airline fallback"
                      : undefined
                }
              >
                {r.tkne && r.tkne !== "—" ? (
                  <>
                    <span className="text-foreground">SSR TKNE </span>
                    {r.tkne}
                  </>
                ) : (
                  "—"
                )}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

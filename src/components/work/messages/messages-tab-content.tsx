"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  buildMessagesTablesFromPnr,
  type MessagesOtherTableRow,
  type MessagesP4TableRow,
} from "@/lib/messages-mother"
import type { P3A3SRow } from "@/lib/p3-process-data"
import type { PnrJsonData } from "@/lib/pnr-types"
import { cn } from "@/lib/utils"

const th2 = "table-bottom-border text-xs text-left"
const P3_CAP = 200

function P4MessagesTable({ rows }: { rows: MessagesP4TableRow[] }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={th2}>Code</TableHead>
            <TableHead className={th2}>Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow
              key={`p4-${i}`}
              className={cn(
                r.tone === "exception" && "text-destructive",
                r.tone === "special" && "text-amber-800 dark:text-amber-200"
              )}
            >
              <TableCell className="align-top font-mono text-xs">
                {r.code}
              </TableCell>
              <TableCell className="max-w-md text-xs break-words">
                {r.message}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function OtherMessagesTable({ rows }: { rows: MessagesOtherTableRow[] }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={th2}>Code</TableHead>
            <TableHead className={th2}>Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={`other-${i}`}>
              <TableCell className="align-top font-mono text-xs">
                {r.code}
              </TableCell>
              <TableCell className="max-w-md text-xs break-words">
                {r.message}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function P3A3sTableBlock({
  p3rows,
  id,
  className,
}: {
  p3rows: P3A3SRow[]
  id?: string
  className?: string
}) {
  return (
    <section
      className={cn("special-request-from-p3 space-y-1.5", className)}
      id={id}
      aria-label="A3S rows from P3"
    >
      <h3 className="text-xs font-medium">
        Special Messages – P3 (A3S SSR sample)
      </h3>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={th2}>Airline</TableHead>
              <TableHead className={th2}>Type</TableHead>
              <TableHead className={th2}>Information</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {p3rows.slice(0, P3_CAP).map((r, i) => (
              <TableRow key={`p3-${i}`}>
                <TableCell className="font-mono text-xs whitespace-nowrap">
                  {r.airlineCode}
                </TableCell>
                <TableCell className="font-mono text-xs whitespace-nowrap">
                  {r.ssrType}
                </TableCell>
                <TableCell className="max-w-xl text-xs">
                  {r.information || r.rawText}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

export function MessagesTabContent({
  pnrData,
  p3A3sSample,
}: {
  pnrData: PnrJsonData | null
  p3A3sSample?: P3A3SRow[] | null
}) {
  const { p4, other } = buildMessagesTablesFromPnr(pnrData)
  const p3List = p3A3sSample && p3A3sSample.length > 0 ? p3A3sSample : null
  const hasP4 = p4.length > 0
  const hasP3 = Boolean(p3List?.length)
  const hasOther = other.length > 0
  const fullyEmpty = !hasP4 && !hasOther && !hasP3

  /** P4 and P3 both empty: put Other in the first (left) column on md+ */
  const otherOnLeft = !hasP4 && !hasP3 && hasOther
  /** P4 has rows: show any P3 below the top grid to avoid a cramped 2×2 */
  const p3BelowGrid = hasP4 && hasP3
  /** Left column is P3 (not P4) */
  const p3InLeftColumn = !hasP4 && hasP3

  if (fullyEmpty) {
    return (
      <p
        id="special-message-empty"
        className="messages-summary text-xs text-muted-foreground"
      >
        No P4 or other special-service messages, and no P3 A3S SSR content.
      </p>
    )
  }

  if (otherOnLeft) {
    return (
      <div className="messages-summary text-sm text-foreground">
        <div className="grid gap-4 md:grid-cols-2">
          <section
            className="other-message order-1 min-w-0 space-y-1.5"
            aria-label="Other messages"
          >
            <h3 className="text-xs font-medium">Other Messages</h3>
            <OtherMessagesTable rows={other} />
          </section>
          <section
            className="order-2 min-w-0 rounded-md border border-dashed p-3 text-[11px] text-muted-foreground"
            aria-hidden
          >
            No P4 or P3 special content in this PNR. Other messages are shown on
            the left.
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="messages-summary text-sm text-foreground">
      <div className="grid gap-4 md:grid-cols-2">
        <section
          className="special-request-from-p4 min-w-0 space-y-1.5"
          aria-label="Special P4 and P3 primary column"
        >
          {hasP4 ? (
            <>
              <h3 className="text-xs font-medium">Special Messages – P4</h3>
              <P4MessagesTable rows={p4} />
            </>
          ) : p3InLeftColumn && p3List ? (
            <P3A3sTableBlock
              p3rows={p3List}
              id="special-request-from-p3-content"
            />
          ) : (
            <>
              <h3 className="text-xs font-medium">Special Messages – P4</h3>
              <p>No P4 special-service rows (after filters).</p>
            </>
          )}
        </section>

        <section
          className="other-message min-w-0 space-y-1.5"
          aria-label="Other messages"
        >
          <h3 className="text-xs font-medium">Other Messages</h3>
          {hasOther ? (
            <OtherMessagesTable rows={other} />
          ) : (
            <p>No other messages (ADTK, ADMD, OTHS, FQTS, …).</p>
          )}
        </section>
      </div>

      {p3BelowGrid && p3List ? (
        <P3A3sTableBlock
          p3rows={p3List}
          className="mt-4"
          id="special-request-from-p3-content"
        />
      ) : null}
    </div>
  )
}

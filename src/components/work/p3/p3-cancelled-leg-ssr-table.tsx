import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  passengerLabelForCancelledA3SRow,
  type P3A3SRow,
} from "@/lib/p3-process-data"
import type { P3PersonName } from "@/lib/p3-mother"
import type { PnrJsonTraveler } from "@/lib/pnr-types"

export function P3CancelledLegSsrTable({
  rows,
  personNames = [],
  travelers,
}: {
  rows: P3A3SRow[]
  personNames?: P3PersonName[]
  travelers?: PnrJsonTraveler[] | null
}) {
  return (
    <Table>
      <TableCaption className="sr-only">Airline, information, pax</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Airline</TableHead>
          <TableHead>Information</TableHead>
          <TableHead>Pax</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={`cl-${i}`}>
            <TableCell className="font-mono text-xs whitespace-nowrap">
              {r.airlineCode}
            </TableCell>
            <TableCell className="max-w-xl text-xs">
              {r.ssrType} {r.information}
            </TableCell>
            <TableCell
              className="text-xs whitespace-nowrap"
              title="Passenger affected"
            >
              {passengerLabelForCancelledA3SRow(
                r,
                personNames,
                travelers ?? null
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

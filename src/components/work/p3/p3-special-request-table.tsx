import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { P3SpecialRequestRow } from "@/lib/p3-process-data"

const th = "table-bottom-border text-xs"

export function P3SpecialRequestTable({
  rows,
}: {
  rows: P3SpecialRequestRow[]
}) {
  return (
    <Table>
      <TableCaption className="sr-only">
        Code, flight, status, O&amp;D
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className={th}>Code</TableHead>
          <TableHead className={th}>Flight</TableHead>
          <TableHead className={th}>Status Code</TableHead>
          <TableHead className={th}>Origin and Destination</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-muted-foreground">
              No matching special / meal SSR rows
            </TableCell>
          </TableRow>
        ) : (
          rows.map((r, i) => (
            <TableRow key={`sp-${i}`}>
              <TableCell className="font-mono text-xs">{r.code}</TableCell>
              <TableCell className="text-xs">{r.flight}</TableCell>
              <TableCell className="text-xs">{r.statusCode}</TableCell>
              <TableCell className="max-w-md text-xs">
                {r.originAndDestination}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

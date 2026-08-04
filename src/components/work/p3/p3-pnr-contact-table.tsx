import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { P3ContactRow } from "@/lib/p3-process-data"

export function P3PnrContactTable({ rows }: { rows: P3ContactRow[] }) {
  return (
    <Table>
      <TableCaption className="sr-only">Pax email phone</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>PAX</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Phone</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={3} className="text-xs text-muted-foreground">
              No travelers in PNR JSON
            </TableCell>
          </TableRow>
        ) : (
          rows.map((r, i) => (
            <TableRow key={`ct-${i}`}>
              <TableCell className="text-xs whitespace-nowrap">
                {r.pax}
              </TableCell>
              <TableCell className="max-w-sm align-middle text-xs">
                {r.emails.length === 0 ? (
                  <span className="text-muted-foreground">N/A</span>
                ) : (
                  <ul className="m-0 list-none space-y-1 p-0">
                    {r.emails.map((e, ei) => (
                      <li key={`${i}-${ei}-${e}`}>{e}</li>
                    ))}
                  </ul>
                )}
              </TableCell>
              <TableCell className="align-top text-xs whitespace-nowrap">
                {r.phones.length === 0 ? (
                  <span className="text-muted-foreground">N/A</span>
                ) : (
                  <ul className="m-0 list-none space-y-1 p-0">
                    {r.phones.map((p, pi) => (
                      <li key={`${i}-ph-${pi}-${p}`}>{p}</li>
                    ))}
                  </ul>
                )}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

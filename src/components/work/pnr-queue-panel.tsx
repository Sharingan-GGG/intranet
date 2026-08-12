"use client"

import * as React from "react"
import { Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { isAllowed } from "@/lib/permissions"
import type { PermissionMap } from "@/lib/permissions"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { tabStatusDotClass } from "@/lib/conditions"
import type { DashboardPnrItem, TabStatus } from "@/lib/pnr-types"
import { formatAdlDate, formatAdlDateTime } from "@/lib/datetime-adl"
import { cn } from "@/lib/utils"

type QueueKind = "exception" | "pending" | "complete" | "all"
type ColumnKey = "client" | "consultant" | "departure"

function StatusDot({ status, pulse }: { status: TabStatus; pulse?: boolean }) {
  return (
    <span
      className={cn(
        tabStatusDotClass(status),
        "shrink-0 ring-1 ring-border",
        pulse && status === "exception" && "animate-pulse"
      )}
    />
  )
}

function formatConsultant(name: string | null | undefined): string {
  if (!name) return "—"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0]}`
}

function isDepartingWithin24h(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return false
  const diff = d.getTime() - Date.now()
  return diff > 0 && diff < 24 * 60 * 60 * 1000
}

function isDepartingOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return false
  return d.getTime() < Date.now()
}

function resolveQueueKind(row: DashboardPnrItem, kind: QueueKind): QueueKind {
  const statusRaw = (row.statusRaw || "").toLowerCase()
  if (statusRaw === "exception") return "exception"
  if (statusRaw === "pending") return "pending"
  if (statusRaw) return "complete"
  return kind
}

function QueueTableScroll({ children, bare }: { children: React.ReactNode; bare?: boolean }) {
  if (bare) {
    return <div className="w-full">{children}</div>
  }
  return (
    <div className="w-full overflow-x-auto rounded-lg border bg-card">
      {children}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function PnrQueueSkeleton({ bare }: { bare?: boolean } = {}) {
  return (
    <div className="min-w-0 space-y-2">
      <QueueTableScroll bare={bare}>
        <div className="min-w-max">
          <Table>
            <TableCaption className="sr-only">Loading queue rows</TableCaption>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-8 px-2 py-2" />
                <TableHead className="py-2 text-[10px] whitespace-nowrap">
                  PNR <Skeleton className="inline-block h-3 w-5 align-middle" />
                </TableHead>
                <TableHead className="py-2 text-[10px] whitespace-nowrap">Client</TableHead>
                <TableHead className="py-2 text-[10px] whitespace-nowrap">Consultant</TableHead>
                <TableHead className="py-2 text-[10px] whitespace-nowrap">Departure</TableHead>
                <TableHead className="py-2 text-end text-[10px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="w-8 px-2">
                    <Skeleton className="size-4" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Skeleton className="size-2 shrink-0 rounded-full" />
                      <Skeleton className="h-4 w-14" />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell className="text-end">
                    <Skeleton className="ms-auto h-7 w-20" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </QueueTableScroll>
    </div>
  )
}

// ─── Row actions ──────────────────────────────────────────────────────────────

/**
 * Queue Row Actions - Pre Departure Module
 *
 * Action buttons displayed here are controlled by Pre Departure specific permissions:
 * - scan_pnr: Controls Resync and Draft actions
 * - Permissions apply only to Pre Departure queue operations
 */
function QueueRowActions({
  kind,
  pnr,
  brand,
  onAction,
  actionLoading,
  row,
  role = "user",
  permissions,
}: {
  kind: QueueKind
  pnr: string
  brand?: string
  onAction?: (action: string, pnr: string, brand?: string) => void
  actionLoading?: Record<string, string>
  row?: DashboardPnrItem
  role?: string
  permissions?: PermissionMap | null
}) {
  const canResync = isAllowed(permissions ?? null, "scan_pnr")
  const canDraft = isAllowed(permissions ?? null, "scan_pnr")
  const handle = (action: string) => {
    if (onAction) onAction(action, pnr, brand)
    else toast.message(`${action} — ${pnr}`)
  }

  const isLoading = (action: string) => actionLoading?.[pnr] === action
  const isAnyLoading = pnr in (actionLoading ?? {})

  // Determine actual kind from row if provided
  const actualKind = row ? resolveQueueKind(row, kind) : kind

  if (actualKind === "exception") {
    return (
      <>
        {canResync && (
          <button
            type="button"
            className="inline-flex h-6 items-center rounded-md border border-primary/45 bg-transparent px-2.5 text-[10.5px] font-semibold text-primary hover:bg-primary/5 dark:border-primary/60 dark:text-white disabled:opacity-50"
            onClick={() => handle("Resync")}
            disabled={isAnyLoading}
          >
            {isLoading("Resync") ? <Loader2Icon className="size-3 animate-spin" /> : "Resync"}
          </button>
        )}
        <button
          type="button"
          className="inline-flex h-6 items-center rounded-md bg-emerald-600 px-2.5 text-[10.5px] font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 disabled:opacity-50"
          onClick={() => handle("Approve")}
          disabled={isAnyLoading}
        >
          {isLoading("Approve") ? <Loader2Icon className="size-3 animate-spin" /> : "Approve"}
        </button>
      </>
    )
  }

  if (actualKind === "pending") {
    return (
      <>
        {canDraft && (
          <button
            type="button"
            className="inline-flex h-6 items-center rounded-md border border-amber-500/50 bg-amber-500/10 px-2.5 text-[10.5px] font-semibold text-amber-700 hover:bg-amber-500/25 dark:text-amber-300 disabled:opacity-50"
            onClick={() => handle("Draft")}
            disabled={isAnyLoading}
          >
            {isLoading("Draft") ? <Loader2Icon className="size-3 animate-spin" /> : "Draft"}
          </button>
        )}
        <button
          type="button"
          className="inline-flex h-6 items-center rounded-md bg-[#10B981] px-2.5 text-[10.5px] font-semibold text-white hover:bg-[#0EA372] disabled:opacity-50"
          onClick={() => handle("Done")}
          disabled={isAnyLoading}
        >
          {isLoading("Done") ? <Loader2Icon className="size-3 animate-spin" /> : "Done"}
        </button>
        <button
          type="button"
          className="inline-flex h-6 items-center rounded-md border border-destructive bg-transparent px-2.5 text-[10.5px] font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
          onClick={() => handle("Revoke")}
          disabled={isAnyLoading}
          aria-label="Revoke"
        >
          {isLoading("Revoke") ? <Loader2Icon className="size-3 animate-spin" /> : "Revoke"}
        </button>
      </>
    )
  }

  if (actualKind === "complete") {
    return (
      <button
        type="button"
        className="inline-flex h-6 items-center rounded-md border border-destructive bg-transparent px-2.5 text-[10.5px] font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
        onClick={() => handle("Revoke")}
        disabled={isAnyLoading}
        aria-label="Revoke"
      >
        {isLoading("Revoke") ? <Loader2Icon className="size-3 animate-spin" /> : "Revoke"}
      </button>
    )
  }

  return null
}

// ─── Table row ────────────────────────────────────────────────────────────────

function PnrQueueRow({
  row,
  kind,
  isSelected,
  isChecked,
  onSelect,
  onCheck,
  onAction,
  actionLoading,
  visibleCols,
  role = "user",
  permissions,
}: {
  row: DashboardPnrItem
  kind: QueueKind
  isSelected: boolean
  isChecked: boolean
  onSelect: (pnr: string) => void
  onCheck: (pnr: string, checked: boolean) => void
  onAction?: (action: string, pnr: string, brand?: string) => void
  actionLoading?: Record<string, string>
  visibleCols: Set<ColumnKey>
  role?: string
  permissions?: PermissionMap | null
}) {
  const departing24h = isDepartingWithin24h(row.departureDate)
  const overdueRow = isDepartingOverdue(row.departureDate)
  const statusKind = resolveQueueKind(row, kind)

  return (
    <>
      <TableRow
        data-state={isSelected ? "selected" : undefined}
        data-checked={isChecked ? "true" : undefined}
        // Ordered lowest-priority first: tailwind-merge keeps the last conflicting class, so
        // precedence falls out of the order rather than needing !isSelected guards on each.
        className={cn(
          "cursor-pointer border-b border-[#aaccd6]/35 transition-colors even:bg-[#aaccd6]/12 hover:bg-[#aaccd6]/30",
          // Row color by status, Dark Mode only — Light Mode keeps the default row styling above.
          // Exception is the flag color solid; pending/complete are a translucent "glass"
          // blue/green applied uniformly (not just on alternating rows).
          // The base TableRow always sets data-[state=selected]:bg-muted, which — being a
          // variant class — wins over any plain bg-* here regardless of source order, so the
          // selected state needs its own same-variant override to keep the status color visible.
          statusKind === "exception" &&
            "dark:bg-[#240E12] dark:even:bg-[#240E12] dark:hover:bg-[#240E12]/90 dark:data-[state=selected]:bg-[#240E12]/90 dark:border-[#240E12]",
          statusKind === "pending" &&
            "dark:bg-blue-500/15 dark:even:bg-blue-500/15 dark:backdrop-blur-sm dark:hover:bg-blue-500/25 dark:data-[state=selected]:bg-blue-500/30",
          statusKind === "complete" &&
            "dark:bg-emerald-500/15 dark:even:bg-emerald-500/15 dark:backdrop-blur-sm dark:hover:bg-emerald-500/25 dark:data-[state=selected]:bg-emerald-500/30",
          // Departure-date tints inform, but must never mask a selection.
          departing24h && "bg-amber-500/10 even:bg-amber-500/10",
          overdueRow && "bg-muted/40 even:bg-muted/40",
          // Ticked for a bulk action (move, approve, delete) — previously the checkbox was
          // the only indication, which made a multi-row selection hard to keep track of.
          isChecked &&
            "bg-primary/12 even:bg-primary/12 hover:bg-primary/20 data-[state=selected]:bg-primary/12 shadow-[inset_3px_0_0_var(--primary)]",
          // The row whose detail panel is open.
          isSelected &&
            "bg-[#aaccd6]/35 even:bg-[#aaccd6]/35 data-[state=selected]:bg-[#aaccd6]/35 shadow-[inset_3px_0_0_var(--primary)]",
          // Both at once: keep it clearly distinct from either state alone.
          isChecked &&
            isSelected &&
            "bg-primary/25 even:bg-primary/25 hover:bg-primary/30 data-[state=selected]:bg-primary/25"
        )}
        onClick={() => onSelect(row.pnr)}
      >
        {/* Checkbox */}
        <TableCell className="w-8 px-2" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isChecked}
            onCheckedChange={(v) => onCheck(row.pnr, Boolean(v))}
            aria-label={`Select ${row.pnr}`}
          />
        </TableCell>

        {/* PNR */}
        <TableCell>
          <div className="flex min-w-0 items-center gap-1.5">
            <StatusDot status={row.statuses.total} pulse />
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs font-semibold tracking-[0.06em] tabular-nums text-primary dark:text-white">
                  {row.pnr}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px] space-y-1 text-xs">
                {row.scannedBy && (
                  <p>
                    <span className="text-muted-foreground">Scanned by:</span>{" "}
                    {row.scannedBy}
                  </p>
                )}
                {row.scannedOn && (
                  <p>
                    <span className="text-muted-foreground">Scanned:</span>{" "}
                    {formatAdlDateTime(row.scannedOn)}
                  </p>
                )}
                {row.createdAt && (
                  <p>
                    <span className="text-muted-foreground">Added:</span>{" "}
                    {formatAdlDate(row.createdAt)}
                  </p>
                )}
                {row.frequentFlyer === "YES" && (
                  <p className="text-amber-600 dark:text-amber-400">Frequent Flyer</p>
                )}
              </TooltipContent>
            </Tooltip>
            {row.frequentFlyer === "YES" && (
              <span className="text-[9px] font-medium text-amber-600 dark:text-amber-400">
                FF
              </span>
            )}
          </div>
        </TableCell>

        {/* Client */}
        {visibleCols.has("client") && (
          <TableCell className="max-w-[9rem] truncate text-xs">
            {row.client || "—"}
          </TableCell>
        )}

        {/* Consultant */}
        {visibleCols.has("consultant") && (
          <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
            {formatConsultant(row.consultant)}
          </TableCell>
        )}

        {/* Departure */}
        {visibleCols.has("departure") && (
          <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
            {row.departureDate ? formatAdlDate(row.departureDate) : "—"}
          </TableCell>
        )}

        {/* Actions */}
        <TableCell className="text-end" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-wrap items-center justify-end gap-1">
            <QueueRowActions
              kind={kind}
              pnr={row.pnr}
              brand={row.brand}
              onAction={onAction}
              actionLoading={actionLoading}
              row={row}
              role={role}
              permissions={permissions}
            />
          </div>
        </TableCell>
      </TableRow>
    </>
  )
}

// ─── Table ────────────────────────────────────────────────────────────────────

export function PnrQueueTable({
  rows,
  kind,
  selectedPnr,
  onSelect,
  onAction,
  actionLoading,
  selectedPnrs,
  onSelectionChange,
  bare,
  role = "user",
  permissions,
}: {
  rows: DashboardPnrItem[]
  kind: QueueKind
  selectedPnr: string | null
  onSelect: (pnr: string) => void
  onAction?: (action: string, pnr: string, brand?: string) => void
  actionLoading?: Record<string, string>
  selectedPnrs: Set<string>
  onSelectionChange: (pnrs: Set<string>) => void
  bare?: boolean
  role?: string
  permissions?: PermissionMap | null
}) {
  const [visibleCols, setVisibleCols] = React.useState<Set<ColumnKey>>(
    new Set<ColumnKey>(["client", "consultant", "departure"])
  )

  const allChecked = rows.length > 0 && rows.every((r) => selectedPnrs.has(r.pnr))
  const someChecked = rows.some((r) => selectedPnrs.has(r.pnr)) && !allChecked

  function toggleAll(checked: boolean) {
    onSelectionChange(checked ? new Set(rows.map((r) => r.pnr)) : new Set())
  }

  function handleCheck(pnr: string, checked: boolean) {
    const next = new Set(selectedPnrs)
    if (checked) next.add(pnr)
    else next.delete(pnr)
    onSelectionChange(next)
  }

  // 2 fixed (checkbox + pnr) + visible toggleable + 1 actions
  const colSpan = 2 + visibleCols.size + 1

  const tableContent = (
    <QueueTableScroll bare={bare}>
      <div className="min-w-max">
        <Table>
          <TableCaption className="sr-only">
            Pre-departure queue: PNR, client, departure date, and actions
          </TableCaption>
          <TableHeader className="sticky top-0 z-10 bg-secondary">
            <TableRow className="border-b border-primary/15 bg-secondary hover:bg-secondary">
              {/* Checkbox header */}
              <TableHead className="w-8 px-2 py-2.5">
                <Checkbox
                  checked={allChecked ? true : someChecked ? "indeterminate" : false}
                  onCheckedChange={(v) => toggleAll(v === true)}
                  aria-label="Select all"
                />
              </TableHead>

              {/* PNR header + badge */}
              <TableHead className="py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] whitespace-nowrap text-secondary-foreground">
                <span className="flex items-center gap-1.5">
                  PNR
                  <Badge variant="outline" className="h-4 border-primary/25 px-1.5 text-[9px] text-secondary-foreground">
                    {rows.length}
                  </Badge>
                </span>
              </TableHead>

              {/* Toggleable column headers */}
              {visibleCols.has("client") && (
                <TableHead className="py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] whitespace-nowrap text-secondary-foreground">Client Profile</TableHead>
              )}
              {visibleCols.has("consultant") && (
                <TableHead className="py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] whitespace-nowrap text-secondary-foreground">Consultant</TableHead>
              )}
              {visibleCols.has("departure") && (
                <TableHead className="py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] whitespace-nowrap text-secondary-foreground">Departure</TableHead>
              )}

              {/* Actions header */}
              <TableHead className="py-2.5 text-end text-[11px] font-semibold uppercase tracking-[0.06em] text-secondary-foreground">
                <span>Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colSpan}
                  className="h-20 text-center text-xs text-muted-foreground"
                >
                  No records
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <PnrQueueRow
                  key={r.pnr}
                  row={r}
                  kind={kind}
                  isSelected={selectedPnr === r.pnr}
                  isChecked={selectedPnrs.has(r.pnr)}
                  onSelect={onSelect}
                  onCheck={handleCheck}
                  onAction={onAction}
                  actionLoading={actionLoading}
                  visibleCols={visibleCols}
                  role={role}
                  permissions={permissions}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </QueueTableScroll>
  )

  if (bare) {
    return tableContent
  }

  return (
    <div className="min-w-0">
      {tableContent}
    </div>
  )
}

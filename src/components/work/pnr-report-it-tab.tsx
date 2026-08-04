"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  WrenchIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { OperationStatus } from "@/components/ui/operation-modal"
import type { ReportItRow } from "@/lib/supabase/database.types"
import { formatAdlDateTime } from "@/lib/datetime-adl"
import { cn } from "@/lib/utils"

// "admin" is the only role that can change status
const ADMIN_ROLE = "admin"
const ALL_USERS = ["admin", "Charlotte", "Alishia", "Emma", "Jodie"] as const

type Status = "Reported" | "Pending" | "Done"
type FlagResponse = { flag: ReportItRow | null; history: ReportItRow[] }

const STATUS_STEPS: Status[] = ["Reported", "Pending", "Done"]

const STATUS_META: Record<
  Status,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  Reported: {
    label: "Reported",
    icon: AlertTriangleIcon,
    color: "text-destructive",
    bg: "bg-destructive",
  },
  Pending: {
    label: "Pending",
    icon: ClockIcon,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500",
  },
  Done: {
    label: "Done",
    icon: WrenchIcon,
    color: "text-emerald-600",
    bg: "bg-emerald-500",
  },
}

async function fetchFlagData(pnr: string): Promise<FlagResponse> {
  const res = await fetch(`/api/report-it?pnr=${encodeURIComponent(pnr)}`)
  if (!res.ok) throw new Error("Failed to load flag")
  const j = (await res.json()) as Partial<FlagResponse>
  return {
    flag: j.flag ?? null,
    history: Array.isArray(j.history) ? j.history : [],
  }
}

async function submitReport(payload: {
  pnr: string
  reported_by: string
  reason?: string
}): Promise<ReportItRow> {
  const res = await fetch("/api/report-it", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = (await res.json()) as { error?: string }
    throw new Error(err.error ?? "Failed to submit report")
  }
  return ((await res.json()) as { flag: ReportItRow }).flag
}

async function updateStatus(payload: {
  id: number
  status: Status
}): Promise<ReportItRow> {
  const res = await fetch("/api/report-it", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = (await res.json()) as { error?: string }
    throw new Error(err.error ?? "Failed to update status")
  }
  return ((await res.json()) as { flag: ReportItRow }).flag
}

function formatDate(iso: string): string {
  return formatAdlDateTime(iso)
}

function StatusStepper({ current }: { current: Status }) {
  const currentIdx = STATUS_STEPS.indexOf(current)
  return (
    <div className="flex items-center gap-0">
      {STATUS_STEPS.map((step, i) => {
        const meta = STATUS_META[step]
        const done = i < currentIdx
        const active = i === currentIdx
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                  active
                    ? `${meta.bg} border-transparent text-white`
                    : done
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                      : "border-border bg-muted text-muted-foreground"
                )}
              >
                {done ? (
                  <CheckCircleIcon className="size-3.5" />
                ) : (
                  <meta.icon className="size-3.5" />
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium",
                  active
                    ? meta.color
                    : done
                      ? "text-emerald-600"
                      : "text-muted-foreground"
                )}
              >
                {meta.label}
              </span>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div
                className={cn(
                  "mb-4 h-0.5 w-10 flex-1 transition-colors",
                  i < currentIdx ? "bg-emerald-500" : "bg-border"
                )}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

function StatusPill({ status }: { status: string | null }) {
  const meta = STATUS_META[status as Status]
  if (!meta) return <span className="text-muted-foreground">—</span>
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
        status === "Reported" && "bg-destructive/10 text-destructive",
        status === "Pending" &&
          "bg-blue-500/10 text-blue-700 dark:text-blue-400",
        status === "Done" &&
          "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      )}
    >
      {status}
    </span>
  )
}

export function PnrReportItTab({
  pnr,
  brand,
  onShowModal,
  onCloseModal,
}: {
  pnr: string
  brand?: string
  onShowModal?: (
    operation: string,
    status: OperationStatus,
    currentStep?: string,
    error?: string,
    onRetry?: () => void
  ) => void
  onCloseModal?: () => void
}) {
  const qc = useQueryClient()
  const [selectedUser, setSelectedUser] = React.useState<string>(ALL_USERS[0])
  const [reason, setReason] = React.useState("")

  const isAdmin = selectedUser === ADMIN_ROLE

  const { data, isLoading, error } = useQuery({
    queryKey: ["report-it-flag", pnr],
    queryFn: () => fetchFlagData(pnr),
    staleTime: 2 * 60 * 1000,
  })

  const flag = data?.flag ?? null
  const history = data?.history ?? []
  const activeStatus = (flag?.Status ?? null) as Status | null

  const submitMutation = useMutation({
    mutationFn: submitReport,
    onSuccess: (newFlag) => {
      qc.setQueryData<FlagResponse>(["report-it-flag", pnr], (prev) => ({
        flag: newFlag,
        history: [newFlag, ...(prev?.history ?? [])],
      }))
      setReason("")
      toast.warning(`PNR ${pnr} reported to IT`)
      onShowModal?.("Creating Report", "success")
      setTimeout(() => onCloseModal?.(), 1000)
    },
    onError: (e: Error) => {
      toast.error(e.message)
      onShowModal?.("Creating Report", "error", undefined, e.message)
    },
  })

  const statusMutation = useMutation({
    mutationFn: updateStatus,
    onSuccess: (updated) => {
      qc.setQueryData<FlagResponse>(["report-it-flag", pnr], (prev) => {
        const newHistory = (prev?.history ?? []).map((r) =>
          r.id === updated.id ? updated : r
        )
        const newFlag = updated.Status === "Done" ? null : updated
        return { flag: newFlag, history: newHistory }
      })
      toast.success(`Status updated to ${updated.Status}`)
      onShowModal?.("Updating Status", "success")
      setTimeout(() => onCloseModal?.(), 1000)
    },
    onError: (e: Error) => {
      toast.error(e.message)
      onShowModal?.("Updating Status", "error", undefined, e.message)
    },
  })

  // Show modal during submit
  React.useEffect(() => {
    if (submitMutation.isPending) {
      onShowModal?.("Creating Report", "pending", "Submitting report...")
    }
  }, [submitMutation.isPending, onShowModal])

  // Show modal during status update
  React.useEffect(() => {
    if (statusMutation.isPending) {
      onShowModal?.("Updating Status", "pending", "Updating report status...")
    }
  }, [statusMutation.isPending, onShowModal])

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-8 w-48" />
      </div>
    )
  }

  if (error) {
    return (
      <p className="text-xs text-destructive">
        Failed to load. Check Supabase connection.
      </p>
    )
  }

  const nextStatus: Record<Status, Status | null> = {
    Reported: "Pending",
    Pending: "Done",
    Done: null,
  }

  return (
    <div className="space-y-4">
      {/* User selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Logged in as:
        </span>
        <div className="flex flex-wrap gap-1">
          {ALL_USERS.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setSelectedUser(u)}
              className={cn(
                "inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-medium transition-colors",
                selectedUser === u
                  ? "border-primary bg-primary/10 text-primary dark:text-white"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                u === ADMIN_ROLE && "font-bold"
              )}
            >
              {u === ADMIN_ROLE ? "Admin" : u}
            </button>
          ))}
        </div>
      </div>

      {/* Active flag */}
      {flag && activeStatus ? (
        <div className="space-y-3 rounded-lg border p-4">
          <StatusStepper current={activeStatus} />
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">
                {flag.reported_by ?? "Unknown"}
              </span>
              {flag.reported_on ? ` — ${formatDate(flag.reported_on)}` : ""}
            </p>
            {flag.reason ? (
              <p className="rounded border bg-muted/50 px-2 py-1.5 whitespace-pre-wrap text-foreground/80">
                {flag.reason}
              </p>
            ) : (
              <p className="italic">No reason provided</p>
            )}
          </div>

          {/* Admin status actions */}
          {isAdmin && (
            <div className="flex flex-wrap gap-2 pt-1">
              {activeStatus === "Reported" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 border-blue-500/40 text-blue-700 hover:bg-blue-500/10 dark:text-blue-400"
                  disabled={statusMutation.isPending}
                  onClick={() =>
                    statusMutation.mutate({ id: flag.id, status: "Pending" })
                  }
                >
                  <ClockIcon className="size-3.5" />
                  Mark Pending
                </Button>
              )}
              {(activeStatus === "Reported" || activeStatus === "Pending") && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
                  disabled={statusMutation.isPending}
                  onClick={() =>
                    statusMutation.mutate({ id: flag.id, status: "Done" })
                  }
                >
                  <WrenchIcon className="size-3.5" />
                  Mark Done
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Submit form — available to all users */
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {isAdmin
              ? "No active issue. Submit a new report:"
              : "No active issue. Submit a report to IT:"}
          </p>
          <Textarea
            placeholder="Reason for reporting (optional)…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-[60px] resize-none text-sm"
          />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-8 gap-1.5"
            disabled={submitMutation.isPending}
            onClick={() =>
              submitMutation.mutate({
                pnr,
                reported_by: selectedUser,
                reason: reason || undefined,
              })
            }
          >
            <AlertTriangleIcon className="size-3.5" />
            {submitMutation.isPending ? "Submitting…" : `Report IT — ${pnr}`}
          </Button>
        </div>
      )}

      {/* History table */}
      {history.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            History
          </p>
          <div className="overflow-hidden rounded-md border text-xs">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Date
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Reported By
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {r.reported_on ? formatDate(r.reported_on) : "—"}
                    </td>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">
                      {r.reported_by ?? "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <StatusPill status={r.Status} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.reason ?? <span className="italic">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

"use client"

import * as React from "react"
import { startTransition } from "react"
import {
  BarChart3Icon,
  HomeIcon,
  MoonIcon,
  MoveRightIcon,
  RefreshCwIcon,
  ScanLineIcon,
  SearchIcon,
  SunIcon,
  Trash2Icon,
} from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { isAllowed } from "@/lib/permissions"
import type { PermissionMap } from "@/lib/permissions"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  OperationModal,
  type OperationStatus,
} from "@/components/ui/operation-modal"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { type PnrFilters } from "@/components/work/pnr-filter-bar"
import {
  type Brand,
  type DetailTab,
  type PreDepartureRoute,
  type QueueTab,
  asDetailTab,
  preDeparturePath,
  visibleBrands,
} from "@/lib/pre-departure-route"
import { PnrQueueHealthDrawer } from "@/components/work/pnr-queue-health-drawer"
import { useSheetImport } from "@/hooks/use-sheet-import"
import { useSabrePnrFetch } from "@/hooks/use-sabre-pnr-fetch"
import {
  PnrQueueSkeleton,
  PnrQueueTable,
} from "@/components/work/pnr-queue-panel"
import { PnrDetailPanel } from "@/components/work/pnr-detail-panel"
import { dashboardStatusesFromDetailLike } from "@/lib/pnr-dashboard-statuses"
import { usePnrQueue } from "@/hooks/use-pnr-queue"
import { usePnrDetail, fetchPnrDetail } from "@/hooks/use-pnr-detail"
import { useQueueRealtime } from "@/hooks/use-queue-realtime"
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels"
import type { DashboardPnrItem } from "@/lib/pnr-types"
import { cn } from "@/lib/utils"

const DRAFT_STEPS = [
  "Checking Frequent Flyer Condition",
  "Applying Rules",
  "Compiling template",
  "Almost Done...",
]


// ─── Profile type for Move dialog ─────────────────────────────────────────────

type ProfileOption = {
  id: string
  full_name: string | null
  email: string
  department: string | null
}

// ─── Draft Modal ──────────────────────────────────────────────────────────────

function DraftModal({
  isOpen,
  status,
  error,
  onClose,
}: {
  isOpen: boolean
  status: "pending" | "success" | "error"
  error?: string
  onClose: () => void
}) {
  const [stepIndex, setStepIndex] = React.useState(0)

  React.useEffect(() => {
    if (!isOpen || status !== "pending") return
    setStepIndex(0)
    const interval = setInterval(() => {
      setStepIndex((prev) =>
        prev >= DRAFT_STEPS.length - 1 ? prev : prev + 1
      )
    }, 1500)
    return () => clearInterval(interval)
  }, [isOpen, status])

  React.useEffect(() => {
    if (!isOpen || status === "pending") return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Enter") {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [isOpen, status, onClose])

  const progressValue =
    status === "success"
      ? 100
      : status === "error"
        ? 0
        : Math.round(((stepIndex + 1) / DRAFT_STEPS.length) * 90)

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-sm"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>
            {status === "success" ? "Draft Created" : "Creating Draft"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-6">
          {status === "pending" && (
            <>
              <div className="animate-spin">
                <div className="h-8 w-8 rounded-full border-4 border-amber-200 border-t-amber-500" />
              </div>
              <p className="text-sm font-semibold">Creating Draft</p>
              <p className="text-center text-sm text-muted-foreground">
                {DRAFT_STEPS[stepIndex]}
              </p>
              <div className="w-full">
                <Progress value={progressValue} className="h-1.5" />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
              >
                Cancel
              </Button>
            </>
          )}
          {status === "success" && (
            <>
              <div className="text-green-600">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <p className="text-sm font-semibold">Draft Created</p>
              <p className="text-center text-sm text-muted-foreground">
                Your draft has been created. Check your draft to review.
              </p>
              <div className="w-full">
                <Progress value={100} className="h-1.5" />
              </div>
              <Button type="button" onClick={onClose}>
                Done
              </Button>
            </>
          )}
          {status === "error" && (
            <>
              <div className="text-red-600">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <p className="text-sm font-semibold text-red-600">Draft Failed</p>
              {error && (
                <p className="text-center text-sm text-red-600">{error}</p>
              )}
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Delete Progress Modal ────────────────────────────────────────────────────

function DeleteProgressModal({
  isOpen,
  status,
  deletedCount,
  error,
  onClose,
}: {
  isOpen: boolean
  status: "pending" | "success" | "error"
  deletedCount: number
  error?: string
  onClose: () => void
}) {
  const [progress, setProgress] = React.useState(0)

  React.useEffect(() => {
    if (!isOpen || status !== "pending") return
    setProgress(15)
    const t1 = setTimeout(() => setProgress(45), 600)
    const t2 = setTimeout(() => setProgress(75), 1400)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [isOpen, status])

  React.useEffect(() => {
    if (!isOpen || status === "pending") return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Enter") {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [isOpen, status, onClose])

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-sm border-destructive/30"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>
            {status === "success" ? "Deletion Complete" : "Deleting PNRs"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-6">
          {status === "pending" && (
            <>
              <div className="animate-spin">
                <div className="h-8 w-8 rounded-full border-4 border-destructive/20 border-t-destructive" />
              </div>
              <p className="text-sm font-semibold">Deleting PNRs</p>
              <p className="text-center text-xs text-muted-foreground">
                Removing from queue and syncing sheet…
              </p>
              <div className="w-full">
                <Progress value={progress} className="h-1.5 [&>div]:bg-destructive" />
              </div>
            </>
          )}
          {status === "success" && (
            <>
              <div className="text-destructive">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <p className="text-sm font-semibold">
                {deletedCount} PNR{deletedCount !== 1 ? "s" : ""} Deleted
              </p>
              <div className="w-full">
                <Progress value={100} className="h-1.5 [&>div]:bg-destructive" />
              </div>
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Done
              </Button>
            </>
          )}
          {status === "error" && (
            <>
              <div className="text-destructive">
                <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <p className="text-sm font-semibold text-destructive">Delete Failed</p>
              {error && <p className="text-center text-xs text-destructive">{error}</p>}
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Move PNR Dialog ──────────────────────────────────────────────────────────

const MOVE_STEPS = [
  "Resolving brand...",
  "Updating queue records...",
  "Writing audit trail...",
  "Almost done...",
]

function MovePnrDialog({
  isOpen,
  onClose,
  pnrList,
  defaultBrand,
  defaultProfileId,
  availableBrands,
  onConfirm,
}: {
  isOpen: boolean
  onClose: () => void
  pnrList: string[]
  defaultBrand: string
  defaultProfileId?: string
  availableBrands: readonly string[]
  onConfirm: (toBrand: string, toProfileId: string | null) => Promise<void>
}) {
  const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle")
  const [error, setError] = React.useState<string | undefined>()
  const [stepIndex, setStepIndex] = React.useState(0)
  const [progress, setProgress] = React.useState(0)

  const [toBrand, setToBrand] = React.useState(defaultBrand)
  const NONE_PROFILE = "__none__"
  const [toProfileId, setToProfileId] = React.useState<string>(defaultProfileId ?? NONE_PROFILE)

  const [profiles, setProfiles] = React.useState<ProfileOption[]>([])
  const [profilesLoading, setProfilesLoading] = React.useState(false)

  // Reset form and fetch profiles when dialog opens
  React.useEffect(() => {
    if (!isOpen) return
    setStatus("idle")
    setError(undefined)
    setToBrand(defaultBrand)
    setToProfileId(defaultProfileId ?? NONE_PROFILE)
    setStepIndex(0)
    setProgress(0)

    setProfilesLoading(true)
    fetch("/api/profiles")
      .then((r) => r.json())
      .then((data: ProfileOption[]) => setProfiles(Array.isArray(data) ? data : []))
      .catch(() => setProfiles([]))
      .finally(() => setProfilesLoading(false))
  }, [isOpen, defaultBrand, defaultProfileId])

  // Enter key: submit when idle, close when success/error
  React.useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key !== "Enter" || e.defaultPrevented) return
      if (status === "idle" && toBrand) {
        e.preventDefault()
        void handleSubmit()
      } else if (status === "success" || status === "error") {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, status, toBrand])

  // Animate steps while loading
  React.useEffect(() => {
    if (status !== "loading") return
    setStepIndex(0)
    setProgress(10)
    const interval = setInterval(() => {
      setStepIndex((prev) => (prev >= MOVE_STEPS.length - 1 ? prev : prev + 1))
      setProgress((prev) => Math.min(prev + 20, 85))
    }, 700)
    return () => clearInterval(interval)
  }, [status])

  async function handleSubmit() {
    setStatus("loading")
    setError(undefined)
    try {
      await onConfirm(toBrand, toProfileId === NONE_PROFILE ? null : toProfileId || null)
      setProgress(100)
      setStatus("success")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Move failed")
      setStatus("error")
    }
  }

  // Group profiles by department for the select
  const profilesByDept = React.useMemo(() => {
    const map = new Map<string, ProfileOption[]>()
    for (const p of profiles) {
      const dept = p.department ?? "Other"
      if (!map.has(dept)) map.set(dept, [])
      map.get(dept)!.push(p)
    }
    return map
  }, [profiles])

  const pnrCount = pnrList.length
  const isAllMode = pnrCount === 0

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => {
        if (!v && status !== "loading") onClose()
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Move PNR</DialogTitle>
        </DialogHeader>

        {status === "idle" && (
          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">
              {isAllMode
                ? "Move all PNRs in the current queue."
                : `Move ${pnrCount} selected PNR${pnrCount !== 1 ? "s" : ""}.`}
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Destination Brand</label>
              <Select value={toBrand} onValueChange={setToBrand}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select brand" />
                </SelectTrigger>
                <SelectContent>
                  {availableBrands.map((b) => (
                    <SelectItem key={b} value={b} className="text-xs">
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Transfer To</label>
              <Select
                value={toProfileId}
                onValueChange={setToProfileId}
                disabled={profilesLoading}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue
                    placeholder={profilesLoading ? "Loading users..." : "Select user (optional)"}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_PROFILE} className="text-xs text-muted-foreground">
                    — No change —
                  </SelectItem>
                  {Array.from(profilesByDept.entries()).map(([dept, deptProfiles]) => (
                    <SelectGroup key={dept}>
                      <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {dept}
                      </SelectLabel>
                      {deptProfiles.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.full_name ?? p.email}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {status === "loading" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="animate-spin">
              <div className="h-8 w-8 rounded-full border-4 border-blue-100 border-t-blue-500" />
            </div>
            <p className="text-sm font-semibold">Moving PNRs</p>
            <p className="text-center text-xs text-muted-foreground">
              {MOVE_STEPS[stepIndex]}
            </p>
            <div className="w-full">
              <Progress value={progress} className="h-1.5" />
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="text-green-600">
              <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p className="text-sm font-semibold">
              {pnrCount === 0 ? "Queue moved" : `${pnrCount} PNR${pnrCount !== 1 ? "s" : ""} moved`} to {toBrand}
            </p>
            <div className="w-full">
              <Progress value={100} className="h-1.5" />
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="text-destructive">
              <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p className="text-sm font-semibold text-destructive">Move Failed</p>
            {error && <p className="text-center text-xs text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter className="gap-2">
          {status === "idle" && (
            <>
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-blue-600 hover:bg-blue-600/90"
                onClick={handleSubmit}
                disabled={!toBrand}
                autoFocus
              >
                Move
              </Button>
            </>
          )}
          {(status === "success" || status === "error") && (
            <Button type="button" size="sm" onClick={onClose} autoFocus>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

/**
 * PNR Work Dashboard - Pre Departure Module
 *
 * Action permissions displayed here are specific to the Pre Departure module only.
 * - Super Admin: All actions enabled by default
 * - Admin/User: Actions controlled by role_permissions table
 */
export function PnrWorkDashboard({
  role = "user",
  profileId,
  permissions,
  userName,
  route,
}: {
  role?: string
  profileId?: string
  permissions?: PermissionMap | null
  userName?: string
  /** Brand, queue tab, open PNR and detail tab resolved from the URL. */
  route: PreDepartureRoute
}) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [themeMounted, setThemeMounted] = React.useState(false)
  React.useEffect(() => setThemeMounted(true), [])

  // Brands visible to this user — IT is Super Admin only
  const availableBrands = React.useMemo(() => visibleBrands(role), [role])

  // Live Supabase subscription: any pnr_queue change invalidates the queue cache
  useQueueRealtime()

  // Everything the URL pins is seeded from `route`. The brand is a route, not a
  // filter, so it is always a concrete brand here rather than "all".
  const [filters, setFilters] = React.useState<PnrFilters>({
    pnr: "",
    brand: route.brand,
    admin: "all",
    statusFilter: "all",
    ff: "all",
  })
  const [committedFilters, setCommittedFilters] =
    React.useState<PnrFilters>(filters)
  const [rightTab, setRightTab] = React.useState<QueueTab>(route.queueTab)
  const [selectedPnr, setSelectedPnr] = React.useState<string | null>(route.pnr)
  const [scanBrand, setScanBrand] = React.useState<Brand>(route.brand)
  const sheetImport = useSheetImport()
  const sabreFetch = useSabrePnrFetch()
  const [detailTab, setDetailTab] = React.useState<DetailTab>(route.detailTab)
  const [localStatuses, setLocalStatuses] = React.useState<
    Map<string, DashboardPnrItem["statuses"]>
  >(new Map())
  const [actionLoading, setActionLoading] = React.useState<
    Record<string, string>
  >({})

  // ─── Selection state (lifted from PnrQueueTable) ──────────────────────────
  const [exceptionSelectedPnrs, setExceptionSelectedPnrs] = React.useState<Set<string>>(new Set())
  const [rightSelectedPnrs, setRightSelectedPnrs] = React.useState<Set<string>>(new Set())

  const allSelectedPnrs = React.useMemo(
    () => new Set([...exceptionSelectedPnrs, ...rightSelectedPnrs]),
    [exceptionSelectedPnrs, rightSelectedPnrs]
  )
  const totalSelected = allSelectedPnrs.size

  // ─── Drawers ──────────────────────────────────────────────────────────────
  const [healthOpen, setHealthOpen] = React.useState(false)

  // ─── Scanned By filter (Admin + Super Admin) ──────────────────────────────
  // Admins and Super Admins see the whole queue and can view it as any user.
  // The `user` role is scoped server-side to its own PNRs and gets no picker.
  const canViewAllProfiles = role === "admin" || role === "super_admin"
  const [scannedByFilter, setScannedByFilter] = React.useState<string>("all")
  const [allProfiles, setAllProfiles] = React.useState<ProfileOption[]>([])
  React.useEffect(() => {
    if (!canViewAllProfiles) return
    fetch("/api/profiles")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ProfileOption[]) => setAllProfiles(Array.isArray(data) ? data : []))
      .catch(() => setAllProfiles([]))
  }, [canViewAllProfiles])

  // ─── Delete dialog state ──────────────────────────────────────────────────
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deleteProgressModal, setDeleteProgressModal] = React.useState<{
    isOpen: boolean
    status: "pending" | "success" | "error"
    deletedCount: number
    error?: string
  }>({ isOpen: false, status: "pending", deletedCount: 0 })

  // ─── Move dialog state ────────────────────────────────────────────────────
  const [moveDialogOpen, setMoveDialogOpen] = React.useState(false)

  // AbortController ref for cancellable draft request
  const draftAbortRef = React.useRef<AbortController | null>(null)

  // Uncontrolled search input refs (avoids header effect re-running on every keystroke)
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const searchDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const [operationModal, setOperationModal] = React.useState<{
    isOpen: boolean
    status: OperationStatus
    operation: string
    currentStep: string
    error?: string
    onRetry?: () => void
    showCancelButton?: boolean
  }>({
    isOpen: false,
    status: "idle",
    operation: "",
    currentStep: "",
    showCancelButton: true,
  })

  const [draftModal, setDraftModal] = React.useState<{
    isOpen: boolean
    status: "pending" | "success" | "error"
    error?: string
  }>({ isOpen: false, status: "pending" })

  /**
   * Mirror the view into the URL. The URL is the shareable copy of this state, not its
   * source: a tab click updates state immediately and only then rewrites the path, so
   * the UI never waits on the server round-trip this dynamic route costs. `replace` is
   * deliberate — browsing the queue should not fill the history stack with every row
   * and tab visited. Brand changes push, since those are a different queue.
   */
  function syncRoute(next: Partial<PreDepartureRoute>, mode: "push" | "replace" = "replace") {
    const path = preDeparturePath({
      brand: scanBrand,
      queueTab: rightTab,
      pnr: selectedPnr,
      detailTab,
      ...next,
    })
    router[mode](path, { scroll: false })
  }

  function handleSelectPnr(pnr: string | null) {
    if (selectedPnr && selectedPnr !== pnr) {
      void queryClient.cancelQueries({ queryKey: ["pnr-detail", selectedPnr] })
    }
    setSelectedPnr(pnr)
    syncRoute({ pnr })
  }

  function handleDetailTabChange(tab: string) {
    const detail = asDetailTab(tab, role)
    setDetailTab(detail)
    syncRoute({ detailTab: detail })
  }

  function handleRightTabChange(tab: QueueTab) {
    setRightTab(tab)
    syncRoute({ queueTab: tab })
  }

  // The other direction of that mirror: back/forward, a pasted link, or a canonical
  // redirect from the server changes `route` underneath us, and the view has to follow.
  React.useEffect(() => {
    setScanBrand(route.brand)
    setRightTab(route.queueTab)
    setSelectedPnr(route.pnr)
    setDetailTab(route.detailTab)
    setFilters((prev) =>
      prev.brand === route.brand ? prev : { ...prev, brand: route.brand }
    )
    setCommittedFilters((prev) =>
      prev.brand === route.brand ? prev : { ...prev, brand: route.brand }
    )
  }, [route.brand, route.queueTab, route.pnr, route.detailTab])

  function showOperationModal(
    operation: string,
    status: OperationStatus = "pending",
    currentStep?: string,
    error?: string,
    onRetry?: () => void,
    showCancelButton: boolean = true
  ) {
    setOperationModal({
      isOpen: true,
      status,
      operation,
      currentStep: currentStep ?? "",
      error,
      onRetry,
      showCancelButton,
    })
  }

  function closeOperationModal() {
    if (operationModal.status === "success") {
      void queryClient.invalidateQueries({ queryKey: ["pnr-queue"] })
    }
    setOperationModal((prev) => ({ ...prev, isOpen: false }))
  }

  async function handleDeleteConfirm() {
    const pnrsToDelete =
      totalSelected > 0
        ? Array.from(allSelectedPnrs)
        : [...exceptionRows, ...pendingRows, ...completeRows].map((r) => r.pnr)

    if (pnrsToDelete.length === 0) {
      toast.info("No PNRs to delete")
      setDeleteDialogOpen(false)
      return
    }

    // Close confirmation dialog, open progress dialog
    setDeleteDialogOpen(false)
    setDeleteProgressModal({ isOpen: true, status: "pending", deletedCount: 0 })

    try {
      const res = await fetch("/api/pnr-queue/delete-selected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pnrs: pnrsToDelete }),
      })
      const json = (await res.json().catch(() => null)) as {
        success?: boolean
        deleted?: number
        error?: string
        sheetErrors?: string[]
      } | null

      if (!res.ok) {
        const errorMsg = json?.error ?? `Delete failed (${res.status})`
        const details = json?.sheetErrors ? `\n${json.sheetErrors.join("\n")}` : ""
        setDeleteProgressModal({
          isOpen: true,
          status: "error",
          deletedCount: 0,
          error: errorMsg + details,
        })
        return
      }

      const deletedCount = json?.deleted ?? 0

      // Drop all cached queue/detail data so no stale rows are shown during the
      // subsequent refetch. removeQueries wipes the cache immediately; the next
      // active subscriber triggers a fresh network request.
      queryClient.removeQueries({ queryKey: ["pnr-queue"] })
      queryClient.removeQueries({ queryKey: ["pnr-detail"] })

      // Reset local UI state
      setExceptionSelectedPnrs(new Set())
      setRightSelectedPnrs(new Set())
      setLocalStatuses(new Map())

      // Clear selected PNR if it was deleted
      if (selectedPnr && pnrsToDelete.some((p) => p.toUpperCase() === selectedPnr.toUpperCase())) {
        handleSelectPnr(null)
      }

      // Check for sheet operation errors
      if (json?.sheetErrors && json.sheetErrors.length > 0) {
        const errorMsg = `Deleted from database (${deletedCount} PNRs) but sheet operations failed:\n${json.sheetErrors.join("\n")}`
        await queryClient.invalidateQueries({ queryKey: ["pnr-queue"] })
        setDeleteProgressModal({
          isOpen: true,
          status: "error",
          deletedCount,
          error: errorMsg,
        })
        return
      }

      // Trigger fresh fetch now that cache is empty
      await queryClient.invalidateQueries({ queryKey: ["pnr-queue"] })

      // Drop the Next.js Router Cache too. Without this, navigating away and back
      // replays the RSC payload rendered before the delete, re-hydrating the queue
      // with rows that no longer exist.
      router.refresh()

      // Close modal after refresh completes
      setDeleteProgressModal({ isOpen: true, status: "success", deletedCount })
    } catch (e) {
      setDeleteProgressModal({
        isOpen: true,
        status: "error",
        deletedCount: 0,
        error: e instanceof Error ? e.message : "Delete failed",
      })
    }
  }

  async function handleMoveConfirm(toBrand: string, toProfileId: string | null) {
    const pnrsToMove =
      totalSelected > 0
        ? Array.from(allSelectedPnrs)
        : [...exceptionRows, ...pendingRows, ...completeRows].map((r) => r.pnr)

    if (pnrsToMove.length === 0) {
      throw new Error("No PNRs to move")
    }

    const res = await fetch("/api/pnr-queue/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pnrs: pnrsToMove, toBrand, toProfileId }),
    })
    const json = (await res.json().catch(() => null)) as {
      success?: boolean
      moved?: number
      error?: string
    } | null

    if (!res.ok) {
      throw new Error(json?.error ?? `Move failed (${res.status})`)
    }

    toast.success(`Moved ${json?.moved ?? 0} PNR${(json?.moved ?? 0) !== 1 ? "s" : ""} to ${toBrand}`)
    setExceptionSelectedPnrs(new Set())
    setRightSelectedPnrs(new Set())

    // A move rewrites the row's brand and can reassign its owner, so any cached
    // detail or locally-computed status for those PNRs is now wrong.
    const movedKeys = new Set(pnrsToMove.map((p) => p.toUpperCase()))
    for (const pnr of pnrsToMove) {
      queryClient.removeQueries({ queryKey: ["pnr-detail", pnr] })
    }
    setLocalStatuses((prev) => {
      if (prev.size === 0) return prev
      const next = new Map(prev)
      for (const key of prev.keys()) {
        if (movedKeys.has(key.toUpperCase())) next.delete(key)
      }
      return next.size === prev.size ? prev : next
    })

    // The open PNR may have left this view entirely — a different brand, or another
    // user's queue once added_by is reassigned. Close the panel rather than leave it
    // showing a row that is no longer listed.
    if (selectedPnr && movedKeys.has(selectedPnr.toUpperCase())) {
      handleSelectPnr(null)
    }

    await queryClient.invalidateQueries({ queryKey: ["pnr-queue"] })

    // Drop the Next.js Router Cache too, so the prefetched RSC payload cannot
    // re-hydrate these PNRs under their old brand or owner.
    router.refresh()
  }

  function handleDraftModalClose() {
    draftAbortRef.current?.abort()
    setDraftModal((prev) => ({ ...prev, isOpen: false }))
  }

  // Queue data via TanStack Query
  const {
    data: rawItems,
    isFetching: queueFetching,
    isLoading: queueLoading,
    error: queueError,
  } = usePnrQueue({
    pnr: committedFilters.pnr,
    brand: committedFilters.brand,
    admin: committedFilters.admin,
    statusFilter: committedFilters.statusFilter,
    ff: committedFilters.ff,
  })


  // Merge server items with locally-computed statuses (after PNR detail load)
  const items: DashboardPnrItem[] = React.useMemo(() => {
    let base = rawItems ?? []
    if (canViewAllProfiles && scannedByFilter !== "all") {
      base = base.filter(
        (it) => (it.scannedBy ?? "").trim().toLowerCase() === scannedByFilter.trim().toLowerCase()
      )
    }
    if (localStatuses.size === 0) return base
    return base.map((it) => {
      const overrideStatuses = localStatuses.get(it.pnr)
      return overrideStatuses ? { ...it, statuses: overrideStatuses } : it
    })
  }, [rawItems, localStatuses, canViewAllProfiles, scannedByFilter])

  const exceptionRows = React.useMemo(
    () => items.filter((i) => i.statusRaw.toLowerCase() === "exception"),
    [items]
  )
  const pendingRows = React.useMemo(
    () => items.filter((i) => i.statusRaw.toLowerCase() === "pending"),
    [items]
  )
  const completeRows = React.useMemo(
    () => items.filter((i) => (i.statusRaw || "").toLowerCase() === "done"),
    [items]
  )

  // Counts for status filter badges and health drawer
  const counts = React.useMemo(
    () => ({
      all: items.length,
      exception: exceptionRows.length,
      pending: pendingRows.length,
      complete: completeRows.length,
    }),
    [items, exceptionRows, pendingRows, completeRows]
  )

  // Selected PNR's client name for sticky header
  const selectedClient = React.useMemo(
    () => items.find((i) => i.pnr === selectedPnr)?.client,
    [items, selectedPnr]
  )

  // Detail data via TanStack Query
  const { data: detailData, isFetching: detailLoading } = usePnrDetail(
    selectedPnr,
    committedFilters.brand
  )

  const pnrData = detailData?.pnrData ?? null
  const p3Result = detailData?.p3Result ?? null
  const p3Skipped = detailData?.p3Skipped ?? false
  const tickets = detailData?.tickets ?? null
  const ticketParseIssue = detailData?.ticketParseIssue ?? null
  const ticketFetchFailed = detailData?.ticketFetchFailed ?? false
  const jsonError = detailData?.jsonError ?? null
  const snapshotRaw = detailData?.snapshotRaw ?? null

  function handleSearchInputChange(value: string) {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      startTransition(() => {
        setCommittedFilters((prev) => ({ ...prev, pnr: value }))
      })
    }, 500)
  }

  function handleScanBrandChange(value: string) {
    const brand = availableBrands.find((b) => b === value) ?? scanBrand
    setScanBrand(brand)
    startTransition(() => {
      setFilters((prev) => ({ ...prev, brand }))
      setCommittedFilters((prev) => ({ ...prev, brand }))
    })
    // The open PNR belongs to the brand being left, so close the panel rather than keep
    // a record from another brand's queue on screen — and keep it out of the path,
    // where `/pre-departure/{brand}/…/{pnr}` would be a shareable but wrong link.
    if (selectedPnr) {
      void queryClient.cancelQueries({ queryKey: ["pnr-detail", selectedPnr] })
      setSelectedPnr(null)
    }
    syncRoute({ brand, pnr: null }, "push")
  }

  function handleSearchSubmit() {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    const value = searchInputRef.current?.value ?? ""
    startTransition(() => {
      setCommittedFilters((prev) => ({ ...prev, pnr: value }))
    })
  }

  function handleRefresh() {
    queryClient.removeQueries({ queryKey: ["pnr-queue"] })
    queryClient.removeQueries({ queryKey: ["pnr-detail"] })
    setLocalStatuses(new Map())
    setExceptionSelectedPnrs(new Set())
    setRightSelectedPnrs(new Set())
    void queryClient.invalidateQueries({ queryKey: ["pnr-queue"] })
    router.refresh()
  }

  async function handleScanSheet() {
    showOperationModal(
      "Scan Sheet",
      "pending",
      "Importing PNRs from Google Sheets...",
      undefined,
      undefined,
      false
    )

    let importData: Awaited<ReturnType<typeof sheetImport.mutateAsync>>
    try {
      importData = await sheetImport.mutateAsync(scanBrand)
    } catch (err) {
      showOperationModal(
        "Scan Sheet",
        "error",
        undefined,
        err instanceof Error ? err.message : "Sheet import failed",
        undefined,
        false
      )
      return
    }

    void queryClient.invalidateQueries({ queryKey: ["pnr-queue"] })

    const parts: string[] = [`${importData.imported} SYNCED`]
    if (importData.already_in_queue && importData.already_in_queue > 0)
      parts.push(`${importData.already_in_queue} DUPLICATED`)
    if (importData.no_flight && importData.no_flight > 0)
      parts.push(`${importData.no_flight} No Flight`)

    const pnrsToFetch = importData.pnrs ?? []
    if (pnrsToFetch.length === 0) {
      showOperationModal("Scan Sheet", "success", parts.join(" · "))
      return
    }

    // Sequential Sabre fetch for each newly imported PNR
    let fetchedCount = 0
    let failedCount = 0
    for (let i = 0; i < pnrsToFetch.length; i++) {
      const pnr = pnrsToFetch[i]
      showOperationModal(
        "Scan Sheet",
        "pending",
        `Fetching ${i + 1} / ${pnrsToFetch.length}: ${pnr}`,
        undefined,
        undefined,
        false
      )
      try {
        await sabreFetch.mutateAsync({
          pnr,
          brand: scanBrand,
          includeP3: true,
        })
        fetchedCount++
      } catch {
        failedCount++
      }
    }

    void queryClient.invalidateQueries({ queryKey: ["pnr-queue"] })

    parts.push(`${fetchedCount} Fetched from Sabre`)
    if (failedCount > 0) parts.push(`${failedCount} Failed`)
    showOperationModal(
      "Scan Sheet",
      fetchedCount > 0 || importData.imported === 0 ? "success" : "error",
      parts.join(" · ")
    )
  }

  function handleScanPnr(pnrToScan?: string, brandToScan?: string) {
    const pnr = pnrToScan ?? selectedPnr
    if (!pnr) return
    const row = items.find((item) => item.pnr === pnr)
    // The route pins a concrete brand, so the filter is always a usable fallback.
    const selectedBrand = brandToScan ?? row?.brand ?? committedFilters.brand
    const brandFilter = committedFilters.brand
    showOperationModal("Resync", "pending", "Starting scan...", undefined, undefined, false)

    sabreFetch.mutate(
      {
        pnr,
        brand: selectedBrand,
        includeP3: true,
      },
      {
        onSuccess: async () => {
          void queryClient.invalidateQueries({ queryKey: ["pnr-queue"] })
          await queryClient.invalidateQueries({
            queryKey: ["pnr-detail", pnr, brandFilter],
          })
          const detail = await queryClient.fetchQuery({
            queryKey: ["pnr-detail", pnr, brandFilter],
            queryFn: ({ signal }) =>
              fetchPnrDetail(pnr!, brandFilter, signal),
          })
          const statuses = dashboardStatusesFromDetailLike({
            pnrData: detail.pnrData,
            p3Result: detail.p3Result,
            p3Skipped: detail.p3Skipped,
            tickets: detail.tickets,
            ticketFetchFailed: detail.ticketFetchFailed,
          })
          if (statuses && pnr) {
            startTransition(() => {
              setLocalStatuses((prev) => {
                const next = new Map(prev)
                next.set(pnr, statuses)
                return next
              })
            })
          }
          showOperationModal("Resync", "success", "PNR has been imported.")
        },
        onError: (err) => {
          showOperationModal(
            "Resync",
            "error",
            undefined,
            err.message.slice(0, 300)
          )
        },
      }
    )
  }

  async function handleQueueAction(
    action: string,
    pnr: string,
    brand?: string
  ) {
    if (!brand) {
      toast.error(`Cannot ${action}: missing brand for ${pnr}`)
      return
    }

    setActionLoading((prev) => ({ ...prev, [pnr]: action }))

    try {
      if (action === "Resync") {
        await handleScanPnr(pnr, brand)
        return
      }

      if (action === "Draft") {
        const abortController = new AbortController()
        draftAbortRef.current = abortController
        setDraftModal({ isOpen: true, status: "pending" })
        try {
          const res = await fetch("/api/pnr-queue/draft", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pnr, brand }),
            signal: abortController.signal,
          })
          if (!res.ok) {
            const json = (await res.json().catch(() => null)) as {
              error?: string
            } | null
            setDraftModal({
              isOpen: true,
              status: "error",
              error: json?.error ?? `Draft failed (${res.status})`,
            })
          } else {
            setDraftModal({ isOpen: true, status: "success" })
            void queryClient.invalidateQueries({ queryKey: ["pnr-queue"] })
          }
        } catch (e) {
          if (e instanceof Error && e.name === "AbortError") return
          setDraftModal({
            isOpen: true,
            status: "error",
            error: e instanceof Error ? e.message : "Draft failed",
          })
        }
        return
      }

      let endpoint = ""
      let body: Record<string, unknown> = { pnr, brand }
      let onSuccessMsg = ""
      const isRevokeFromComplete = action === "Revoke-Complete"

      switch (action) {
        case "Approve":
          endpoint = "/api/pnr-queue/approve"
          onSuccessMsg = "Approved — moving to pending"
          break
        case "Done":
          endpoint = "/api/pnr-queue/done"
          onSuccessMsg = "Marked as done"
          break
        case "Revoke":
          endpoint = "/api/pnr-queue/revoke"
          onSuccessMsg = "Revoked successfully"
          break
        case "Revoke-Complete":
          endpoint = "/api/pnr-queue/revoke"
          body.from = "done"
          onSuccessMsg = "Revoked — moving back to pending"
          action = "Revoke"
          break
        default:
          toast.message(`${action} — ${pnr}`)
          return
      }

      const useModal = isRevokeFromComplete
      const modalTitle = "Revoke PNR"
      if (useModal) {
        showOperationModal(modalTitle, "pending", "Revoking PNR...")
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        const errMsg = json?.error ?? `${action} failed (${res.status})`
        if (useModal) {
          showOperationModal(modalTitle, "error", undefined, errMsg)
        } else {
          toast.error(errMsg)
        }
        return
      }

      if (useModal) {
        showOperationModal(modalTitle, "success", onSuccessMsg)
      } else {
        toast.success(onSuccessMsg)
      }
      void queryClient.invalidateQueries({ queryKey: ["pnr-queue"] })
    } finally {
      setActionLoading((prev) => {
        const updated = { ...prev }
        delete updated[pnr]
        return updated
      })
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const allVisibleCount =
    exceptionRows.length + pendingRows.length + completeRows.length

  const detailProps = {
    selectedPnr,
    client: selectedClient,
    brand: committedFilters.brand,
    pnrData,
    p3Result,
    p3Skipped,
    tickets,
    ticketParseIssue,
    ticketFetchFailed,
    jsonError,
    snapshotRaw,
    isLoading: detailLoading,
    detailTab,
    onDetailTabChange: handleDetailTabChange,
    onShowModal: showOperationModal,
    onCloseModal: closeOperationModal,
    role,
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">

      {/* ─── Header (PNR Dashboard design) ──────────────────────────────────── */}
      <header className="flex flex-none items-center gap-3 overflow-x-auto bg-primary px-6 py-3 shadow-[0_1px_3px_rgba(17,46,129,0.2)]">
        {/* Home + theme toggle */}
        <div className="flex shrink-0 items-center gap-1">
          <a
            href="/"
            aria-label="Home"
            className="grid size-9 place-items-center rounded-lg border border-white/25 bg-white/10 text-[#AACCD6] transition-colors hover:bg-white/20"
          >
            <HomeIcon className="size-4" />
          </a>
          <button
            type="button"
            aria-label="Toggle dark mode"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="grid size-9 place-items-center rounded-lg border border-white/25 bg-white/10 text-[#AACCD6] transition-colors hover:bg-white/20"
          >
            {themeMounted && resolvedTheme === "dark" ? (
              <SunIcon className="size-4" />
            ) : (
              <MoonIcon className="size-4" />
            )}
          </button>
        </div>

        {/* Search */}
        <div className="flex min-w-[240px] max-w-[480px] flex-1 items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-3 py-2">
            <SearchIcon className="size-4 shrink-0 text-[#AACCD6]" />
            <input
              ref={searchInputRef}
              placeholder="Search PNR"
              aria-label="Search PNR"
              defaultValue={committedFilters.pnr}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
              className="w-full bg-transparent text-sm font-medium tracking-[0.08em] text-white placeholder:text-[#AACCD6]/80 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleSearchSubmit}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-[#E7EEF1]"
          >
            Search
          </button>
        </div>

        {/* Reload */}
        <button
          type="button"
          title="Reload queue"
          onClick={handleRefresh}
          disabled={queueFetching}
          className="grid size-9 place-items-center rounded-lg border border-white/25 bg-white/10 text-[#AACCD6] transition-colors hover:bg-white/20 disabled:opacity-50"
        >
          <RefreshCwIcon className={cn("size-4", queueFetching && "animate-spin")} />
        </button>

        <div className="flex-1" />

        {/* Action group */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Reported → queue health drawer */}
          <button
            type="button"
            title="Queue health"
            onClick={() => setHealthOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-4 text-sm font-medium text-white transition-colors hover:bg-white/20"
          >
            <BarChart3Icon className="size-3.5 text-[#AACCD6]" />
            Reported
          </button>

          {/* Scan */}
          {isAllowed(permissions ?? null, "scan_pnr") && (
            <button
              type="button"
              onClick={handleScanSheet}
              disabled={sheetImport.isPending || sabreFetch.isPending}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#10B981] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0EA372] disabled:opacity-60"
            >
              {sheetImport.isPending || sabreFetch.isPending ? (
                <RefreshCwIcon className="size-3.5 animate-spin" />
              ) : (
                <ScanLineIcon className="size-3.5" />
              )}
              {sheetImport.isPending || sabreFetch.isPending
                ? "Scanning…"
                : `Scan ${scanBrand}`}
            </button>
          )}

          {/* Move PNR */}
          {isAllowed(permissions ?? null, "move_pnr") && (
            <button
              type="button"
              onClick={() => setMoveDialogOpen(true)}
              disabled={items.length === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#AACCD6] px-4 text-sm font-semibold text-primary transition-colors hover:bg-[#9BC0CC] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#AACCD6]"
            >
              {totalSelected > 0 ? `Move (${totalSelected})` : "Move PNR"}
            </button>
          )}

          {/* Delete — Admin/Super Admin only */}
          {(role === "admin" || role === "super_admin") &&
            isAllowed(permissions ?? null, "delete_pnr") && (
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={items.length === 0}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#EF4444] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#DC2626] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#EF4444]"
              >
                {totalSelected > 0 ? `Delete (${totalSelected})` : "Delete"}
              </button>
            )}
        </div>

        <div className="h-7 w-px shrink-0 bg-white/25" />

        {/* Scan brand */}
        <Select value={scanBrand} onValueChange={handleScanBrandChange}>
          <SelectTrigger className="h-9 w-auto shrink-0 gap-1.5 whitespace-nowrap rounded-lg border-transparent bg-transparent px-2.5 text-sm font-medium text-white shadow-none transition-colors hover:bg-white/10 *:data-[slot=select-value]:text-white [&_svg:not([class*='text-'])]:text-[#AACCD6]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableBrands.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* User — Admins and Super Admins get a picker of all profiles to filter by Scanned By */}
        {canViewAllProfiles ? (
          <Select value={scannedByFilter} onValueChange={setScannedByFilter}>
            <SelectTrigger className="h-auto w-auto shrink-0 gap-2 whitespace-nowrap rounded-lg border-transparent bg-transparent px-2.5 py-1.5 text-sm font-medium text-white shadow-none transition-colors hover:bg-white/10 *:data-[slot=select-value]:text-white [&_svg:not([class*='text-'])]:text-[#AACCD6]">
              <span className="inline-grid size-7 shrink-0 place-items-center rounded-full bg-[#AACCD6] text-center text-xs font-bold leading-none text-primary">
                {(scannedByFilter === "all" ? (userName ?? "?") : scannedByFilter)
                  .charAt(0)
                  .toUpperCase()}
              </span>
              <SelectValue>
                {scannedByFilter === "all"
                  ? (userName?.split(" ")[0] ?? "All")
                  : scannedByFilter.split(" ")[0]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">All users</SelectItem>
              {allProfiles
                .filter((p) => p.full_name)
                .map((p) => (
                  <SelectItem key={p.id} value={p.full_name as string}>
                    {p.full_name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        ) : (
          userName && (
            <div className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium text-white">
              <span className="inline-grid size-7 shrink-0 place-items-center rounded-full bg-[#AACCD6] text-center text-xs font-bold leading-none text-primary">
                {userName.charAt(0).toUpperCase()}
              </span>
              {userName.split(" ")[0]}
            </div>
          )
        )}
      </header>

      {/* ─── Content area ────────────────────────────────────────────────────── */}
      <PanelGroup orientation="vertical" className="flex min-h-0 flex-1 flex-col">

        {/* Queue section */}
        <Panel defaultSize={56} minSize={20}>
        <div
          className={cn(
            "flex h-full",
            queueFetching && !queueLoading && "opacity-50 transition-opacity duration-300"
          )}
        >
          {queueLoading ? (
            <div className="flex flex-1 min-w-0 gap-5 bg-background p-5 pb-3">
              <div className="flex flex-1 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(17,46,129,0.06)]">
                <PnrQueueSkeleton bare />
              </div>
              <div className="flex flex-1 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(17,46,129,0.06)]">
                <PnrQueueSkeleton bare />
              </div>
            </div>
          ) : (
            /* ── Dual column ───────────────────────────────────────────────── */
            <div className="flex flex-1 min-w-0 gap-5 bg-background p-5 pb-3">
              {/* Left pane: Exception */}
              <div className="flex flex-1 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(17,46,129,0.06)]">
                <div className="flex flex-none items-center gap-2.5 px-5 py-3.5">
                  <h2 className="text-[13px] font-semibold text-primary">Exception</h2>
                  <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-destructive">
                    {counts.exception} alerts
                  </span>
                </div>
                <div className="flex-1 min-h-0 overflow-auto [&_[data-slot=table-container]]:overflow-visible">
                  <PnrQueueTable
                    kind="exception"
                    rows={exceptionRows}
                    selectedPnr={selectedPnr}
                    onSelect={handleSelectPnr}
                    onAction={handleQueueAction}
                    actionLoading={actionLoading}
                    selectedPnrs={exceptionSelectedPnrs}
                    onSelectionChange={setExceptionSelectedPnrs}
                    role={role}
                    permissions={permissions}
                    bare
                  />
                </div>
              </div>

              {/* Right pane: Pending / Complete */}
              <div className="flex flex-1 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(17,46,129,0.06)]">
                <div className="flex flex-none items-center justify-between gap-3 px-5 pb-2 pt-2.5">
                  <span className="rounded-full bg-[#10B981]/12 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-[#047857]">
                    {rightTab === "pending" ? counts.pending : counts.complete} records
                  </span>
                  {/* Pending / Complete toggle */}
                  <div className="queue-status-tabs flex gap-2" role="tablist">
                    {(["pending", "complete"] as const).map((tab) => {
                      const active = rightTab === tab
                      return (
                        <button
                          key={tab}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => handleRightTabChange(tab)}
                          className={cn(
                            tab === "pending" ? "pending-tab" : "complete-tab",
                            "inline-flex h-8 items-center rounded-lg border px-4 text-[13px] font-semibold capitalize transition-all",
                            active
                              ? "border-primary bg-primary text-primary-foreground shadow-[0_1px_3px_rgba(17,46,129,0.3)]"
                              : "border-primary/35 bg-card text-primary hover:bg-accent dark:text-white"
                          )}
                        >
                          {tab}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-auto [&_[data-slot=table-container]]:overflow-visible">
                  {rightTab === "pending" ? (
                    <PnrQueueTable
                      kind="pending"
                      rows={pendingRows}
                      selectedPnr={selectedPnr}
                      onSelect={handleSelectPnr}
                      onAction={handleQueueAction}
                      actionLoading={actionLoading}
                      selectedPnrs={rightSelectedPnrs}
                      onSelectionChange={setRightSelectedPnrs}
                      role={role}
                      permissions={permissions}
                      bare
                    />
                  ) : (
                    <PnrQueueTable
                      kind="complete"
                      rows={completeRows}
                      selectedPnr={selectedPnr}
                      onSelect={handleSelectPnr}
                      onAction={(action, pnr, brand) =>
                        action === "Revoke"
                          ? handleQueueAction("Revoke-Complete", pnr, brand)
                          : handleQueueAction(action, pnr, brand)
                      }
                      actionLoading={actionLoading}
                      selectedPnrs={rightSelectedPnrs}
                      onSelectionChange={setRightSelectedPnrs}
                      role={role}
                      permissions={permissions}
                      bare
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        </Panel>

        <PanelResizeHandle className="group relative flex h-1.5 flex-none items-center justify-center border-t border-border bg-muted/30 hover:border-border/80 transition-colors data-[resize-handle-active]:border-border">
          <div className="h-0.5 w-8 rounded-full bg-border transition-colors group-hover:bg-muted-foreground/40 group-data-[resize-handle-active]:bg-muted-foreground/60" />
        </PanelResizeHandle>

        {/* ─── Detail panel ─────────────────────────────────────────────────── */}
        <Panel defaultSize={44} minSize={20}>
          <div className="flex h-full flex-col p-3">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <PnrDetailPanel {...detailProps} />
            </div>
          </div>
        </Panel>

      </PanelGroup>

      {/* ─── Delete Confirmation Dialog ─────────────────────────────────────── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="border-destructive/40">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <Trash2Icon className="size-4 text-destructive" />
            </div>
            <AlertDialogHeader className="flex-1 space-y-1">
              <AlertDialogTitle className="text-destructive">
                {totalSelected > 0
                  ? `Delete ${totalSelected} Selected PNR${totalSelected !== 1 ? "s" : ""}?`
                  : `Delete All ${allVisibleCount} PNR${allVisibleCount !== 1 ? "s" : ""}?`}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-destructive/70">
                {totalSelected > 0
                  ? `The ${totalSelected} checked PNR${totalSelected !== 1 ? "s" : ""} will be permanently removed from the queue and appended to the Done sheet tab. This action cannot be undone.`
                  : `All ${allVisibleCount} PNR${allVisibleCount !== 1 ? "s" : ""} in the queue will be permanently removed, their sheet rows deleted, and appended to the Done tab. This action cannot be undone.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              autoFocus
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive"
              onClick={(e) => {
                e.preventDefault()
                void handleDeleteConfirm()
              }}
            >
              <Trash2Icon className="me-1.5 size-3.5" />
              {totalSelected > 0
                ? `Delete ${totalSelected} PNR${totalSelected !== 1 ? "s" : ""}`
                : "Delete All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Delete Progress Modal ───────────────────────────────────────────── */}
      <DeleteProgressModal
        isOpen={deleteProgressModal.isOpen}
        status={deleteProgressModal.status}
        deletedCount={deleteProgressModal.deletedCount}
        error={deleteProgressModal.error}
        onClose={() =>
          setDeleteProgressModal((prev) => ({ ...prev, isOpen: false }))
        }
      />

      {/* ─── Move PNR Dialog ─────────────────────────────────────────────────── */}
      <MovePnrDialog
        isOpen={moveDialogOpen}
        onClose={() => setMoveDialogOpen(false)}
        pnrList={totalSelected > 0 ? Array.from(allSelectedPnrs) : []}
        defaultBrand={scanBrand}
        defaultProfileId={profileId}
        availableBrands={availableBrands}
        onConfirm={handleMoveConfirm}
      />

      <OperationModal
        isOpen={operationModal.isOpen}
        status={operationModal.status}
        operation={operationModal.operation}
        currentStep={operationModal.currentStep}
        error={operationModal.error}
        onClose={closeOperationModal}
        onRetry={operationModal.onRetry}
        showCancelButton={operationModal.showCancelButton}
      />

      <DraftModal
        isOpen={draftModal.isOpen}
        status={draftModal.status}
        error={draftModal.error}
        onClose={handleDraftModalClose}
      />

      {/* ─── Queue Health Drawer ─────────────────────────────────────────────── */}
      <PnrQueueHealthDrawer
        open={healthOpen}
        onClose={() => setHealthOpen(false)}
        counts={counts}
        items={items}
      />
    </div>
  )
}


"use client"

import * as React from "react"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { formatAdlDateTime } from "@/lib/datetime-adl"
import { cn } from "@/lib/utils"
import {
  useNotesForPnr,
  useCreateNote,
  useDeleteNote,
} from "@/hooks/use-pnr-notes"
import type { OperationStatus } from "@/components/ui/operation-modal"

const ADMIN_ROLE = "admin"
const ALL_USERS = ["admin", "Charlotte", "Alishia", "Emma", "Jodie"] as const

function formatNoteDate(iso: string): string {
  return formatAdlDateTime(iso)
}

export interface PnrNotesTabProps {
  pnr: string
  onShowModal?: (
    operation: string,
    status: OperationStatus,
    currentStep?: string,
    error?: string,
    onRetry?: () => void
  ) => void
  onCloseModal?: () => void
}

export function PnrNotesTab({
  pnr,
  onShowModal,
  onCloseModal,
}: PnrNotesTabProps) {
  const [noteText, setNoteText] = React.useState("")
  const [adminName, setAdminName] = React.useState<string>(ALL_USERS[0])

  const isAdmin = adminName === ADMIN_ROLE

  const { data: notes = [], isLoading, error } = useNotesForPnr(pnr)

  const {
    mutate: addNote,
    isPending: isAdding,
    step: addStep,
  } = useCreateNote()

  const {
    mutate: removeNote,
    isPending: isDeleting,
    step: deleteStep,
  } = useDeleteNote()

  // Show modal during create
  React.useEffect(() => {
    if (isAdding) {
      onShowModal?.("Saving Note", "pending", addStep)
    }
  }, [addStep, isAdding, onShowModal])

  // Show modal during delete
  React.useEffect(() => {
    if (isDeleting) {
      onShowModal?.("Deleting Note", "pending", deleteStep)
    }
  }, [deleteStep, isDeleting, onShowModal])

  function handleAdd() {
    const trimmed = noteText.trim()
    if (!trimmed) return
    addNote(
      { pnr, admin_name: adminName, note: trimmed },
      {
        onSuccess: () => {
          setNoteText("")
          toast.success("Note saved")
          onShowModal?.("Saving Note", "success")
          setTimeout(() => onCloseModal?.(), 1000)
        },
        onError: (e: Error) => {
          toast.error(e.message)
          onShowModal?.("Saving Note", "error", undefined, e.message, handleAdd)
        },
      }
    )
  }

  function handleDelete(created_at: string) {
    removeNote(
      { pnr, created_at },
      {
        onSuccess: () => {
          toast.success("Note deleted")
          onShowModal?.("Deleting Note", "success")
          setTimeout(() => onCloseModal?.(), 1000)
        },
        onError: (e: Error) => {
          toast.error(e.message)
          onShowModal?.("Deleting Note", "error", undefined, e.message)
        },
      }
    )
  }

  return (
    <div className="space-y-4">
      {/* Add note form */}
      <div className="space-y-2 rounded-lg border bg-card p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Logged in as:
          </span>
          <div className="flex flex-wrap gap-1">
            {ALL_USERS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAdminName(a)}
                className={cn(
                  "inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-medium transition-colors",
                  adminName === a
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                )}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <Textarea
          placeholder={`Write a note for PNR ${pnr}…`}
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd()
          }}
          className="min-h-[80px] resize-none text-sm"
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            ⌘ + Enter to save
          </span>
          <Button
            type="button"
            size="sm"
            className="h-7 gap-1 px-2.5 text-xs"
            disabled={!noteText.trim() || isAdding}
            onClick={handleAdd}
          >
            <PlusIcon className="size-3" />
            {isAdding ? "Saving…" : "Add Note"}
          </Button>
        </div>
      </div>

      {/* Notes list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-1.5 rounded-lg border p-3">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-xs text-destructive">
          Failed to load notes. Check Supabase connection.
        </p>
      ) : notes.length === 0 ? (
        <p className="text-xs text-muted-foreground">No notes yet for {pnr}.</p>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <div
              key={n.Created_at}
              className="group rounded-lg border bg-card p-3 text-sm"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {n.Note_By}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatNoteDate(n.Created_at)}
                  </span>
                </div>
                {(isAdmin || n.Note_By === adminName) && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-6 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                    disabled={isDeleting}
                    onClick={() => handleDelete(n.Created_at)}
                    aria-label="Delete note"
                  >
                    <Trash2Icon className="size-3" />
                  </Button>
                )}
              </div>
              <p className="text-xs leading-relaxed whitespace-pre-wrap text-foreground/80">
                {n.Notes}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

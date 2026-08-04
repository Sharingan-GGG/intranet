"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export type OperationStatus = "idle" | "pending" | "success" | "error"

export interface OperationModalProps {
  isOpen: boolean
  status: OperationStatus
  operation: string
  currentStep?: string
  progress?: number
  error?: string
  onClose: () => void
  onRetry?: () => void
  showCancelButton?: boolean
}

export function OperationModal({
  isOpen,
  status,
  operation,
  currentStep,
  error,
  onClose,
  onRetry,
  showCancelButton = true,
}: OperationModalProps) {
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
        className="max-w-sm"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{operation}</DialogTitle>
          <DialogDescription>{currentStep ?? operation}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-6">
          {status === "pending" && (
            <>
              <div className="animate-spin">
                <div className="h-8 w-8 rounded-full border-4 border-blue-200 border-t-blue-600" />
              </div>
              <p className="text-sm font-medium">{operation}</p>
              {currentStep && (
                <p className="text-center text-sm text-muted-foreground">
                  {currentStep}
                </p>
              )}
              {showCancelButton && (
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              )}
            </>
          )}

          {status === "success" && (
            <>
              <div className="text-green-600">
                <svg
                  className="h-8 w-8"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-green-600">Complete!</p>
              {currentStep && (
                <p className="text-center text-sm text-muted-foreground">
                  {currentStep}
                </p>
              )}
              {!currentStep && (
                <p className="text-sm text-muted-foreground">{operation}</p>
              )}
              <Button type="button" onClick={onClose}>
                OK
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <div className="text-red-600">
                <svg
                  className="h-8 w-8"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-red-600">Error</p>
              {error && (
                <p className="text-center text-sm text-red-600">{error}</p>
              )}
              <div className="flex flex-wrap justify-center gap-2">
                {onRetry && (
                  <Button type="button" onClick={onRetry}>
                    Retry
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={onClose}>
                  Close
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

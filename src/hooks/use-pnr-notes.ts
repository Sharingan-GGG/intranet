"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { PnrNote } from "@/lib/supabase/database.types"

export async function fetchNotes(pnr: string): Promise<PnrNote[]> {
  const res = await fetch(`/api/notes?pnr=${encodeURIComponent(pnr)}`)
  if (!res.ok) throw new Error("Failed to load notes")
  const json = (await res.json()) as { notes?: PnrNote[] }
  return json.notes ?? []
}

async function createNote(payload: {
  pnr: string
  admin_name: string
  note: string
}): Promise<PnrNote> {
  const res = await fetch("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = (await res.json()) as { error?: string }
    throw new Error(err.error ?? "Failed to save note")
  }
  const json = (await res.json()) as { note: PnrNote }
  return json.note
}

async function deleteNote(params: {
  pnr: string
  created_at: string
}): Promise<void> {
  const url = `/api/notes?pnr=${encodeURIComponent(params.pnr)}&created_at=${encodeURIComponent(params.created_at)}`
  const res = await fetch(url, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete note")
}

export function useNotesForPnr(pnr: string) {
  return useQuery({
    queryKey: ["pnr-notes", pnr],
    queryFn: () => fetchNotes(pnr),
    staleTime: 2 * 60 * 1000,
  })
}

export function useCreateNote() {
  const [step, setStep] = React.useState("")
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (payload: {
      pnr: string
      admin_name: string
      note: string
    }) => {
      setStep("Validating note...")
      if (!payload.note.trim()) throw new Error("Note cannot be empty")

      setStep("Saving to database...")
      const result = await createNote(payload)

      setStep("Updating UI...")
      qc.setQueryData<PnrNote[]>(["pnr-notes", payload.pnr], (prev = []) => [
        result,
        ...prev,
      ])

      return result
    },
  })

  return { ...mutation, step }
}

export function useDeleteNote() {
  const [step, setStep] = React.useState("")
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (params: { pnr: string; created_at: string }) => {
      setStep("Confirming deletion...")
      await deleteNote(params)

      setStep("Refreshing notes...")
      void qc.invalidateQueries({ queryKey: ["pnr-notes", params.pnr] })
    },
  })

  return { ...mutation, step }
}

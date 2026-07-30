"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

const STEPS = [
  "Connecting…",
  "Loading data…",
  "Preparing page…",
  "Almost ready…",
]

export function PageLoader() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => (s + 1) % STEPS.length)
    }, 900)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex w-[300px] flex-col items-center gap-4 rounded-xl border bg-card px-10 py-8 shadow-xl">
        <Loader2 className="size-12 animate-spin text-primary" />
        <p className="w-full text-center text-[14px] font-medium text-foreground">{STEPS[step]}</p>
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1 w-5 rounded-full transition-colors duration-300 ${i === step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

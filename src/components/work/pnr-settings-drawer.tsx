"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

export type PnrSettings = {
  fontSize: "sm" | "md" | "lg" | "xl"
  density: "compact" | "comfortable"
  showSignals: boolean
  showCountdown: boolean
}

export const DEFAULT_PNR_SETTINGS: PnrSettings = {
  fontSize: "md",
  density: "comfortable",
  showSignals: true,
  showCountdown: true,
}

const FS_SCALE: Record<PnrSettings["fontSize"], number> = {
  sm: 0.875,
  md: 1,
  lg: 1.075,
  xl: 1.18,
}

export function fsFontSizePx(fs: PnrSettings["fontSize"]): string {
  return `${Math.round(14 * FS_SCALE[fs])}px`
}

const STORAGE_KEY = "ctg_pnr_settings"

export function usePnrSettings(): [
  PnrSettings,
  (patch: Partial<PnrSettings>) => void,
] {
  const [s, setS] = React.useState<PnrSettings>(() => {
    if (typeof window === "undefined") return DEFAULT_PNR_SETTINGS
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return { ...DEFAULT_PNR_SETTINGS, ...JSON.parse(raw) }
    } catch {}
    return DEFAULT_PNR_SETTINGS
  })

  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    } catch {}
  }, [s])

  const set = React.useCallback(
    (patch: Partial<PnrSettings>) => setS((prev) => ({ ...prev, ...patch })),
    [],
  )

  return [s, set]
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

export function PnrSettingsDrawer({
  open,
  onClose,
  settings,
  onChange,
}: {
  open: boolean
  onClose: () => void
  settings: PnrSettings
  onChange: (patch: Partial<PnrSettings>) => void
}) {
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent
        side="right"
        className="flex w-[380px] flex-col overflow-y-auto sm:w-[420px]"
      >
        <SheetHeader className="border-b pb-4">
          <SheetTitle>Global Settings</SheetTitle>
          <p className="text-xs text-muted-foreground">
            Preferences saved per session and applied across all tables.
          </p>
        </SheetHeader>

        <div className="flex-1 space-y-7 px-4 py-6">
          {/* Display */}
          <SettingsSection
            title="Display"
            subtitle="Affects density and readability across all tables"
          >
            <SettingsField
              label="Font size"
              hint={
                {
                  sm: "Compact (87.5%)",
                  md: "Default (100%)",
                  lg: "Large (107.5%)",
                  xl: "Extra large (118%)",
                }[settings.fontSize]
              }
            >
              <Segmented
                value={settings.fontSize}
                onChange={(v) =>
                  onChange({ fontSize: v as PnrSettings["fontSize"] })
                }
                options={[
                  { v: "sm", label: "S", sub: "13px" },
                  { v: "md", label: "M", sub: "14px" },
                  { v: "lg", label: "L", sub: "15px" },
                  { v: "xl", label: "XL", sub: "16px" },
                ]}
              />
            </SettingsField>

            <SettingsField label="Row density">
              <Segmented
                value={settings.density}
                onChange={(v) =>
                  onChange({ density: v as PnrSettings["density"] })
                }
                options={[
                  { v: "compact", label: "Compact" },
                  { v: "comfortable", label: "Comfortable" },
                ]}
              />
            </SettingsField>
          </SettingsSection>

          {/* Queue options */}
          <SettingsSection title="Queue columns">
            <SettingsToggle
              label="Show signals"
              hint="Display FLT / P3 / TKT / MSG status dots on each row"
              value={settings.showSignals}
              onChange={(v) => onChange({ showSignals: v })}
            />
            <SettingsToggle
              label="Show departure countdown"
              hint="Display 'in 3d', 'Today', etc. under the departure date"
              value={settings.showCountdown}
              onChange={(v) => onChange({ showCountdown: v })}
            />
          </SettingsSection>

          {/* Keyboard shortcuts */}
          <SettingsSection
            title="Keyboard shortcuts"
            subtitle="Available throughout the app"
          >
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {[
                ["⌘K", "Focus search"],
                ["J / K", "Next / prev PNR"],
                ["1 / 2 / 3", "Switch status filter"],
                ["⌘,", "Open settings"],
              ].map(([k, l]) => (
                <div key={k} className="flex items-center gap-2">
                  <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                    {k}
                  </kbd>
                  <span className="text-muted-foreground">{l}</span>
                </div>
              ))}
            </div>
          </SettingsSection>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-4 pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(DEFAULT_PNR_SETTINGS)}
          >
            Reset to defaults
          </Button>
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SettingsSection({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-3">
        <p className="text-sm font-medium">{title}</p>
        {subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function SettingsField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        {hint && (
          <span className="text-[10px] text-muted-foreground">{hint}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { v: string; label: string; sub?: string }[]
}) {
  return (
    <div className="inline-flex w-full rounded-md border bg-muted p-0.5">
      {options.map((o) => {
        const active = value === o.v
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={`flex h-8 flex-1 items-center justify-center gap-1 rounded-[5px] text-xs font-medium transition-colors ${
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{o.label}</span>
            {o.sub && (
              <span className="text-[10px] opacity-60">{o.sub}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function SettingsToggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative mt-0.5 h-[18px] w-8 flex-shrink-0 rounded-full transition-colors ${
          value ? "bg-emerald-500" : "bg-input"
        }`}
      >
        <span
          className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-all ${
            value ? "left-[16px]" : "left-[2px]"
          }`}
        />
      </button>
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        {hint && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
        )}
      </div>
    </label>
  )
}

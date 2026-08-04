"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
// One source of truth: the brand list is also the set of valid `/pre-departure/{brand}`
// segments.
import { BRANDS } from "@/lib/pre-departure-route"
const ADMINS = [
  "all",
  "admin",
  "Charlotte",
  "Alishia",
  "Emma",
  "Jodie",
] as const
const STATUS_FILTERS = ["all", "pending", "exception"] as const
const FF_FILTERS = ["all", "YES", "NO"] as const

export type PnrFilters = {
  pnr: string
  brand: string
  admin: string
  statusFilter: string
  ff: string
}

type Props = {
  filters: PnrFilters
  rightTab: "pending" | "complete"
  onFiltersChange: (f: Partial<PnrFilters>) => void
  onRightTabChange: (v: "pending" | "complete") => void
  onSearch: () => void
  isLoading?: boolean
  availableBrands?: readonly string[]
}

const FILTER_DEFAULTS: Record<keyof PnrFilters, string> = {
  pnr: "",
  brand: "all",
  admin: "all",
  statusFilter: "all",
  ff: "all",
}

export function PnrFilterBar({
  filters,
  rightTab,
  onFiltersChange,
  onRightTabChange,
  onSearch,
  isLoading,
  availableBrands = BRANDS,
}: Props) {
  return (
    <div className="border-b pb-4">
      <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex max-w-xs flex-1 items-center gap-2">
              <Input
                placeholder="Search PNR"
                value={filters.pnr}
                onChange={(e) => onFiltersChange({ pnr: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
                className="h-8"
              />
              <Button
                type="button"
                size="sm"
                className="h-8"
                onClick={onSearch}
                disabled={isLoading}
              >
                Search
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={filters.brand}
                onValueChange={(v) => onFiltersChange({ brand: v })}
              >
                <SelectTrigger className="h-8 w-[7.5rem]">
                  <SelectValue placeholder="Brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All brands</SelectItem>
                  {availableBrands.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.admin}
                onValueChange={(v) => onFiltersChange({ admin: v })}
              >
                <SelectTrigger className="h-8 w-[8.5rem]">
                  <SelectValue placeholder="Admin" />
                </SelectTrigger>
                <SelectContent>
                  {ADMINS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a === "all" ? "All admins" : a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.statusFilter}
                onValueChange={(v) => onFiltersChange({ statusFilter: v })}
              >
                <SelectTrigger className="h-8 w-[7.5rem]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTERS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === "all" ? "All status" : s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filters.ff}
                onValueChange={(v) => onFiltersChange({ ff: v })}
              >
                <SelectTrigger className="h-8 w-[6.5rem]">
                  <SelectValue placeholder="FF" />
                </SelectTrigger>
                <SelectContent>
                  {FF_FILTERS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === "all" ? "All FF" : `FF ${s}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 self-end lg:self-start lg:pt-0.5">
          <Tabs
            value={rightTab}
            onValueChange={(v) => onRightTabChange(v as "pending" | "complete")}
          >
            <TabsList className="h-8 p-0.5">
              <TabsTrigger value="pending" className="h-7 px-3 text-xs">
                Pending
              </TabsTrigger>
              <TabsTrigger value="complete" className="h-7 px-3 text-xs">
                Complete
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

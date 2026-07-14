"use client"

import { cn } from "@/lib/utils"

interface AirlineMeta {
  name: string
  bg: string
  fg: string
}

const AIRLINES: Record<string, AirlineMeta> = {
  AC: { name: "Air Canada",          bg: "#d22630", fg: "#ffffff" },
  AY: { name: "Finnair",             bg: "#0b3d91", fg: "#ffffff" },
  JL: { name: "Japan Airlines",      bg: "#b51a2b", fg: "#ffffff" },
  LA: { name: "LATAM",               bg: "#0046ad", fg: "#ed1c24" },
  LH: { name: "Lufthansa",           bg: "#05164d", fg: "#f3c925" },
  LX: { name: "Swiss",               bg: "#cd2229", fg: "#ffffff" },
  NH: { name: "ANA",                 bg: "#13448f", fg: "#ffffff" },
  QF: { name: "Qantas",              bg: "#e10a0a", fg: "#ffffff" },
  SQ: { name: "Singapore Airlines",  bg: "#1a3668", fg: "#f5c451" },
  TK: { name: "Turkish Airlines",    bg: "#c70a0c", fg: "#ffffff" },
  WY: { name: "Oman Air",            bg: "#85754e", fg: "#ffffff" },
}

/** Logos live in /public/airline-logos/{CODE}.svg — served at /airline-logos/{CODE}.svg. */
export function airlineLogoUrl(code: string): string {
  return `/airline-logos/${code}.svg`
}

export const ALL_AIRLINES = Object.keys(AIRLINES).sort()
export function airlineMeta(code: string) { return AIRLINES[code] }
export function airlineHasLogo(code: string) { return Boolean(AIRLINES[code]) }
export function airlineName(code: string) { return AIRLINES[code]?.name ?? code }

export function AirlineMark({
  code,
  size = 22,
  className,
}: { code: string; size?: number; className?: string }) {
  const meta = AIRLINES[code]
  if (!meta) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded border font-mono text-[9px] font-bold",
          "border-primary/30 bg-primary/10 text-primary dark:bg-primary/20",
          className
        )}
        style={{ width: size, height: size }}
        title={code}
      >
        {code}
      </span>
    )
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={airlineLogoUrl(code)}
      alt={meta.name}
      title={meta.name}
      width={size}
      height={size}
      className={cn("inline-block shrink-0 rounded", className)}
      style={{ width: size, height: size, objectFit: "cover" }}
    />
  )
}

/** Merged Airline + Flight pill. */
export function FlightCell({
  code, flightNumber,
}: { code: string; flightNumber: string }) {
  const meta = AIRLINES[code]
  if (!meta) {
    return (
      <span className="inline-flex h-7 items-center rounded-md border border-primary/30 bg-primary/10 px-2.5 font-mono text-[12px] font-semibold text-primary dark:bg-primary/20">
        {code}&nbsp;{flightNumber}
      </span>
    )
  }
  return (
    <span className="inline-flex h-7 items-stretch overflow-hidden rounded-md border border-primary/30">
      <span className="inline-flex w-7 shrink-0 items-center justify-center bg-background">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={airlineLogoUrl(code)}
          alt={meta.name}
          title={meta.name}
          width={28}
          height={28}
          className="block size-7 object-cover"
        />
      </span>
      <span className="inline-flex items-center bg-primary/10 px-2.5 font-mono text-[12px] font-semibold text-primary dark:bg-primary/20">
        {code}&nbsp;{flightNumber}
      </span>
    </span>
  )
}

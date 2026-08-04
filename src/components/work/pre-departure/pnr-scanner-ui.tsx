import { LucideIcon, Search, Sidebar, RotateCw, AlertCircle, CheckCircle, Clock } from "lucide-react"

type IconName = "search" | "sidebar" | "reload" | "exception" | "done" | "pending"

const iconMap: Record<IconName, LucideIcon> = {
  search: Search,
  sidebar: Sidebar,
  reload: RotateCw,
  exception: AlertCircle,
  done: CheckCircle,
  pending: Clock,
}

export function ScannerIcon({ name, ...props }: { name: IconName; className?: string }) {
  const Icon = iconMap[name]
  return <Icon {...props} />
}

export const statusMeta: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400" },
  exception: { label: "Exception", color: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400" },
  done: { label: "Done", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
  "no-flight": { label: "No Flight", color: "bg-zinc-100 text-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400" },
  processing: { label: "Processing", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
}

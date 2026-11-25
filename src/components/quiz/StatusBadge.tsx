import { Check, Circle, CircleDashed, X } from 'lucide-react';
import type { CompletionStatus } from '../../lib/quiz/types';

// "Not started / In progress / Not passed / Completed" as a small shadcn-style badge.
// The WORD carries the meaning; the icon and fill are secondary cues (icons are aria-hidden).
// Record<CompletionStatus, …>: TypeScript errors if a status is ever added without a style.

const STYLES: Record<CompletionStatus, { label: string; className: string; Icon: typeof Check }> = {
  completed: { label: 'Completed', className: 'border-transparent bg-primary text-primary-foreground', Icon: Check },
  failed: { label: 'Not passed', className: 'border-destructive/40 text-destructive', Icon: X },
  in_progress: { label: 'In progress', className: 'border-transparent bg-secondary text-secondary-foreground', Icon: Circle },
  not_started: { label: 'Not started', className: 'text-muted-foreground', Icon: CircleDashed },
};

export function StatusBadge({ status }: { status: CompletionStatus }) {
  const { label, className, Icon } = STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${className}`}>
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}

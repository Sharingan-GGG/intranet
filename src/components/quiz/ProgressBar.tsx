// "Question 3 of 14 · 5 done" plus a thin bar.
// Shows WHERE you are (current) and HOW MUCH is done (answered): they differ when people skip around.
// role="progressbar" + aria-value* let screen readers announce the progress.

type Props = {
  /** 1-based position of the item on screen. */
  current: number;
  total: number;
  /** Items answered (choice questions) or finished (scenarios). */
  answered: number;
};

export function ProgressBar({ current, total, answered }: Props) {
  const pct = total ? Math.round((answered / total) * 100) : 0;
  return (
    <div className="w-full">
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="font-medium">
          Question {current} <span className="font-normal text-muted-foreground">of {total}</span>
        </span>
        <span className="text-muted-foreground">{answered} done</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-foreground/10"
        role="progressbar"
        aria-label="Questions done"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={answered}
        aria-valuetext={`${answered} of ${total} done`}
      >
        {/* Width is computed, so it's an inline style. Only width animates. */}
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

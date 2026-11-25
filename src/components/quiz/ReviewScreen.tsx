'use client';

import { ArrowLeft, ArrowRight, Info } from 'lucide-react';
import type { Ref } from 'react';
import { Button } from '@/components/ui/button';
import { describeAnswer, isItemDone, itemTitle, type QuizItem } from './items';
import { bigButton, card } from './ui';

// "Check your answers, then submit." Lists every item with what was chosen.
//   - Unfinished items are marked "Not answered" / "Not finished" and get a "Go to question N" shortcut.
//   - Submit is disabled until everything is done, and shows "Submitting…" while busy (aria-busy),
//     which also stops double submissions.
//   - aria-live: the warning is announced when it changes; role="alert": errors are announced at once.

type Props = {
  items: QuizItem[];
  answers: Record<string, string[]>;
  submitting: boolean;
  error: string | null;
  headingRef?: Ref<HTMLHeadingElement>;
  onEdit: (index: number) => void;
  onBack: () => void;
  onSubmit: () => void;
};

export function ReviewScreen({ items, answers, submitting, error, headingRef, onEdit, onBack, onSubmit }: Props) {
  const notDone = items.filter((item) => !isItemDone(item, answers)).length;
  const firstNotDone = items.findIndex((item) => !isItemDone(item, answers));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight">
          Review your answers
        </h1>
        <p className="mt-2 text-muted-foreground">Check your answers, then submit. You can still change any of them.</p>
      </div>

      <ol className={`${card} divide-y divide-foreground/10 overflow-hidden`}>
        {items.map((item, i) => {
          const done = isItemDone(item, answers);
          const answer = describeAnswer(item, answers[item.id]);
          return (
            <li key={item.id} className={`flex items-start justify-between gap-4 p-4 sm:p-5 ${done ? '' : 'bg-muted/50'}`}>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">
                  Question {i + 1}
                  {item.kind === 'simulation' && ' · Scenario'}
                </p>
                <p className="mt-0.5 font-medium">{itemTitle(item)}</p>
                {done ? (
                  <p className="mt-2 text-sm text-muted-foreground">{answer}</p>
                ) : (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-destructive">
                    <Info className="size-4" aria-hidden="true" />
                    {item.kind === 'simulation' ? 'Not finished' : 'Not answered'}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                onClick={() => onEdit(i)}
                disabled={submitting}
                className="shrink-0 border-foreground/20"
                aria-label={`Change answer to question ${i + 1}`}
              >
                Change
              </Button>
            </li>
          );
        })}
      </ol>

      <div aria-live="polite">
        {notDone > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2">
              <Info className="size-4 text-destructive" aria-hidden="true" />
              Finish every question before submitting ({notDone} left).
            </p>
            <Button variant="outline" onClick={() => onEdit(firstNotDone)} className="self-start">
              Go to question {firstNotDone + 1}
              <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button variant="outline" size="lg" onClick={onBack} disabled={submitting} className={`${bigButton} border-foreground/20`}>
          <ArrowLeft aria-hidden="true" />
          Back
        </Button>
        <Button size="lg" onClick={onSubmit} disabled={submitting || notDone > 0} aria-busy={submitting} className={bigButton}>
          {submitting ? 'Submitting…' : 'Submit answers'}
        </Button>
      </div>
    </div>
  );
}

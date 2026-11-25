'use client';

import { ArrowLeft, ArrowRight, Check, Flag, Mail, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatScore } from '../../lib/quiz/scoring';
import { ClickDemo } from './ClickDemo';
import { bigButton } from './ui';

// "HOW IT WORKS" WINDOW, shown before the quiz starts.
//
// Three short steps, each with a small click animation (ClickDemo):
//   1. Spot the red flags   2. Choose what you'd do   3. Review and submit
//
// FIRST TIME (required = true): it can only be closed with the confirm button on the last step.
// Escape is blocked, and there's no close (X) button. Confirming is what starts the quiz timer.
// REOPENED later from the "How it works" button (required = false): Escape and X close it.
//
// Built on the native <dialog> element with showModal(): the browser traps keyboard focus inside
// it, makes the page behind it inert, and puts it above everything (no z-index fights with the
// Intranet). The DOM stays inside the quiz wrapper, so quiz.css still applies.

type Props = {
  open: boolean;
  /** true = must confirm to close (first time). false = reopened, can be dismissed. */
  required: boolean;
  passMark: number;
  hasQuestions: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

const STEPS = ['Spot the red flags', 'Choose what you’d do', 'Review and submit'] as const;

export function HowItWorksDialog({ open, required, passMark, hasQuestions, onConfirm, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(0);
  const titleId = useId();
  const last = step === STEPS.length - 1;

  // Open / close the native dialog to match the `open` prop, with a short fade + rise.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        dialog.animate(
          [
            { opacity: 0, transform: 'translateY(8px) scale(0.98)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 200, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
        );
      }
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const finish = () => {
    setStep(0);
    onConfirm();
  };
  const dismiss = () => {
    setStep(0);
    onClose();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Escape fires "cancel". First time: blocked, they must confirm. Reopened: closes normally.
      onCancel={(e) => {
        e.preventDefault();
        if (!required) dismiss();
      }}
      className="m-auto w-[min(34rem,calc(100%-2rem))] rounded-xl border bg-background p-0 text-foreground shadow-lg backdrop:bg-black/50"
    >
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              How it works · Step {step + 1} of {STEPS.length}
            </p>
            <h2 id={titleId} className="mt-1 text-xl font-semibold tracking-tight">
              {STEPS[step]}
            </h2>
          </div>
          {!required && (
            <Button variant="ghost" size="icon" onClick={dismiss} aria-label="Close how it works">
              <X aria-hidden="true" />
            </Button>
          )}
        </div>

        {/* key={step}: each step gets a fresh demo, so its animation starts from the beginning. */}
        <div key={step} className="flex flex-col gap-4">
          {step === 0 && <FlagStep />}
          {step === 1 && <ActionStep />}
          {step === 2 && <SubmitStep passMark={passMark} hasQuestions={hasQuestions} />}
        </div>

        {/* Step dots: visual only; the "Step X of 3" text above says the same for screen readers. */}
        <div className="flex justify-center gap-1.5" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-foreground' : 'w-1.5 bg-muted-foreground/40'}`} />
          ))}
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button variant="outline" size="lg" onClick={() => setStep(step - 1)} disabled={step === 0} className={`${bigButton} disabled:invisible`}>
            <ArrowLeft aria-hidden="true" />
            Back
          </Button>
          {last ? (
            <Button size="lg" onClick={required ? finish : dismiss} className={bigButton} autoFocus>
              <Check aria-hidden="true" />
              {required ? 'I understand, start the quiz' : 'Got it'}
            </Button>
          ) : (
            <Button size="lg" onClick={() => setStep(step + 1)} className={bigButton} autoFocus>
              Next
              <ArrowRight aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </dialog>
  );
}

// ─── The three steps ──────────────────────────────────────────────────────────

function FlagStep() {
  return (
    <>
      <ClickDemo>
        <div className="rounded-md border bg-card p-3 text-sm">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="size-3.5" />
            accounts@harbourview-hotels.co
          </p>
          <p className="mt-2">Your booking will be cancelled.</p>
          <p className="mt-1">
            Please{' '}
            {/* Same look as a real hotspot: a small dashed box. */}
            <span data-demo-target className="relative inline-block rounded-md border border-dashed border-foreground/40 bg-muted/60 px-1 py-px">
              pay by 3 pm today
              {/* After the click: the phrase is marked (red fill + flag), like in the real quiz. */}
              <span data-demo-on className="absolute -inset-px inline-flex items-center gap-1 rounded-md border border-destructive bg-destructive px-1 font-medium text-background opacity-0">
                <Flag className="size-3" />
                pay by 3 pm
              </span>
            </span>
            .
          </p>
          <p className="relative mt-3 text-xs font-medium">
            <span data-demo-off className="inline-flex items-center gap-1.5">
              <Flag className="size-3.5 text-foreground/30" />0 marked
            </span>
            <span data-demo-on className="absolute inset-0 inline-flex items-center gap-1.5 opacity-0">
              <Flag className="size-3.5 fill-destructive text-destructive" />1 marked
            </span>
          </p>
        </div>
      </ClickDemo>
      <p className="text-sm leading-relaxed">
        Each scenario shows an email, text, chat or web page. <strong>Tap anything that looks suspicious</strong> to mark it as
        a red flag (tap again to unmark). <strong>Spotting the important red flags is part of getting it right.</strong>{' '}
        But <strong>some messages are genuine</strong>: if nothing looks wrong, don&apos;t mark anything, because marking
        things that aren&apos;t suspicious (false alarms) counts against you.
      </p>
    </>
  );
}

function ActionStep() {
  return (
    <>
      <ClickDemo>
        <p className="text-sm font-medium">What do you do?</p>
        <div className="mt-2 flex flex-col gap-2 text-sm">
          <span className="rounded-lg border bg-card px-3 py-2">Open the invoice</span>
          <span data-demo-target className="relative rounded-lg border bg-card px-3 py-2">
            Click &quot;Report phishing&quot;
            <span data-demo-on className="absolute inset-0 flex items-center gap-1.5 rounded-lg bg-foreground px-3 text-background opacity-0">
              <Check className="size-3.5" />
              Click &quot;Report phishing&quot;
            </span>
          </span>
        </div>
      </ClickDemo>
      <p className="text-sm leading-relaxed">
        <strong>Pick what you would really do.</strong> Some choices lead to another step. To get a scenario right, avoid
        anything unsafe and finish on the safest option. You won&apos;t see right or wrong until you submit.
      </p>
    </>
  );
}

function SubmitStep({ passMark, hasQuestions }: { passMark: number; hasQuestions: boolean }) {
  return (
    <>
      <ClickDemo>
        <ul className="flex flex-col gap-1.5 text-sm">
          {['The overdue invoice', 'A code you didn’t ask for'].map((t) => (
            <li key={t} className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5">
              <Check className="size-3.5" />
              {t}
            </li>
          ))}
        </ul>
        <span data-demo-target className="relative mt-3 inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">
          Submit answers
          <span data-demo-on className="absolute inset-0 flex items-center justify-center rounded-lg bg-primary opacity-0">
            Submitting…
          </span>
        </span>
      </ClickDemo>
      <p className="text-sm leading-relaxed">
        {hasQuestions && 'Some questions are multiple choice: pick your answer, then Next. '}
        At the end, <strong>check your answers on the review screen, then submit.</strong> You need{' '}
        <strong>{formatScore(passMark)}</strong> to pass. Every question has an explanation afterwards, and you can retake
        the quiz as many times as you need. Your answers are saved in this tab if you refresh.
      </p>
    </>
  );
}

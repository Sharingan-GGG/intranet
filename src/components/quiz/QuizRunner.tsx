'use client';

import { ArrowLeft, ArrowRight, CircleHelp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { AttemptResult, PublicQuiz, SubmitAttemptRequest } from '../../lib/quiz/types';
import { HowItWorksDialog } from './HowItWorksDialog';
import { answersForSubmit, isItemDone, quizItems } from './items';
import { API, resultPath } from './paths';
import { ProgressBar } from './ProgressBar';
import { QuestionCard } from './QuestionCard';
import { ReviewScreen } from './ReviewScreen';
import { clampView, maxView, toPlayState } from './simulation/play';
import { SimulationPlayer } from './simulation/SimulationPlayer';
import { bigButton, card } from './ui';

// THE ENGINE: moves between items, saves progress in this tab, submits.
//
// State machine (the quiz is always in exactly one Phase):
//
//   answering(index) ──Next on last──▶ review ──Submit──▶ submitting ──ok──▶ (go to result page)
//        ▲                              │                    │
//        └─────── Change / Back ────────┘◀────── error ──────┘
//
// Every button just calls go(nextPhase), so impossible states ("reviewing AND submitting")
// can't be written.
//
// SCENARIOS HAVE SEVERAL SCREENS. `step` is which screen of the current scenario is on show
// (0 = first; ignored for choice questions). Back / Next move through a scenario's screens first,
// then to the previous / next item. Going Back INTO a scenario lands on its last screen, so Back
// always retraces the exact route forward. It's saved with the phase, so a refresh keeps the place.

type Phase = { name: 'answering'; index: number; step?: number } | { name: 'review' } | { name: 'submitting' };
type Answers = SubmitAttemptRequest['answers'];
/**
 * `selection` = the item ids this progress belongs to. Each attempt has its own random set
 * (draw.ts), so progress saved for a different set (e.g. one replaced by a submit in another
 * tab) is thrown away instead of being mixed into the new one.
 */
type Saved = { answers: Answers; phase: Phase; startedAt: string; selection: string };

/** One saved attempt per quiz version, in sessionStorage (this tab only; cleared after submitting). */
const storageKey = (version: string) => `ctg-security-quiz:${version}`;

function readSaved(version: string, selection: string): Saved | null {
  try {
    const raw = sessionStorage.getItem(storageKey(version));
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Saved>;
    // Saved data comes from the browser: check its shape before trusting it.
    if (!s || typeof s.startedAt !== 'string' || typeof s.answers !== 'object' || !s.answers || !s.phase) return null;
    if (s.selection !== selection) return null; // saved for a different set of questions
    return s as Saved;
  } catch {
    return null;
  }
}

function writeSaved(version: string, saved: Saved | null) {
  try {
    if (saved) sessionStorage.setItem(storageKey(version), JSON.stringify(saved));
    else sessionStorage.removeItem(storageKey(version));
  } catch {
    /* storage unavailable (private mode etc.): progress just won't survive a refresh */
  }
}

export function QuizRunner({ quiz }: { quiz: PublicQuiz }) {
  const router = useRouter();
  const items = useMemo(() => quizItems(quiz), [quiz]);
  const total = items.length;
  const selection = items.map((it) => it.id).join(',');

  const [answers, setAnswers] = useState<Answers>({});
  const [phase, setPhase] = useState<Phase>({ name: 'answering', index: 0 });
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The How-it-works window: 'required' before a new attempt, 'reopened' from the button, else closed. */
  const [intro, setIntro] = useState<'closed' | 'required' | 'reopened'>('closed');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const navigated = useRef(false);

  // Effect 1, once: restore progress after a refresh, or (new attempt) show How it works first.
  // sessionStorage only exists in the browser, so this can't happen during the server render.
  useEffect(() => {
    const saved = readSaved(quiz.version, selection);
    /* eslint-disable react-hooks/set-state-in-effect -- one-time setup from browser storage */
    if (saved) {
      setAnswers(saved.answers);
      setPhase(saved.phase.name === 'submitting' ? { name: 'review' } : saved.phase); // refreshed mid-submit → review
      setStartedAt(saved.startedAt);
      return; // they've already seen How it works for this attempt
    }
    setIntro('required'); // the attempt starts when they confirm (beginAttempt)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [quiz.version, selection]);

  /** "I understand, start the quiz": the attempt (and its timer) begins now. */
  const beginAttempt = () => {
    setIntro('closed');
    setStartedAt(new Date().toISOString());
    // Tell the server "in progress". Best effort: the quiz still works if this fails.
    fetch(API.start, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quizVersion: quiz.version }),
    }).catch(() => {});
  };

  const introDialog = (
    <HowItWorksDialog
      open={intro !== 'closed'}
      required={intro === 'required'}
      passMark={quiz.passMark}
      hasQuestions={quiz.questions.length > 0}
      onConfirm={beginAttempt}
      onClose={() => setIntro('closed')}
    />
  );

  // Effect 2: auto-save after every change.
  useEffect(() => {
    if (startedAt && phase.name !== 'submitting') writeSaved(quiz.version, { answers, phase, startedAt, selection });
  }, [quiz.version, answers, phase, startedAt, selection]);

  // Effect 3: after the user moves (not on first load), go to the top and put keyboard focus on
  // the new heading, so keyboard and screen-reader users start at the new content.
  useEffect(() => {
    if (!navigated.current) return;
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [phase]);

  const go = (next: Phase) => {
    navigated.current = true;
    setError(null);
    setPhase(next);
  };

  const submit = async () => {
    if (!startedAt) return;
    go({ name: 'submitting' });
    try {
      const body: SubmitAttemptRequest = { quizVersion: quiz.version, startedAt, answers: answersForSubmit(items, answers) };
      const res = await fetch(API.submit, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<AttemptResult> & { error?: string };
      if (!res.ok || !data.attemptId) throw new Error(data.error ?? `Submission failed (${res.status}). Please try again.`);
      writeSaved(quiz.version, null);
      router.push(resultPath(data.attemptId));
    } catch (err) {
      setPhase({ name: 'review' });
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    }
  };

  /** Last screen of item i: a scenario's furthest screen (see maxView), 0 for a choice question. */
  const lastStep = (i: number) => {
    const it = items[i];
    return it?.kind === 'simulation' ? maxView(it.sim, toPlayState(it.sim, answers[it.id]).path) : 0;
  };

  if (total === 0) return <p className="text-muted-foreground">There are no questions in this quiz yet.</p>;
  if (!startedAt) {
    return (
      <>
        {introDialog}
        <p className="text-muted-foreground">{intro === 'required' ? 'Read how it works to begin.' : 'Loading…'}</p>
      </>
    );
  }

  if (phase.name !== 'answering') {
    return (
      <ReviewScreen
        items={items}
        answers={answers}
        submitting={phase.name === 'submitting'}
        error={error}
        headingRef={headingRef}
        onEdit={(index) => go({ name: 'answering', index, step: 0 })}
        onBack={() => go({ name: 'answering', index: total - 1, step: lastStep(total - 1) })}
        onSubmit={submit}
      />
    );
  }

  const index = Math.min(Math.max(phase.index, 0), total - 1); // saved index may be out of range
  const item = items[index];
  const done = items.filter((it) => isItemDone(it, answers)).length;
  const isLast = index === total - 1;
  const setPicks = (picks: string[]) => setAnswers((prev) => ({ ...prev, [item.id]: picks }));

  // Which screen of this scenario is on show (always 0 for a choice question).
  const step = item.kind === 'simulation' ? clampView(item.sim, toPlayState(item.sim, answers[item.id]).path, phase.step ?? 0) : 0;
  const atLastStep = step >= lastStep(index);

  /** Back: previous screen of this scenario, else the LAST screen of the previous item. */
  const back = () =>
    step > 0 ? go({ name: 'answering', index, step: step - 1 }) : go({ name: 'answering', index: index - 1, step: lastStep(index - 1) });

  /** Next: next screen of this scenario, else the FIRST screen of the next item (or the review). */
  const next = () => {
    if (!atLastStep) return go({ name: 'answering', index, step: step + 1 });
    go(isLast ? { name: 'review' } : { name: 'answering', index: index + 1, step: 0 });
  };

  return (
    <div className="flex flex-col gap-6">
      {introDialog}
      <div className={`${card} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-6 sm:px-5`}>
        <div className="flex-1">
          <ProgressBar current={index + 1} total={total} answered={done} />
        </div>
        <Button variant="outline" size="sm" onClick={() => setIntro('reopened')} className="self-start border-foreground/15 sm:self-auto">
          <CircleHelp aria-hidden="true" />
          How it works
        </Button>
      </div>

      {item.kind === 'question' ? (
        <QuestionCard
          key={item.id} // a fresh card per question
          question={item.question}
          number={index + 1}
          selected={answers[item.id] ?? []}
          onChange={setPicks}
          headingRef={headingRef}
        />
      ) : (
        <SimulationPlayer
          key={item.id}
          sim={item.sim}
          number={index + 1}
          picks={answers[item.id] ?? []}
          onChange={setPicks}
          view={step}
          // The full red-flag rule on the attempt's FIRST scenario; a one-line reminder on the rest.
          showRules={index === items.findIndex((it) => it.kind === 'simulation')}
          headingRef={headingRef}
        />
      )}

      <div className="flex items-center justify-between gap-3 border-t border-foreground/15 pt-6">
        {/* invisible (not removed) on the first item, so Next doesn't jump sideways */}
        <Button
          variant="outline"
          size="lg"
          // detail > 1 = second click of a double-click: ignored, so one double-click moves ONE screen.
          onClick={(e) => e.detail < 2 && back()}
          disabled={index === 0 && step === 0}
          className={`${bigButton} border-foreground/20 disabled:invisible`}
        >
          <ArrowLeft aria-hidden="true" />
          Back
        </Button>
        <Button size="lg" onClick={(e) => e.detail < 2 && next()} className={bigButton}>
          {isLast && atLastStep ? 'Review answers' : 'Next'}
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

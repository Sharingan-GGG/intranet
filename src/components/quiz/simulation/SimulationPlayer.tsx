'use client';

import { Check, ChevronRight, Flag } from 'lucide-react';
import type { ReactNode, Ref } from 'react';
import type { SimulationQuestion } from '../../../lib/quiz/simulation.types';
import { optionLetter, TOPIC_LABELS } from '../../../lib/quiz/types';
import { card, edge, stepNumber } from '../ui';
import { chooseAt, clampView, hotspotsByField, isSimulationFinished, toPicks, toPlayState, walk } from './play';
import { SimulationScreen } from './SimulationScreen';

// ONE interactive scenario inside the quiz. A simple, accessible player. The fuller "game"
// module can replace this later: it only has to produce the same answer array.
//
// How playing works:
//   1. The current step shows its scene (narration) and its screen (email, text, chat…).
//   2. The player taps anything suspicious (hotspots). Tap again to unmark. The scenario says how
//      many red flags to find (minFlags); finding enough REAL ones is part of getting it right.
//      The counter shows how many they've MARKED, never whether a mark is a real flag.
//   3. They pick one action. Picking only SELECTS it (highlighted as "Your choice"): the quiz's Next
//      button moves on, to the screen it leads to or past the scenario. Nothing moves on by itself,
//      so a double-click or a mis-tap can't carry anyone onto a screen they didn't ask for.
//   4. Finished: the final choice stays highlighted. No right/wrong yet: that's revealed after submitting.
//
// GOING BACK: the quiz's Back / Next buttons step through the screens of a scenario before moving
// to another question. `view` says which screen is on show. On a screen they already decided, their
// choice stays highlighted: Next keeps it, picking another changes it (see chooseAt in play.ts).
//
// DOUBLE-CLICKS: the second click of a double-click is ignored (event.detail > 1) on the choices
// and the red-flag spots, so it counts as one click instead of picking twice / marking then unmarking.
//
// LAYOUT: a header card (what this scenario is + the red-flag goal), then numbered step cards
// ("1 Read the message", "2 What do you do?"), so people always know what to do next.
//
// Like QuestionCard, this component holds no state of its own. It reads `picks` (the answer array
// QuizRunner stores) and reports changes with `onChange`, so progress is saved with the rest.

type Props = {
  sim: SimulationQuestion;
  number: number;
  /** [...action ids in order, ...hotspot ids tapped]: the format the server scores. */
  picks: string[];
  onChange: (picks: string[]) => void;
  /** Which screen of the scenario is on show (0 = first). Owned by QuizRunner (its Back / Next move it). */
  view: number;
  /** True for the FIRST scenario of the attempt: show the full "How red flags work" card. */
  showRules?: boolean;
  headingRef?: Ref<HTMLHeadingElement>;
};

export function SimulationPlayer({ sim, number, picks, onChange, view, showRules = false, headingRef }: Props) {
  const state = toPlayState(sim, picks);
  const shown = clampView(sim, state.path, view);
  // The screen on show = where the choices BEFORE it lead. Never null: clampView stops at the last screen.
  const { current, choices } = walk(sim, state.path.slice(0, shown));
  const selected = state.path[shown]; // their earlier choice on this screen, if any
  const finished = isSimulationFinished(sim, picks) && shown === state.path.length - 1;
  const tapped = new Set(state.tapped);
  const hasHotspots = Boolean(current?.screen && current.hotspots?.length);

  const toggleFlag = (hotspotId: string) =>
    onChange(toPicks({ ...state, tapped: tapped.has(hotspotId) ? state.tapped.filter((t) => t !== hotspotId) : [...state.tapped, hotspotId] }));

  // Selects only. The quiz's Next button moves on (see the comment at the top).
  const choose = (actionId: string) => onChange(chooseAt(sim, picks, shown, actionId));

  // Step numbers shift when a step has nothing to tap (e.g. a phone call with no hotspots).
  let step = 0;

  return (
    <section aria-labelledby={`sim-${sim.id}-title`} className="flex flex-col gap-5">
      {/* ── Header: what this is, plus the red-flag rule (no numbers, see RedFlagRules) ── */}
      <div className={`${card} p-5 sm:p-6`}>
        <p className="flex flex-wrap items-center gap-2 text-xs font-medium">
          <span className="rounded-full bg-muted px-2.5 py-1 text-foreground">{TOPIC_LABELS[sim.topic]}</span>
          <span className="text-muted-foreground">
            Scenario <span className="sr-only">(question {number})</span>
          </span>
        </p>
        <h2 id={`sim-${sim.id}-title`} ref={headingRef} tabIndex={-1} className="mt-3 text-xl leading-snug font-semibold text-pretty sm:text-2xl">
          {sim.title}
        </h2>
        <p className="mt-2 text-foreground/80">{sim.brief}</p>
        {showRules ? (
          <RedFlagRules />
        ) : (
          <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
            <Flag className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Mark only what looks suspicious. Some messages are genuine, and false alarms count.
          </p>
        )}
      </div>

      {choices.length > 0 && <ChoicesSoFar choices={choices} />}

      {current && (
        <>
          {/* ── Step: read (and mark) the screen ── */}
          {(current.narration || current.screen) && (
            <div className={`${card} p-5 sm:p-6`}>
              <StepHeading n={++step} title={hasHotspots ? 'Read it and mark anything suspicious' : 'Read what happens'} />
              {current.narration && (
                <p className="mt-4 rounded-lg bg-muted px-4 py-3 text-sm leading-relaxed italic">{current.narration}</p>
              )}
              {current.screen && (
                <div className="mt-4">
                  <SimulationScreen screen={current.screen} spots={hotspotsByField(current)} tapped={tapped} onToggle={toggleFlag} />
                </div>
              )}
              {hasHotspots && <FlagTracker marked={tapped.size} />}
            </div>
          )}

          {/* ── Step: decide ── */}
          <fieldset className={`${card} p-5 sm:p-6`}>
            <legend className="sr-only">What do you do?</legend>
            <StepHeading n={++step} title="What do you do?" aside={selected ? 'You can change your choice' : 'Pick one'} />
            <ul className="mt-4 flex flex-col gap-3">
              {current.actions.map((a, i) => {
                const isChoice = a.id === selected;
                return (
                  <li key={a.id}>
                    {/* A plain <button> styled as a choice card (like QuestionCard's options): the shadcn
                        outline button was white-on-white and didn't read as something to press.
                        aria-pressed tells screen readers which one is their current choice. */}
                    <button
                      type="button"
                      aria-pressed={isChoice}
                      onClick={(e) => e.detail < 2 && choose(a.id)}
                      className={`group flex min-h-14 w-full items-center gap-3 rounded-xl p-3 pr-4 text-left shadow-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground active:translate-y-px ${
                        isChoice ? 'border-2 border-foreground bg-muted' : `${edge} bg-card hover:border-foreground/40 hover:bg-muted`
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`flex size-8 shrink-0 items-center justify-center rounded-lg border-2 text-sm font-semibold transition-colors ${
                          isChoice
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-foreground/20 group-hover:border-foreground group-hover:bg-foreground group-hover:text-background'
                        }`}
                      >
                        {optionLetter(i)}
                      </span>
                      <span className="flex-1 font-medium">{a.label}</span>
                      {isChoice ? (
                        <span className="flex shrink-0 items-center gap-1 text-sm font-semibold">
                          <Check className="size-4" aria-hidden="true" />
                          Your choice
                        </span>
                      ) : (
                        <ChevronRight
                          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            {selected && (
              <p className={`mt-4 flex items-start gap-2.5 rounded-lg ${edge} bg-muted/50 px-4 py-3 text-sm`} aria-live="polite">
                {finished && (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                    <Check className="size-3" aria-hidden="true" />
                  </span>
                )}
                <span>
                  {finished && <strong className="font-semibold">Scenario finished. </strong>}
                  Press <strong className="font-semibold">Next</strong> to {finished ? 'continue' : 'see what happens'}, or pick a
                  different answer to change it.
                  {finished && ' You’ll see how you went after you submit the quiz.'}
                </span>
              </p>
            )}
          </fieldset>
        </>
      )}
    </section>
  );
}

/** "① Read the message ............ Pick one" */
function StepHeading({ n, title, aside }: { n: number; title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={stepNumber} aria-hidden="true">
        {n}
      </span>
      <h3 className="font-semibold">{title}</h3>
      {aside && <span className="ml-auto text-sm text-muted-foreground">{aside}</span>}
    </div>
  );
}

/**
 * The red-flag rule, in full: shown on the FIRST scenario of each attempt (and in How it works).
 * No numbers on purpose: "find at least N" gave answers away (N = 0 meant "this one is genuine").
 * The scoring behind it: simulation-scoring.ts (minFlags / maxFalseFlags, both private).
 */
function RedFlagRules() {
  return (
    <div className="mt-4 rounded-xl bg-foreground p-4 text-sm text-background">
      <p className="flex items-center gap-2 font-semibold">
        <Flag className="size-4" aria-hidden="true" />
        How red flags work
      </p>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-background/90">
        <li>Mark everything that looks suspicious, then choose what to do.</li>
        <li>Missing an important red flag makes the question wrong.</li>
        <li>
          <strong className="font-semibold text-background">Some messages are genuine.</strong> If nothing looks wrong, don’t
          mark anything. Marking things that aren’t suspicious (false alarms) counts against you.
        </li>
      </ul>
    </div>
  );
}

/**
 * "2 marked", with a flag icon that turns red once anything is marked. Counts MARKS only: it never
 * says how many there are to find, or whether a mark is a real red flag.
 */
function FlagTracker({ marked }: { marked: number }) {
  return (
    <div className={`mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg ${edge} bg-muted/50 px-4 py-3 text-sm`}>
      <p className="text-foreground/80">Tap words or parts that look suspicious. Tap again to unmark.</p>
      <p className="flex items-center gap-2 font-medium" aria-live="polite">
        <Flag className={`size-4 ${marked > 0 ? 'fill-destructive text-destructive' : 'text-foreground/30'}`} aria-hidden="true" />
        {marked} marked
      </p>
    </div>
  );
}

/** The actions already taken in this scenario, so the story so far is visible. */
function ChoicesSoFar({ choices }: { choices: string[] }) {
  return (
    <div className={`rounded-xl ${edge} bg-muted/50 px-5 py-4`}>
      <p className="text-sm font-semibold">Your choices so far</p>
      <ol className="mt-2 flex flex-col gap-1.5 text-sm">
        {choices.map((c, i) => (
          <li key={i} className="flex gap-2">
            <span className="font-medium text-muted-foreground">{i + 1}.</span>
            {c}
          </li>
        ))}
      </ol>
    </div>
  );
}

'use client';

import { Check } from 'lucide-react';
import type { Ref } from 'react';
import { optionLetter, TOPIC_LABELS, type PublicQuestion } from '../../lib/quiz/types';
import { card, edge, eyebrow } from './ui';

// ONE choice question (single answer, multiple answers, or true/false).
//
// "Lifting state up": this card doesn't remember what's selected. It receives `selected` and
// reports changes through `onChange`. QuizRunner owns all the answers (one source of truth).
//
// Accessibility: the real <input type="radio|checkbox"> is kept but visually hidden (sr-only).
// It still gets clicks (through its <label>), Tab focus, Space / arrow keys and screen-reader
// announcements. Next to it we draw our own indicator. `has-[:focus-visible]` puts the focus
// ring on the whole option card when its hidden input has keyboard focus.

type Props = {
  question: PublicQuestion;
  /** 1-based position in the quiz. */
  number: number;
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Gets focus when the question changes, so screen readers announce the new question. */
  headingRef?: Ref<HTMLHeadingElement>;
};

export function QuestionCard({ question, number, selected, onChange, headingRef }: Props) {
  const multi = question.type === 'multi';
  const trueFalse = question.type === 'truefalse';
  const hintId = `q-${question.id}-hint`;

  // Single / true-false REPLACE the selection; multi ADDS or REMOVES the clicked option.
  const toggle = (optionId: string) => {
    if (!multi) return onChange([optionId]);
    onChange(selected.includes(optionId) ? selected.filter((s) => s !== optionId) : [...selected, optionId]);
  };

  return (
    <fieldset aria-describedby={hintId} className={`${card} p-5 sm:p-6`}>
      <legend className="sr-only">Question {number}</legend>
      <p className={eyebrow}>{TOPIC_LABELS[question.topic]}</p>
      <h2 ref={headingRef} tabIndex={-1} className="mt-2 text-xl leading-snug font-semibold text-pretty">
        {trueFalse && <span className="text-muted-foreground">True or false: </span>}
        {question.prompt}
      </h2>
      <p id={hintId} className="mt-2 text-sm text-muted-foreground">
        {multi ? 'Select all that apply.' : 'Select one answer.'}
      </p>

      {question.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary screenshots; sizes unknown
        <img src={question.imageUrl} alt="Screenshot for this question" className={`mt-5 max-h-96 w-full rounded-lg ${edge} object-contain`} />
      )}

      <ul className={`mt-6 gap-3 ${trueFalse ? 'grid grid-cols-2' : 'flex flex-col'}`}>
        {question.options.map((opt, i) => {
          const checked = selected.includes(opt.id);
          return (
            <li key={opt.id}>
              <label
                className={`flex h-full min-h-14 cursor-pointer items-center gap-3 rounded-xl p-4 shadow-xs transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-foreground ${
                  checked ? 'border-2 border-foreground bg-muted' : `${edge} bg-card hover:border-foreground/40 hover:bg-muted`
                }`}
              >
                <input
                  type={multi ? 'checkbox' : 'radio'}
                  name={`q-${question.id}`}
                  value={opt.id}
                  checked={checked}
                  onChange={() => toggle(opt.id)}
                  className="sr-only"
                />
                {multi ? (
                  // Multiple answers: a checkbox square, ticked when selected.
                  <span
                    aria-hidden="true"
                    className={`flex size-5 shrink-0 items-center justify-center rounded border-2 ${
                      checked ? 'border-foreground bg-foreground text-background' : 'border-muted-foreground'
                    }`}
                  >
                    {checked && <Check className="size-3.5" />}
                  </span>
                ) : (
                  // One answer: a lettered circle (A–D); true/false: a circle with a tick.
                  <span
                    aria-hidden="true"
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                      checked ? 'border-foreground bg-foreground text-background' : 'border-muted-foreground text-muted-foreground'
                    }`}
                  >
                    {trueFalse ? checked && <Check className="size-3.5" /> : optionLetter(i)}
                  </span>
                )}
                <span className={trueFalse ? 'font-medium' : ''}>{opt.label}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

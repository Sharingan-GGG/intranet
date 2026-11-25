import { Check, ChevronRight, X } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { formatScore } from '../../lib/quiz/scoring';
import { TOPIC_LABELS, type AttemptResult, type PublicQuiz } from '../../lib/quiz/types';
import { describeAnswer, itemTitle, quizItems } from './items';
import { LocalTime } from './LocalTime';
import { SimulationReviewBlock } from './SimulationReviewBlock';
import { QUIZ_PATH, TAKE_PATH } from './paths';
import { bigButton, card, readable } from './ui';

// Score + per-question feedback. A server component: it only displays data.
//
// Gets the PUBLIC quiz (prompts, options, scenario steps: no answer key), the AttemptResult
// (score, correct yes/no, explanation per item) and the person's own answers.
// Explanations for WRONG items are open; right ones are folded away ("Why this is right"),
// so the page stays short but still teaches.

type Props = {
  result: AttemptResult;
  quiz: PublicQuiz;
  answers: Record<string, string[]>;
};

export function ResultScreen({ result, quiz, answers }: Props) {
  // Only the items this attempt was given, in the order taken: that's result.feedback's order
  // (each attempt has its own random selection, see draw.ts). `quiz` is the whole bank, used to look items up.
  const bank = new Map(quizItems(quiz).map((item) => [item.id, item]));
  const items = result.feedback.flatMap((f) => bank.get(f.questionId) ?? []);
  const feedback = new Map(result.feedback.map((f) => [f.questionId, f]));
  const wrong = items.filter((item) => !feedback.get(item.id)?.correct);
  const topicOf = (item: (typeof items)[number]) => TOPIC_LABELS[item.kind === 'question' ? item.question.topic : item.sim.topic];
  const wrongTopics = [...new Set(wrong.map(topicOf))];

  return (
    <div className="flex flex-col gap-10">
      <section className={`${card} p-6 sm:p-8`}>
        <p className={`inline-flex items-center gap-1.5 text-sm font-semibold ${result.passed ? '' : 'text-destructive'}`}>
          {result.passed ? <Check className="size-4" aria-hidden="true" /> : <X className="size-4" aria-hidden="true" />}
          {result.passed ? 'Passed' : 'Not passed yet'}
        </p>
        <h1 className="mt-3 flex flex-wrap items-baseline gap-x-3">
          <span className="text-5xl font-semibold tracking-tight tabular-nums">{formatScore(result.score)}</span>
          <span className="text-muted-foreground">
            {result.correctCount} of {result.total} correct
          </span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pass mark {formatScore(quiz.passMark)} · completed <LocalTime iso={result.completedAt} />
        </p>

        <p className={`mt-6 ${readable}`}>
          {result.passed
            ? 'Thanks, your completion has been recorded. The notes below are worth a quick read.'
            : 'Read the notes on the questions you missed, then try again. You can retake it as many times as you need.'}
        </p>
        {!result.passed && wrongTopics.length > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            Topics to revisit: <span className="font-medium text-foreground">{wrongTopics.join(', ')}</span>
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {!result.passed && (
            <Link href={TAKE_PATH} className={buttonVariants({ size: 'lg', className: bigButton })}>
              Retake quiz
            </Link>
          )}
          <Link
            href={QUIZ_PATH}
            className={buttonVariants({ size: 'lg', variant: result.passed ? 'default' : 'outline', className: bigButton })}
          >
            {result.passed ? 'Done' : 'Back to overview'}
          </Link>
        </div>
      </section>

      <section aria-labelledby="breakdown">
        <div className="flex items-baseline justify-between">
          <h2 id="breakdown" className="text-lg font-semibold">
            Your answers
          </h2>
          {wrong.length > 0 && <p className="text-sm text-muted-foreground">{wrong.length} to review</p>}
        </div>
        <ol className={`${card} mt-4 divide-y`}>
          {items.map((item, i) => {
            const fb = feedback.get(item.id);
            const ok = fb?.correct ?? false;
            // Scenarios: the choices only; red flags get their own line from the server's count below.
            const yours = describeAnswer(item, answers[item.id], { includeFlags: false });
            return (
              <li key={item.id} className="flex gap-3 p-4 sm:p-5">
                <span
                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${
                    ok ? 'bg-primary text-primary-foreground' : 'bg-destructive/10 text-destructive'
                  }`}
                >
                  {ok ? <Check className="size-3.5" aria-hidden="true" /> : <X className="size-3.5" aria-hidden="true" />}
                  <span className="sr-only">{ok ? 'Correct' : 'Incorrect'}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {i + 1}. {itemTitle(item)}
                    {item.kind === 'simulation' && <span className="font-normal text-muted-foreground"> · Scenario</span>}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">Your answer: {yours || 'No answer'}</p>
                  {item.kind === 'simulation' && fb?.flags && fb.flags.total > 0 && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Red flags spotted: {fb.flags.found} of {fb.flags.total}
                    </p>
                  )}
                  {(fb?.explanation || fb?.review) && (
                    // Open for wrong answers; folded for right ones, so the page stays short but still teaches.
                    <details open={!ok} className="group mt-3">
                      <summary className="inline-flex min-h-10 cursor-pointer items-center gap-1 text-sm font-medium underline-offset-4 marker:content-none hover:underline">
                        <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden="true" />
                        {item.kind === 'simulation' ? 'What happened' : ok ? 'Why this is right' : 'What to know'}
                      </summary>
                      <div className={`mt-1 flex flex-col gap-4 border-l-2 border-foreground/15 pl-4 text-sm ${readable}`}>
                        {item.kind === 'simulation' && fb?.review && <SimulationReviewBlock sim={item.sim} review={fb.review} />}
                        {fb?.explanation && (
                          <div>
                            {item.kind === 'simulation' && <p className="font-semibold">The lesson</p>}
                            <p className={item.kind === 'simulation' ? 'mt-1' : ''}>{fb.explanation}</p>
                            {fb.policyRef && <p className="mt-2 text-muted-foreground">See {fb.policyRef}</p>}
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

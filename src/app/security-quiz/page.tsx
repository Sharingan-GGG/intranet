import { ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { LocalTime } from '@/components/quiz/LocalTime';
import { resultPath, TAKE_PATH } from '@/components/quiz/paths';
import { StatusBadge } from '@/components/quiz/StatusBadge';
import { bigButton, card, eyebrow } from '@/components/quiz/ui';
import { getCurrentUser } from '@/lib/quiz/auth';
import { CURRENT_QUIZ } from '@/lib/quiz/current';
import { itemsPerAttempt } from '@/lib/quiz/draw';
import { formatScore } from '@/lib/quiz/scoring';
import { getMyStatus } from '@/lib/quiz/service';
import type { CompletionStatus } from '@/lib/quiz/types';

// /security-quiz: intro + "where am I up to?".
//
// The title, facts and tips use only CURRENT_QUIZ (static), so they render instantly.
// MyStatusCard reads the signed-in user (cookies), so it sits inside <Suspense> with a skeleton.

export default function SecurityQuizPage() {
  const quiz = CURRENT_QUIZ;
  // Per ATTEMPT, not the whole bank: with a draw rule each attempt gets a selection (draw.ts).
  const total = itemsPerAttempt(quiz);
  const scenarios = Math.min(quiz.draw?.simulations ?? Infinity, quiz.simulations?.length ?? 0);
  const questions = total - scenarios;
  // Rough time: ~45 s per choice question, ~2 min per scenario.
  const minutes = Math.max(5, Math.round(questions * 0.75 + scenarios * 2));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <p className={eyebrow}>Annual training</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{quiz.title}</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          {total} questions{scenarios > 0 && ` (${scenarios} interactive scenarios)`} · about {minutes} minutes · pass mark{' '}
          {formatScore(quiz.passMark)}
        </p>
      </div>

      <Suspense fallback={<div className={`${card} h-40 animate-pulse`} />}>
        <MyStatusCard />
      </Suspense>

      <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
        {[
          'Your answers are saved in this tab, so refreshing won’t lose them.',
          'Every question has a short explanation once you submit.',
          'You can retake the quiz as many times as you need.',
        ].map((t) => (
          <li key={t} className="flex gap-2.5">
            <Check className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden="true" />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Button text for each status. */
const CTA: Record<CompletionStatus, string> = {
  not_started: 'Start quiz',
  in_progress: 'Continue quiz',
  failed: 'Retake quiz',
  completed: 'Take it again',
};

async function MyStatusCard() {
  const user = await getCurrentUser();
  if (!user) return <p className={`${card} p-6`}>Please sign in to the Intranet to take the quiz.</p>;

  const status = await getMyStatus(user);
  const done = status.status === 'completed';

  return (
    <section aria-label="Your progress" className={`${card} p-6`}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-base font-medium text-foreground">Hi {user.name.split(' ')[0]}</p>
          <div className="mt-1.5">
            <StatusBadge status={status.status} />
          </div>
          {status.attempts > 0 && (
            <p className="mt-1.5 text-sm text-muted-foreground">
              Best score {formatScore(status.bestScore)} · {status.attempts} attempt{status.attempts === 1 ? '' : 's'}
              {status.completedAt && (
                <>
                  {' '}
                  · completed <LocalTime iso={status.completedAt} dateOnly />
                </>
              )}
            </p>
          )}
        </div>
        {/* Always the filled button: the outline variant (white on a white card) was too easy to miss.
            Once done, the missing arrow is what makes it read as optional. */}
        <Link href={TAKE_PATH} className={buttonVariants({ size: 'lg', className: bigButton })}>
          {CTA[status.status]}
          {!done && <ArrowRight aria-hidden="true" />}
        </Link>
      </div>
      {status.lastAttempt && (
        <div className="mt-5 border-t pt-4 text-sm">
          <Link href={resultPath(status.lastAttempt.attemptId)} className="font-medium underline underline-offset-4 hover:no-underline">
            View your last result
          </Link>
          <span className="text-muted-foreground">
            {' '}
            · <LocalTime iso={status.lastAttempt.completedAt} />
          </span>
        </div>
      )}
    </section>
  );
}

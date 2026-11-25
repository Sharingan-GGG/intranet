import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ResultScreen } from '@/components/quiz/ResultScreen';
import { card } from '@/components/quiz/ui';
import { getCurrentUser } from '@/lib/quiz/auth';
import { AttemptIdSchema } from '@/lib/quiz/schema';
import { toPublicQuiz } from '@/lib/quiz/scoring';
import { getAttemptForUser } from '@/lib/quiz/service';

// /security-quiz/result/<attemptId>: one attempt's score and feedback.
//
// `params` is a Promise in this Next.js version, and reading it counts as request data,
// so the part that awaits it sits inside <Suspense>.

type Params = Promise<{ attemptId: string }>;

export default function ResultPage({ params }: { params: Params }) {
  return (
    <div className="mx-auto max-w-2xl">
      <Suspense fallback={<div className={`${card} h-64 animate-pulse`} />}>
        <Result params={params} />
      </Suspense>
    </div>
  );
}

async function Result({ params }: { params: Params }) {
  const { attemptId } = await params;
  // 1. Malformed id → 404 straight away (no database query).
  if (!AttemptIdSchema.safeParse(attemptId).success) notFound();

  const user = await getCurrentUser();
  if (!user) return <p className={`${card} p-6`}>Please sign in to the Intranet to see your result.</p>;

  // 2. null for a missing attempt AND for someone else's (unless admin): both become the same 404,
  //    so nobody can find out which ids exist.
  const found = await getAttemptForUser(user, attemptId);
  if (!found) notFound();

  // 3. Always the PUBLIC quiz (no answer key) for display.
  return <ResultScreen result={found.result} quiz={toPublicQuiz(found.quiz)} answers={found.attempt.answers} />;
}

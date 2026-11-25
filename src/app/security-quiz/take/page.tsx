import { Suspense } from 'react';
import { QuizRunner } from '@/components/quiz/QuizRunner';
import { card } from '@/components/quiz/ui';
import { getCurrentUser } from '@/lib/quiz/auth';
import { getQuizForUser } from '@/lib/quiz/service';

// /security-quiz/take: the quiz itself.
//
// THE KEY SECURITY BOUNDARY: the only data handed to the browser component is getQuizForUser():
// this person's selection of items (see draw.ts), with no correct answers, verdicts or
// explanations. Scoring happens on the server at submit, against the same selection.

export default function TakeQuizPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <Runner />
      </Suspense>
    </div>
  );
}

async function Runner() {
  const user = await getCurrentUser();
  if (!user) return <p className={`${card} p-6`}>Please sign in to the Intranet to take the quiz.</p>;
  return <QuizRunner quiz={await getQuizForUser(user)} />;
}

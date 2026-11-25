import 'server-only'; // imports the question bank (answer key), so it must never reach the browser
import { quiz2026_1 } from './questions.2026.1';
import { toPublicQuiz } from './scoring';
import type { PublicQuiz, Quiz } from './types';

/** The quiz currently assigned to staff. Rolling out next year's round = change this one line. */
export const CURRENT_QUIZ: Quiz = quiz2026_1;

/** Every version that may still have attempts on record, so old result pages keep rendering. */
const ALL_QUIZZES: Record<string, Quiz> = { [quiz2026_1.version]: quiz2026_1 };

export function getQuizByVersion(version: string): Quiz | undefined {
  return ALL_QUIZZES[version];
}

/** What the API and quiz page send to the browser: always through toPublicQuiz (answers stripped). */
export function getPublicQuiz(): PublicQuiz {
  return toPublicQuiz(CURRENT_QUIZ);
}

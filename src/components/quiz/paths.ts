// Where the quiz's pages live. Every link and redirect in the quiz uses these, so if the Intranet
// mounts the quiz somewhere else (e.g. /training/security-quiz), only this file changes.

export const QUIZ_PATH = '/security-quiz';
export const TAKE_PATH = `${QUIZ_PATH}/take`;
export const resultPath = (attemptId: string) => `${QUIZ_PATH}/result/${encodeURIComponent(attemptId)}`;
export const REPORT_PATH = `${QUIZ_PATH}/admin`;

/** API routes (see src/app/api/quiz). */
export const API = {
  start: '/api/quiz/start',
  submit: '/api/quiz/submit',
  reportCsv: '/api/quiz/report?format=csv',
} as const;

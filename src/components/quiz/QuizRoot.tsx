import type { ReactNode } from 'react';

// THE QUIZ'S OUTER WRAPPER. Every quiz page renders inside <QuizRoot> (via the quiz's own
// layout.tsx files), both standalone and inside the Intranet.
//
// It deliberately sets almost nothing: colours, font and background come from the host's shadcn
// theme, so the quiz looks native in the Intranet. It only adds:
//   - `ctg-quiz`        turns on the scoped accessibility rules in quiz.css
//   - text-foreground   the host's main text colour (in case a parent sets something else)
// <html>, <body> and <main id="main"> belong to the host layout, never to the quiz.

export function QuizRoot({ children }: { children: ReactNode }) {
  return <div className="ctg-quiz text-foreground">{children}</div>;
}

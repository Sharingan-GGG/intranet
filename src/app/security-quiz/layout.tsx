import type { Metadata } from 'next'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import Link from 'next/link'
import React, { Suspense } from 'react'

import { QUIZ_PATH, REPORT_PATH } from '@/components/quiz/paths'
import { QuizRoot } from '@/components/quiz/QuizRoot'
import { canViewReport, getCurrentUser } from '@/lib/quiz/auth'
import { InitTheme } from '@/providers/Theme/InitTheme'
import { cn } from '@/utilities/ui'

import './security-quiz.css'

/**
 * Root layout for the Security Quiz. It emits its own <html>/<body>, so this is
 * a separate document tree from the rest of the intranet: none of
 * (frontend)/globals.css or the shared header applies. Same arrangement as
 * app/audit and app/pre-departure. The only thing shared with the intranet is
 * the sign-in (see lib/quiz/auth.ts) and the visitor's saved light/dark choice
 * (InitTheme).
 *
 * The middleware already sends anyone without a session to /login, so every
 * page here can assume a signed-in visitor.
 */
export const metadata: Metadata = {
  title: 'Security Awareness Quiz | CTG Intranet',
  description: 'Annual cybersecurity awareness quiz for staff',
}

export default function SecurityQuizLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" suppressHydrationWarning className={cn(GeistSans.variable, GeistMono.variable)}>
      <head>
        <InitTheme />
        <link href="/ctg-icon.png" rel="icon" type="image/png" sizes="100x100" />
      </head>
      <body>
        {/* Skip link: invisible until a keyboard user presses Tab, then jumps past the topbar. */}
        <a
          href="#main"
          className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5">
            <nav aria-label="Security quiz" className="flex items-center gap-4 text-sm">
              <Link href={QUIZ_PATH} className="flex items-center gap-2 font-semibold tracking-tight">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/ctg-icon.png" alt="" className="size-6" />
                Security Quiz
              </Link>
              <Suspense fallback={null}>
                <ReportLink />
              </Suspense>
            </nav>
            <div className="flex items-center gap-4 text-sm">
              <Suspense fallback={null}>
                <UserName />
              </Suspense>
              <Link href="/" className="font-medium underline underline-offset-4 hover:no-underline">
                Back to intranet
              </Link>
            </div>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 outline-none sm:py-12">
          <QuizRoot>{children}</QuizRoot>
        </main>
      </body>
    </html>
  )
}

/** Only admins see the link. Convenience only: the report page and API check permission again. */
async function ReportLink() {
  const user = await getCurrentUser()
  if (!user || !canViewReport(user)) return null
  return (
    <Link href={REPORT_PATH} className="text-muted-foreground hover:text-foreground">
      Completion report
    </Link>
  )
}

async function UserName() {
  const user = await getCurrentUser()
  return user ? <span className="text-muted-foreground">{user.name}</span> : null
}

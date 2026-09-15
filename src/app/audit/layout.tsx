import type { Metadata } from 'next'
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import React from 'react'

import { QueryProvider } from '@/components/providers/query-provider'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { AuditTopbar } from '@/components/work/audit/topbar'

import './audit.css'

/**
 * Root layout for the Audit Hub — it emits its own <html>/<body>, so this is a
 * separate document tree from the rest of the intranet and none of
 * (frontend)/globals.css or the shared chrome applies. Same arrangement as
 * app/pre-departure.
 *
 * The portal loaded IBM Plex from the Google Fonts CDN in a <link>; next/font
 * self-hosts it instead, which removes the render-blocking third-party request
 * and the layout shift that came with it.
 */
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-audit-sans',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-audit-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Audit Hub | CTG Intranet',
  description: 'CTG Intranet — SEO/GEO page audits',
}

export default function AuditLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn('antialiased', plexSans.variable, plexMono.variable)}
    >
      <head>
        <link href="/ctg-icon.png" rel="icon" type="image/png" sizes="100x100" />
      </head>
      <body>
        <QueryProvider>
          {/* Light only: the portal's palette has no dark counterpart worth
              shipping, and audit.css carries a fallback rather than a mode. */}
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
            <TooltipProvider>
              <AuditTopbar />
              <main>{children}</main>
            </TooltipProvider>
            <Toaster position="bottom-right" richColors closeButton />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  )
}

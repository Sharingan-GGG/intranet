import type { Metadata } from 'next'
import { Hanken_Grotesk } from 'next/font/google'
import React from 'react'
import { ThemeProvider } from 'next-themes'

import { QueryProvider } from '@/components/providers/query-provider'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import './pre-departure.css'

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Pre Departure | CTG Intranet',
  description: 'CTG Intranet — Pre Departure PNR review',
}

export default function PreDepartureLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn('antialiased font-sans', hanken.variable)}
    >
      <head>
        <link href="/ctg-icon.png" rel="icon" type="image/png" sizes="100x100" />
      </head>
      <body>
        <QueryProvider>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster position="bottom-right" richColors closeButton />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  )
}

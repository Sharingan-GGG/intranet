import type { Metadata } from 'next'

import { cn } from '@/utilities/ui'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import { Hanken_Grotesk } from 'next/font/google'
import React from 'react'

import { Providers } from '@/providers'
import { InitTheme } from '@/providers/Theme/InitTheme'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'

import '../(frontend)/globals.css'
import '../(frontend)/intranet.css'
import { getServerSideURL } from '@/utilities/getURL'

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-hanken',
  display: 'swap',
})

export default function FullscreenLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      className={cn(GeistSans.variable, GeistMono.variable, hanken.variable)}
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <InitTheme />
        <link href="/ctg-icon.png" rel="icon" type="image/png" sizes="100x100" />
        <link href="/ctg-icon.ico" rel="icon" sizes="any" />
        <link href="/ctg-icon.png" rel="apple-touch-icon" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

export const metadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  openGraph: mergeOpenGraph(),
}

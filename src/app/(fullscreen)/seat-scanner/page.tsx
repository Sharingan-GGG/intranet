import type { Metadata } from 'next'
import React, { Suspense } from 'react'

import { SeatScannerShell } from '@/components/seat-scanner/seat-scanner-shell'
import { Skeleton } from '@/components/ui/skeleton'

export const dynamic = 'force-dynamic'

export default function SeatScannerPage() {
  return (
    <div
      className="il-root bg-card"
      style={{ height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      <main style={{ width: '100%', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Suspense
          fallback={
            <div className="flex flex-1 flex-col gap-4 p-4">
              <Skeleton className="h-10 w-full max-w-sm" />
              <Skeleton className="h-[400px] w-full" />
            </div>
          }
        >
          <SeatScannerShell />
        </Suspense>
      </main>
    </div>
  )
}

export const metadata: Metadata = {
  title: 'CTG Intranet — Seat Scanner',
  description: 'Search and compare award seat availability across airlines.',
}

import React from 'react'

import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="il-root il-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <main style={{ width: '100%', flex: 1, padding: '16px 24px', display: 'flex', flexDirection: 'column' }}>
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Skeleton className="h-10 w-full max-w-sm" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </main>
    </div>
  )
}

import { Cormorant_Garamond } from 'next/font/google'
import React from 'react'

import { LoginScene } from '@/components/LoginScene'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400'],
  style: ['normal', 'italic'],
})

export const metadata = {
  title: 'Sign in | CTG Intranet',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; existing?: string; redirect?: string }>
}) {
  const params = await searchParams

  return (
    <LoginScene
      error={params.error}
      existing={params.existing}
      redirect={params.redirect}
      cormorantClass={cormorant.className}
    />
  )
}

import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import React from 'react'

import { HeaderClient } from './Component.client'

export async function Header() {
  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await getHeaders() })

  return (
    <HeaderClient
      user={user ? { name: user.name ?? null, email: user.email, roles: user.roles ?? [] } : null}
    />
  )
}

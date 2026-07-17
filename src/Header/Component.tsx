import { headers as getHeaders } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import React from 'react'

import { HeaderClient } from './Component.client'

export async function Header() {
  const payload = await getPayload({ config: configPromise })
  const [{ user }, header] = await Promise.all([
    payload.auth({ headers: await getHeaders() }),
    payload.findGlobal({ slug: 'header', depth: 1 }),
  ])

  const navItems = (header?.navItems ?? [])
    .map(({ link }) => {
      const href =
        link.type === 'reference' && typeof link.reference?.value === 'object'
          ? `${link.reference.relationTo !== 'pages' ? `/${link.reference.relationTo}` : ''}/${link.reference.value.slug}`
          : link.url
      return href ? { label: link.label, href, newTab: Boolean(link.newTab) } : null
    })
    .filter((item): item is { label: string; href: string; newTab: boolean } => item !== null)

  return (
    <HeaderClient
      navItems={navItems}
      user={user ? { name: user.name ?? null, email: user.email, roles: user.roles ?? [] } : null}
    />
  )
}

import React from 'react'

import { getCachedGlobal } from '@/utilities/getGlobals'
import { getCachedAuth } from '@/utilities/getCachedAuth'
import { HeaderClient } from './Component.client'

export async function Header() {
  const [{ user }, header] = await Promise.all([
    getCachedAuth(),
    getCachedGlobal('header', 1)(),
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
      user={
        user
          ? {
              name: user.name ?? null,
              email: user.email,
              roles: user.roles ?? [],
              image: user.image ?? null,
            }
          : null
      }
    />
  )
}

import React from 'react'

import { getCachedGlobal } from '@/utilities/getGlobals'
import { getCachedAuth } from '@/utilities/getCachedAuth'
import { HeaderClient, type HeaderNavItem } from './Component.client'

export async function Header() {
  const [{ user }, header] = await Promise.all([
    getCachedAuth(),
    getCachedGlobal('header', 1)(),
  ])

  const resolveHref = (link: { type?: string | null; reference?: unknown; url?: string | null }) =>
    link.type === 'reference' &&
    typeof (link.reference as { value?: unknown })?.value === 'object'
      ? `${
          (link.reference as { relationTo?: string }).relationTo !== 'pages'
            ? `/${(link.reference as { relationTo?: string }).relationTo}`
            : ''
        }/${((link.reference as { value?: { slug?: string } }).value as { slug?: string })?.slug}`
      : link.url

  const navItems: HeaderNavItem[] = (header?.navItems ?? [])
    .map((navItem): HeaderNavItem | null => {
      const { link, subItems } = navItem
      const href = resolveHref(link)
      if (!href) return null

      const children: HeaderNavItem[] = (subItems ?? [])
        .map((sub): HeaderNavItem | null => {
          const subHref = resolveHref(sub.link)
          return subHref
            ? { label: sub.link.label, href: subHref, newTab: Boolean(sub.link.newTab) }
            : null
        })
        .filter((item): item is HeaderNavItem => item !== null)

      return {
        label: link.label,
        href,
        newTab: Boolean(link.newTab),
        subItems: children.length > 0 ? children : undefined,
      }
    })
    .filter((item): item is HeaderNavItem => item !== null)

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

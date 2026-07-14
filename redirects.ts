import type { NextConfig } from 'next'

export const redirects: NextConfig['redirects'] = async () => {
  const internetExplorerRedirect = {
    destination: '/ie-incompatible.html',
    has: [
      {
        type: 'header' as const,
        key: 'user-agent',
        value: '(.*Trident.*)', // all ie browsers
      },
    ],
    permanent: false,
    source: '/:path((?!ie-incompatible.html$).*)', // all pages except the incompatibility page
  }

  // The site login already creates a Payload session (Google SSO + /api/users/login),
  // so the admin login screen is redundant — send it to the branded /login page.
  const adminLoginRedirect = {
    source: '/admin/login',
    destination: '/login?redirect=/admin',
    permanent: false,
  }

  return [internetExplorerRedirect, adminLoginRedirect]
}

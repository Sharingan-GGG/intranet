import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'

// Google Workspace domains allowed to sign in via SSO. Both are treated equally.
export const ALLOWED_DOMAINS = ['complextravel.com.au', 'roundabouttravel.com.au']

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    Google({
      // Safe: signIn callback below requires a verified email on an allowed Workspace domain
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          // No `hd` hint — it accepts only a single domain and would hide the
          // other Workspace's accounts from the chooser. The allow-list is
          // enforced server-side in the signIn callback below instead.
          prompt: 'select_account',
        },
      },
    }),
  ],
  callbacks: {
    signIn: ({ profile }) => {
      // Enforce the domain allow-list server-side (the chooser is not trusted).
      const hd = typeof profile?.hd === 'string' ? profile.hd.toLowerCase() : ''
      return ALLOWED_DOMAINS.includes(hd) && profile?.email_verified === true
    },
  },
}

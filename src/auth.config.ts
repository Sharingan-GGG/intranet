import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'

const ALLOWED_DOMAIN = 'complextravel.com.au'

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    Google({
      authorization: {
        params: {
          // Hint Google to only show accounts on our Workspace domain
          hd: ALLOWED_DOMAIN,
          prompt: 'select_account',
        },
      },
    }),
  ],
  callbacks: {
    signIn: ({ profile }) => {
      // `hd` above is only a UI hint — enforce the domain server-side
      return profile?.hd === ALLOWED_DOMAIN && profile?.email_verified === true
    },
  },
}

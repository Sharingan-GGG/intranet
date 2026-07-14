import { NextRequest, NextResponse } from 'next/server'

/**
 * Require a login for every page. Users may be authenticated either via
 * Payload's local strategy (payload-token) or via Google SSO (Auth.js
 * session cookie). Actual token validation happens in Payload's access
 * control on every data request — this gate just keeps anonymous visitors
 * out of the pages themselves.
 */
export function middleware(req: NextRequest) {
  const hasSession =
    req.cookies.has('payload-token') ||
    req.cookies.has('authjs.session-token') ||
    req.cookies.has('__Secure-authjs.session-token')

  if (hasSession) {
    return NextResponse.next()
  }

  const loginUrl = new URL('/login', req.url)
  loginUrl.searchParams.set('redirect', req.nextUrl.pathname + req.nextUrl.search)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // Everything except the login page, admin panel (has its own login),
  // API routes, Next.js internals, and static assets
  matcher: ['/((?!login|admin|api|_next|.*\\.[\\w]+$).*)'],
}

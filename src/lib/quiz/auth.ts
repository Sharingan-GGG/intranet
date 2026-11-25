import 'server-only';
import { cache } from 'react';
import { getCachedAuth } from '@/utilities/getCachedAuth';
import { isAdmin, parseAdminRoleValues, rolesFromIntranetRoles } from './roles';
import type { User } from './types';

// "WHO IS SIGNED IN, AND WHAT MAY THEY SEE?" The one door for identity.
// Every page and API route calls getCurrentUser(). Nothing else in the quiz knows how login works.
//
// HOW IT WORKS (intranet port)
//   The intranet's Payload auth strategy has already resolved the request's session: the Google
//   Workspace SSO cookie (Supabase Auth), or the Payload admin fallback login. That is the only
//   thing the quiz shares with the rest of the intranet. We take the Payload user it returns:
//   id, name, email, and the `roles` select (which Payload stores in the JWT).
//
//   The standalone repo verified a Supabase session itself and looked the person up in
//   public.users / public.users_roles by email. payload.auth() does both, and reads the roles
//   correctly (the Payload table's foreign key is `parent_id`, not `user_id`).
//
// IDENTITY NEVER COMES FROM THE BROWSER
//   We never read a user id or email from a request body or URL. Only from the verified session.

/**
 * The signed-in user, or null if nobody is signed in.
 *
 * Wrapped in React's cache(): within ONE request, calling it several times (layout, page,
 * components) resolves the session once. getCachedAuth is itself cached per request.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const { user } = await getCachedAuth();
  if (!user || user.collection !== 'users' || !user.email) return null;

  return {
    id: String(user.id),
    name: user.name?.trim() || user.email,
    email: user.email,
    role: rolesFromIntranetRoles(user.roles ?? [], parseAdminRoleValues(process.env.QUIZ_ADMIN_ROLE_VALUES)),
  };
});

/**
 * Re-exported so pages and routes can import everything identity-related from one file.
 * isAdmin: roles.ts. canViewReport (only admins): status.ts. Each rule is defined once.
 */
export { isAdmin };
export { canViewReport } from './status';

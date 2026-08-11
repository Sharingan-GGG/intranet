import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { isAdmin, isAdminFieldLevel, isAdminOrSelf } from '../../access/isAdmin'
import { supabaseStrategy } from './supabaseStrategy'

export const Users: CollectionConfig = {
  slug: 'users',
  lockDocuments: { duration: 30 },
  access: {
    // Only super-admins/admins/editors may enter the /admin panel — "user" accounts are site-only
    admin: ({ req: { user } }) =>
      Boolean(user?.roles?.some((r) => r === 'super-admin' || r === 'admin' || r === 'editor')),
    create: isAdmin,
    delete: isAdmin,
    read: authenticated,
    update: isAdminOrSelf,
  },
  admin: {
    defaultColumns: ['name', 'email', 'roles'],
    useAsTitle: 'name',
  },
  // Supabase Auth is the sign-in route for everyone. Payload's own email/password strategy
  // stays enabled underneath it as an admin fallback: if Supabase Auth is unreachable, the
  // superAdmin can still reach /admin, and only that account has a password hash.
  //
  // payload-authjs prepends its own strategy to this array. It is left installed but inert —
  // nothing issues an Auth.js session any more — because removing it would revert users.id
  // from varchar to a serial integer and Payload would try to convert eleven existing rows,
  // ten of which hold UUIDs.
  auth: {
    strategies: [supabaseStrategy],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      required: true,
      defaultValue: ['user'],
      options: [
        { label: 'Super Admin', value: 'super-admin' },
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
        { label: 'User', value: 'user' },
      ],
      // Store roles in the JWT so access checks don't need a DB lookup
      saveToJWT: true,
      access: {
        // Only admins can grant or change roles
        create: isAdminFieldLevel,
        update: isAdminFieldLevel,
      },
    },
    {
      name: 'department',
      type: 'relationship',
      relationTo: 'departments',
      admin: {
        description: 'The department this user belongs to.',
      },
    },
  ],
  timestamps: true,
}

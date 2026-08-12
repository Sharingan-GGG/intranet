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
    // payload-authjs (see plugins/index.ts) wraps every user field into a "General" tab and
    // adds an "Accounts" tab (linked OAuth accounts — unused now that Supabase Auth handles
    // sign-in). This patches both tabs so they're hidden while looking at your own account
    // (/admin/account or your own row in Collections > Users), decluttering the personal
    // account screen. Admins can still open OTHER users' docs to edit name/roles/department.
    {
      type: 'tabs',
      tabs: [
        {
          label: 'General',
          admin: {
            condition: (data, _siblingData, { user }) => data?.id !== user?.id,
          },
          fields: [],
        },
        {
          label: 'Accounts',
          admin: {
            condition: (data, _siblingData, { user }) => data?.id !== user?.id,
          },
          fields: [],
        },
      ],
    },
    {
      name: 'name',
      type: 'text',
    },
    // payload-authjs adds this field for Auth.js's database sessions, which this project
    // doesn't use — Supabase Auth handles sign-in, so nothing ever sets it. Repurposed as a
    // read-only "Created Date" display, falling back to createdAt since it's otherwise always
    // empty.
    {
      name: 'emailVerified',
      type: 'date',
      label: 'Created Date',
      admin: {
        readOnly: true,
      },
      hooks: {
        afterRead: [({ value, data }) => value ?? data?.createdAt],
      },
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
    {
      name: 'image',
      type: 'text',
      admin: {
        description: "Synced from the user's Google Workspace profile photo on sign-in.",
        readOnly: true,
      },
    },
  ],
  timestamps: true,
}

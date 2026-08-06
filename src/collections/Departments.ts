import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { isAdmin } from '../access/isAdmin'

export const Departments: CollectionConfig = {
  slug: 'departments',
  // Collection-level access control
  access: {
    // Any signed-in staff member can browse departments
    read: authenticated,
    // Only admins can manage the org structure
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'orgUnitPath', 'lead'],
    group: 'Organization',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      // Not unique: Workspace OUs can share a leaf name under different parents
      // (e.g. "Support" nested under both Sales and Engineering). orgUnitPath
      // below is the real unique identifier once OUs are synced in.
    },
    {
      name: 'orgUnitPath',
      type: 'text',
      unique: true,
      admin: {
        description:
          'Google Workspace OU path (e.g. "/Sales/APAC"). Set by scripts/sync-ous.ts — leave blank for departments that aren\'t tied to a Workspace OU.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'lead',
      type: 'relationship',
      relationTo: 'users',
      // Only offer users already assigned to this department (Workspace OU). New,
      // unsaved departments have no id to filter by yet, so show everyone until saved.
      filterOptions: ({ id }) => (id ? { department: { equals: id } } : true),
      admin: {
        description: 'Department head / manager — must already belong to this department.',
      },
    },
    {
      name: 'parent',
      type: 'relationship',
      relationTo: 'departments',
      admin: {
        description: 'Parent department, for nested org structures.',
      },
    },
    {
      name: 'workspaceUsers',
      type: 'ui',
      admin: {
        condition: (data) => Boolean(data?.orgUnitPath),
        components: {
          Field: '@/components/admin/DepartmentWorkspaceUsers#DepartmentWorkspaceUsers',
        },
      },
    },
  ],
  timestamps: true,
}

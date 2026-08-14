import type { CollectionConfig } from 'payload'

import { authenticated } from '../access/authenticated'
import { isAdmin } from '../access/isAdmin'

const pageOptions = [
  { label: 'All', value: 'all' },
  { label: 'Home: Quick Links', value: 'home:quickLinks' },
  { label: 'Home: Knowledge Base', value: 'home:knowledgeBase' },
  { label: 'Home: Events', value: 'home:eventsBlock' },
  { label: 'Home: EDM Slider', value: 'home:edmSlider' },
  { label: 'Home: News Slider', value: 'home:newsSlider' },
  { label: 'Home: Time Zones', value: 'home:timeZones' },
  { label: 'Home: Featured Spotlight', value: 'home:featuredSpotlight' },
  { label: 'Route: Calendar', value: 'route:calendar' },
  { label: 'Route: Posts', value: 'route:posts' },
  { label: 'Route: Search', value: 'route:search' },
  { label: 'Route: Seat Scanner', value: 'route:seat-scanner' },
  { label: 'Route: Pre Departure', value: 'route:pre-departure' },
]

export const Permissions: CollectionConfig = {
  slug: 'permissions',
  lockDocuments: { duration: 30 },
  // Permissions define which admin-panel collections and front-end pages a
  // role/department combination (optionally narrowed to specific users) can
  // access — only admins may manage them.
  access: {
    read: authenticated,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'role', 'department', 'users', 'adminCollections', 'pages'],
    group: 'Organization',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Human-readable label, e.g. "Sales admin access".',
      },
    },
    {
      name: 'role',
      type: 'select',
      hasMany: true,
      required: true,
      admin: {
        description: 'Which user role tier(s) this rule applies to.',
      },
      options: [
        { label: 'Super Admin', value: 'super-admin' },
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
        { label: 'User', value: 'user' },
      ],
    },
    {
      name: 'department',
      type: 'relationship',
      relationTo: 'departments',
      hasMany: true,
      admin: {
        description: 'Department(s) this rule applies to. Leave empty to apply to every department.',
      },
    },
    {
      name: 'users',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      // Narrow the picker to users in the department(s) selected above — a
      // per-user override only makes sense within the rule's own department scope.
      // With no department selected (rule applies to every department), show everyone.
      filterOptions: ({ siblingData }) => {
        const departments = (siblingData as { department?: (number | { id: number })[] })?.department ?? []
        const departmentIds = departments.map((d) => (typeof d === 'object' && d !== null ? d.id : d)).filter(Boolean)
        return departmentIds.length > 0 ? { department: { in: departmentIds } } : true
      },
      admin: {
        description:
          'Specific user(s) this rule applies to, overriding the role/department result — e.g. two users sharing a role and department who need different page access. Leave empty for a role/department-wide rule. Filtered to the department(s) selected above.',
      },
    },
    {
      name: 'adminCollections',
      type: 'select',
      hasMany: true,
      admin: {
        description: 'Admin-panel collections this rule grants access to. Use "All" for every collection.',
      },
      options: [
        { label: 'All', value: 'all' },
        { label: 'Pages', value: 'pages' },
        { label: 'Posts', value: 'posts' },
        { label: 'Media', value: 'media' },
        { label: 'Categories', value: 'categories' },
        { label: 'EDMs', value: 'edms' },
        { label: 'Events', value: 'events' },
        { label: 'Knowledge Base', value: 'knowledge-base' },
        { label: 'Quick Links', value: 'quick-links' },
        { label: 'Time Zones', value: 'time-zones' },
        { label: 'Departments', value: 'departments' },
        { label: 'Permissions', value: 'permissions' },
        { label: 'Users', value: 'users' },
      ],
    },
    {
      name: 'pages',
      type: 'select',
      hasMany: true,
      admin: {
        description: 'Front-end homepage sections / routes this rule grants visibility to. Use "All" for everything.',
      },
      options: pageOptions,
    },
    {
      name: 'excludedPages',
      type: 'select',
      hasMany: true,
      admin: {
        description:
          'Pages to exclude, even if granted by "All" (in this rule or another matching rule). Use for "all pages except X".',
      },
      options: pageOptions,
    },
    {
      name: 'category',
      type: 'text',
      admin: {
        description: 'Optional grouping, e.g. "Reports", "Content", "Users".',
      },
    },
    {
      name: 'description',
      type: 'textarea',
    },
  ],
  timestamps: true,
}

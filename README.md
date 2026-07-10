# Intranet

A company intranet built on [Payload CMS](https://payloadcms.com) (Next.js native) with a role- and department-based access-control model.

It starts from the official Payload **website** template (pages, posts, media, categories, SEO, redirects, search, live preview, draft/publish) and adds an **Organization** layer — Departments, Roles, and customizable Permissions — for modelling staff and what they can do.

## Tech stack

| Layer      | Choice                                          |
| ---------- | ----------------------------------------------- |
| CMS / API  | Payload 3 (REST + GraphQL + Local API)          |
| Framework  | Next.js 16 (App Router, Turbopack)              |
| Language   | TypeScript throughout (backend + frontend)      |
| Database   | SQLite (`@payloadcms/db-sqlite`)                |
| Editor     | Lexical rich text                               |
| Package mgr| pnpm                                            |
| Styling    | Tailwind CSS + shadcn/ui components             |

## Getting started

### Prerequisites

- Node.js 20+
- pnpm (`npm i -g pnpm`, or the standalone installer from <https://get.pnpm.io/install.sh>)

### Setup

```bash
pnpm install
cp .env.example .env   # then set PAYLOAD_SECRET and DATABASE_URI if not already present
pnpm dev
```

- App: <http://localhost:3000>
- Admin: <http://localhost:3000/admin> — the first visit prompts you to create an admin user.

The default `.env` uses a local SQLite file:

```
DATABASE_URI=file:./intranet.db
PAYLOAD_SECRET=<generated>
```

> **First-run note (pnpm 10+):** the template's build-script allowlist lives in a
> field pnpm no longer reads. If native deps (`sharp`, `esbuild`, `unrs-resolver`)
> don't build, `pnpm-workspace.yaml` already sets `allowBuilds` for them — run
> `pnpm rebuild sharp esbuild unrs-resolver` once and restart `pnpm dev`.

### Seed demo content

Once logged in, use **"Seed your database"** on the admin dashboard to populate demo pages, posts, and media.

## Access-control model

The app has **two complementary role concepts**, on purpose:

### 1. System roles (fast, JWT-based)

The `Users.roles` **select** field (`admin` / `editor` / `user`) drives all
collection- and field-level access checks. It's stored in the JWT
(`saveToJWT: true`), so permission checks need no database lookup.

Helpers live in `src/access/`:

| Helper                 | Use                                                          |
| ---------------------- | ----------------------------------------------------------- |
| `authenticated`        | Any signed-in user                                          |
| `anyone`               | Public                                                      |
| `isAdmin`              | Collection access — admins only                             |
| `isAdminFieldLevel`    | Field access — admins only                                  |
| `isAdminOrSelf`        | Admins, or the user acting on their own record              |

Only admins can create/delete users or change anyone's `roles`; users may edit
their own profile.

### 2. Organization model (rich, admin-managed data)

Three collections under the **Organization** admin group let you model the org
as editable data rather than code:

- **Departments** — `name`, `code`, `description`, `lead` (→ user),
  `parent` (→ department, for nested structures).
- **Roles** — business roles like "HR Manager" or "Sales Rep":
  `name`, `description`, `department` (→ department),
  `permissions` (→ permissions, many).
- **Permissions** — the customizable capability catalog:
  - `name` — human label ("View Reports")
  - `key` — unique machine key used in code (`reports:view`)
  - `collections` — which collections it grants access to (**All**, Pages,
    Posts, Media, Categories, Departments, Roles, Permissions, Users)
  - `category`, `description`

Users link to this model via `Users.department` and `Users.assignedRoles`.

**Workflow:** create Permissions → attach them to Roles → assign Roles (and a
Department) to Users. All three Organization collections are readable by any
signed-in user and writable by admins only.

## Project structure

```
src/
├── access/            # Reusable access-control functions (authenticated, isAdmin, …)
├── app/               # Next.js routes — (frontend) and (payload) admin
├── collections/       # Payload collections
│   ├── Departments.ts
│   ├── Roles.ts
│   ├── Permissions.ts
│   ├── Users/
│   ├── Pages/
│   ├── Posts/
│   ├── Media.ts
│   └── Categories.ts
├── blocks/            # Layout building blocks for pages
├── heros/             # Hero components
├── Header/ Footer/    # Global nav configs
├── plugins/           # SEO, redirects, search, form builder
└── payload.config.ts  # Root config
```

## Common commands

```bash
pnpm dev              # Start the dev server
pnpm build            # Production build
pnpm generate:types   # Regenerate src/payload-types.ts after schema changes
pnpm payload          # Payload CLI (migrations, etc.)
pnpm test             # Integration + e2e tests
```

> After changing any collection or field, run `pnpm generate:types` so
> `@/payload-types` stays in sync.

## Notes

- **Local API bypasses access control by default.** When acting on behalf of a
  user, always pass `overrideAccess: false` alongside `user`.
- SQLite dev-mode schema push can prompt interactively when a field's *type*
  changes (e.g. select → relationship). Restart `pnpm dev` and accept the
  "create table" option, or generate a migration for production.
- The local `intranet.db` is git-ignored — it's dev data, not source.

## Deployment

Standard Next.js deployment (e.g. Vercel). Set `PAYLOAD_SECRET`, `DATABASE_URI`
(point at a hosted database for production), and `CRON_SECRET` for scheduled
jobs. See the [Payload deployment docs](https://payloadcms.com/docs/production/deployment).

---

Based on the [Payload Website Template](https://github.com/payloadcms/payload/blob/3.x/templates/website).

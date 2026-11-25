# Security Quiz (`/security-quiz`)

The annual staff security-awareness quiz. Staff work through interactive scenarios (phishing
email, fake supplier bank change, MFA-code phone call…) and choice questions. Answers are
scored **on the server**, results go to the `cybersecurity_quiz` schema, and admins get a
completion report with a CSV export for audit evidence (PCI DSS 12.6).

It was imported from
[`complex-travel-group/cybersecurity-quiz`](https://github.com/complex-travel-group/cybersecurity-quiz)
at commit **`99e6ff5`**. That repo's README covers the quiz itself: scenario rules,
scoring, the random draw, status rules, the API and the security model. This file only
records **what changed in the port**. To pull in later changes, diff the repo from
`99e6ff5` and replay the changes onto the files listed below.

## It's a separate tool

The quiz is a self-contained module, built the same way as `/audit` and `/pre-departure`.
It has its own root layout (its own `<html>`), topbar, CSS and database schema. It shares
only two things with the rest of the intranet:

- **Sign-in.** Identity comes from `payload.auth()`, i.e. the same Google Workspace SSO
  session. The middleware already sends anyone without a session to `/login`.
- **The light/dark choice.** `InitTheme` reads the visitor's saved intranet theme.

| Path | What it is |
|---|---|
| `/security-quiz` | Overview and "your progress" card |
| `/security-quiz/take` | The quiz |
| `/security-quiz/result/[attemptId]` | One attempt's score and feedback (your own; admins can open anyone's) |
| `/security-quiz/admin` | Completion report and CSV download (admins only) |
| `/api/quiz/*` | JSON API (`me`, `status`, `start`, `submit`, `attempts/:id`, `report`) |

All URLs are defined in `src/components/quiz/paths.ts`.

## Code

```
src/app/security-quiz/          pages, root layout, security-quiz.css (theme tokens)
src/app/api/quiz/               API routes + routes.test.ts
src/components/quiz/            all quiz UI + quiz.css (scoped a11y rules)
src/lib/quiz/                   question bank, scoring, draw, status, service, auth, storage
supabase/database/schemas/cybersecurity_quiz/   the schema (see its README)
```

## Changes from the standalone repo

| Area | Standalone repo | Intranet |
|---|---|---|
| Identity (`lib/quiz/auth.ts`) | Verified the Supabase session itself, then looked the person up in `public.users` / `users_roles` by email | `payload.auth()` via `getCachedAuth`. Its `users_roles` mapping was wrong anyway: Payload's column is `parent_id`, not `user_id` |
| Admin rule (`lib/quiz/roles.ts`) | Google "super admin" spellings | Payload roles `super-admin` and `admin`, read from the JWT. `QUIZ_ADMIN_ROLE_VALUES` still overrides. Fails closed |
| Storage (`lib/quiz/backend.ts`) | supabase-js + service-role key (needs Exposed schemas), or a local JSON file | Direct `pg` pool (`max: 2`) as `payload_app`, which owns the tables. Same approach as `src/lib/audit-db.ts` |
| Roster (report) | Every row in `public.users` | Users with a department set (department is synced from the Workspace OU at login) |
| Report URL | `/admin/security-quiz` | `/security-quiz/admin`. Payload owns `/admin/*`, and the middleware matcher skips any path starting with `admin` |
| Next config | `cacheComponents` + `partialPrefetching`, and `await connection()` in the session client | Not enabled (it would change every Payload page). `connection()` was only needed for that and went with the Supabase client. The `<Suspense>` boundaries stay |
| Layout | Placeholder intranet header | Own root layout: CTG mark, Completion report link (admins), name, Back to intranet |
| Theme | Standalone `globals.css` | `security-quiz.css`, with token values copied from `(frontend)/globals.css`. Dark mode keys off `data-theme` |
| Button | shadcn on `@base-ui/react` | The intranet's Radix `@/components/ui/button` (same `variant`/`size` names) |
| Tests | vitest 5 via `scripts/vitest.mjs` | Included in `pnpm test:int` (vitest 4). `roles.test.ts` rewritten for Payload roles |
| Dev scaffolding | Fake-user switcher, `/test-login`, JSON file backend, seed script | Removed, including `dev-users.ts` and every `isDevAuth()` branch. Test with your own SSO login |

Dependencies added: `zod` (4.4.3, the version already in the lockfile) and `server-only`.

## Kill switch

`src/middleware.ts` gates `/security-quiz` and `/api/quiz`, the same way as the Audit Hub.
They're on in `next dev`. A production build returns 404 unless it was **built** with
`SECURITY_QUIZ_ENABLED=true`.

## Running locally

`.env.local` points at the **staging** database, so local and staging share data.

1. Apply the schema bundle to staging (see `supabase/database/schemas/cybersecurity_quiz/README.md`).
2. `pnpm dev`, sign in with Google, open `/security-quiz`.
3. `GET /api/quiz/me` should return your `{ id, name, email, isAdmin }`.
4. Take the quiz. A row should appear in `cybersecurity_quiz.attempts` and `quiz_starts`.
5. As a `super-admin` or `admin`, open `/security-quiz/admin` and download the CSV.

## Before go-live

- [ ] Apply the schema bundle to production.
- [ ] Build production with `SECURITY_QUIZ_ENABLED=true`.
- [ ] Add the link to the intranet in the CMS (a custom link to `/security-quiz`).
- [ ] **Question content review** (standalone README §10): IT or compliance should check
  the 30 choice questions. Device, network and software questions have no `policyRef` yet.
- [ ] **Idempotency key not wired up.** `attempts.idempotency_key` exists, but nothing sends
  or stores one. Only the button disabling itself prevents double submits. To fix it, send
  a key per attempt from `QuizRunner`, store it in `saveAttempt`, and treat a
  unique-violation as "return the existing attempt".
- [ ] Note: the `ON DELETE RESTRICT` foreign keys mean a user who has taken the quiz **can't
  be hard-deleted** in Payload. Deleting them errors, which keeps the audit evidence.

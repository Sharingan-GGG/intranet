# `cybersecurity_quiz` schema

Backs the Security Quiz at `/security-quiz` (see `src/app/security-quiz/README.md`).
It was ported from the standalone repo's
`supabase/migrations/20261119000000_cybersecurity_quiz_schema.sql`, with these changes:

- `payload_app` **owns** the tables and the view. The intranet server connects as
  `payload_app` through a direct `pg` pool, so it doesn't go through RLS and doesn't
  need a service-role key or Exposed schemas.
- The foreign keys to `public.users(id)` (`ON DELETE RESTRICT`) are on, not commented out.
- Every file is idempotent. On a fresh database it creates everything. On one that
  already has the standalone migration (staging did), it only changes ownership and grants.

Like `audit` and `pre_departure`, this schema is **not** part of Payload's migrations.
These files are the checked-in record and are applied by hand, per environment.

## Layout

```
schema.sql               CREATE SCHEMA + schema grants
tables/attempts.sql      one row per submitted attempt, FK, RLS, policy
tables/quiz_starts.sql   first open per user per version, FK, RLS, policy
views/completions.sql    summary view for ad-hoc audit exports
```

## Applying

`payload_app` cannot create schemas, so this runs as `postgres`. Bundle the files in order:

```bash
D=supabase/database/schemas/cybersecurity_quiz
cat $D/schema.sql $D/tables/attempts.sql $D/tables/quiz_starts.sql $D/views/completions.sql > /tmp/quiz-schema.sql
```

- **Staging:** `npx supabase db query -f /tmp/quiz-schema.sql --linked --project-ref mckqcwpnaouqrfnoxils`.
  Run it from a directory outside the repo, or the CLI fails trying to parse `.env.local`.
- **Production:** paste the bundle into the SQL editor, or run it on the `postgres.<ref>`
  connection in `.env.production`.

## Applied

| Environment | State |
|---|---|
| Staging (`mckqcwpnaouqrfnoxils`) | Applied 2026-11-25 on top of the standalone migration that was already there. `payload_app` owns both tables and the view; read/write verified as `payload_app`. |
| Production | Not applied. |

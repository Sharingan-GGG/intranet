# SQLite archive

Payload ran on SQLite until **2026-08-05**, when it moved to Supabase Postgres. These are the
files from before that, kept here because they are not reproducible from anything else.

The `.db` files are **gitignored** — they contain user password hashes. Only this README is
tracked.

## What is in here

| File | Contents |
| --- | --- |
| `intranet.db` | The database Payload used up to the migration. 11 users, 3 pages, 6 posts, 37 media, **38 post versions, 10 page versions**. This is the one to restore. |
| `intranet.db.bak-local-20260804-1451` | A snapshot taken on 2026-08-04, *before* local content was refreshed from live. A different, older state — 1 user, 12 posts, 11 media. Keep it, but it is not a backup of the file above. |

## Why these are worth keeping

1. **They hold the only copy of the version history.** The migration moved current documents
   only. The 48 version rows above never came across, so pre-migration revisions of any page
   or post exist nowhere else. Everything a document currently says did migrate — only the
   revision trail is missing.
2. **They are the rollback path** if Supabase is unavailable. The project is on the free tier,
   which pauses after roughly 7 days idle.
3. **`scripts/db-export.ts` reads them**, so re-running the migration or backfilling version
   history later depends on them.

Also worth knowing: **the live intranet still runs SQLite.** Only local Payload is on Postgres.
So `intranet.db` doubles as a reference copy of live data as of 2026-08-04.

## Reverting to SQLite

`src/payload.config.ts` picks Postgres only when `POSTGRES_URL` is set and falls back to
SQLite otherwise, so reverting is one line. `DATABASE_URL` already points into this folder.

1. Stop the dev server — Payload holds the file open while running.
2. In `.env`, comment out `POSTGRES_URL`:

   ```diff
   -POSTGRES_URL=postgresql://payload_app.vrxkxpiymeaqxkzsswwj:...
   +#POSTGRES_URL=postgresql://payload_app.vrxkxpiymeaqxkzsswwj:...
   ```

   Leave `DATABASE_URL=file:./sqlite-archive/intranet.db` as it is.
3. Start the dev server. Payload boots against SQLite with the pre-migration data.

Nothing needs to be moved or renamed. To go back to Postgres, uncomment the line again.

### What does not revert

- **Sign-in.** Google SSO now goes through Supabase Auth, which is independent of which
  database Payload uses — it keeps working on SQLite, but it authenticates against the
  Supabase project either way. The `users` table it matches against by email would be the
  SQLite one. If Supabase itself is the outage, use Payload's email/password login at
  `/admin`; only the superAdmin has a password hash.
- **Anything created since 2026-08-05** lives in Postgres and is not in these files.

## Backfilling the version history

If the missing revisions are ever wanted, they can be replayed as raw rows the same way media
was — see `importMedia()` in `scripts/db-import.ts`. It is a bounded job (48 rows) but fiddly:
version rows carry the full document shape plus their own `_rels` tables, and the SQLite
column types differ from Postgres (rich text is `TEXT` vs `jsonb`, `_status` is text vs an
enum). Read the notes at the top of `scripts/db-export.ts` first.

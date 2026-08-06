import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Departments.id moves from a sequential integer (1, 2, 3...) to a random UUID string, so
// department ids aren't guessable from the admin UI or API responses. Every FK pointing at
// departments.id is swapped in lockstep: add a uuid column, backfill by joining on the old
// integer id, drop the old column, rename the new one into place, then re-add the FK with the
// same constraint name and ON DELETE behavior it had before (pre_departure.department_page_access
// and the PostgREST embed in src/lib/pre-departure-directory.ts both depend on those names).
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "departments" ADD COLUMN "id_new" varchar DEFAULT gen_random_uuid()::varchar NOT NULL;

    ALTER TABLE "departments" ADD COLUMN "parent_id_new" varchar;
    UPDATE "departments" AS d SET "parent_id_new" = d2."id_new" FROM "departments" AS d2 WHERE d."parent_id" = d2."id";

    ALTER TABLE "users" ADD COLUMN "department_id_new" varchar;
    UPDATE "users" AS u SET "department_id_new" = d."id_new" FROM "departments" AS d WHERE u."department_id" = d."id";

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "departments_id_new" varchar;
    UPDATE "payload_locked_documents_rels" AS r SET "departments_id_new" = d."id_new" FROM "departments" AS d WHERE r."departments_id" = d."id";

    ALTER TABLE "permissions_rels" ADD COLUMN "departments_id_new" varchar;
    UPDATE "permissions_rels" AS r SET "departments_id_new" = d."id_new" FROM "departments" AS d WHERE r."departments_id" = d."id";

    ALTER TABLE "quick_links_rels" ADD COLUMN "departments_id_new" varchar;
    UPDATE "quick_links_rels" AS r SET "departments_id_new" = d."id_new" FROM "departments" AS d WHERE r."departments_id" = d."id";

    ALTER TABLE "pre_departure"."department_page_access" ADD COLUMN "department_id_new" varchar;
    UPDATE "pre_departure"."department_page_access" AS p SET "department_id_new" = d."id_new" FROM "departments" AS d WHERE p."department_id" = d."id";

    ALTER TABLE "departments" DROP CONSTRAINT "departments_parent_id_departments_id_fk";
    ALTER TABLE "users" DROP CONSTRAINT "users_department_id_departments_id_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_departments_fk";
    ALTER TABLE "permissions_rels" DROP CONSTRAINT "permissions_rels_departments_fk";
    ALTER TABLE "quick_links_rels" DROP CONSTRAINT "quick_links_rels_departments_fk";
    ALTER TABLE "pre_departure"."department_page_access" DROP CONSTRAINT "department_page_access_department_id_fkey";

    ALTER TABLE "departments" DROP COLUMN "parent_id";
    ALTER TABLE "departments" RENAME COLUMN "parent_id_new" TO "parent_id";

    ALTER TABLE "users" DROP COLUMN "department_id";
    ALTER TABLE "users" RENAME COLUMN "department_id_new" TO "department_id";

    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "departments_id";
    ALTER TABLE "payload_locked_documents_rels" RENAME COLUMN "departments_id_new" TO "departments_id";

    ALTER TABLE "permissions_rels" DROP COLUMN "departments_id";
    ALTER TABLE "permissions_rels" RENAME COLUMN "departments_id_new" TO "departments_id";

    ALTER TABLE "quick_links_rels" DROP COLUMN "departments_id";
    ALTER TABLE "quick_links_rels" RENAME COLUMN "departments_id_new" TO "departments_id";

    ALTER TABLE "pre_departure"."department_page_access" DROP COLUMN "department_id";
    ALTER TABLE "pre_departure"."department_page_access" RENAME COLUMN "department_id_new" TO "department_id";
    ALTER TABLE "pre_departure"."department_page_access" ALTER COLUMN "department_id" SET NOT NULL;

    ALTER TABLE "departments" DROP CONSTRAINT "departments_pkey";
    ALTER TABLE "departments" DROP COLUMN "id";
    ALTER TABLE "departments" RENAME COLUMN "id_new" TO "id";
    ALTER TABLE "departments" ADD PRIMARY KEY ("id");
    ALTER TABLE "departments" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::varchar;
    DROP SEQUENCE IF EXISTS "departments_id_seq";

    ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_departments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL;
    ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_departments_fk" FOREIGN KEY ("departments_id") REFERENCES "departments"("id") ON DELETE CASCADE;
    ALTER TABLE "permissions_rels" ADD CONSTRAINT "permissions_rels_departments_fk" FOREIGN KEY ("departments_id") REFERENCES "departments"("id") ON DELETE CASCADE;
    ALTER TABLE "quick_links_rels" ADD CONSTRAINT "quick_links_rels_departments_fk" FOREIGN KEY ("departments_id") REFERENCES "departments"("id") ON DELETE CASCADE;
    ALTER TABLE "pre_departure"."department_page_access" ADD CONSTRAINT "department_page_access_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE;
  `)
}

// Best-effort structural rollback: reassigns fresh sequential integers ordered by created_at.
// The original 1, 2, 3... values are not recoverable (that's the point of this migration), so
// any code or bookmark holding an old numeric department id will not match after a rollback.
export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "departments" ADD COLUMN "id_old" serial;

    ALTER TABLE "departments" ADD COLUMN "parent_id_old" integer;
    UPDATE "departments" AS d SET "parent_id_old" = d2."id_old" FROM "departments" AS d2 WHERE d."parent_id" = d2."id";

    ALTER TABLE "users" ADD COLUMN "department_id_old" integer;
    UPDATE "users" AS u SET "department_id_old" = d."id_old" FROM "departments" AS d WHERE u."department_id" = d."id";

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "departments_id_old" integer;
    UPDATE "payload_locked_documents_rels" AS r SET "departments_id_old" = d."id_old" FROM "departments" AS d WHERE r."departments_id" = d."id";

    ALTER TABLE "permissions_rels" ADD COLUMN "departments_id_old" integer;
    UPDATE "permissions_rels" AS r SET "departments_id_old" = d."id_old" FROM "departments" AS d WHERE r."departments_id" = d."id";

    ALTER TABLE "quick_links_rels" ADD COLUMN "departments_id_old" integer;
    UPDATE "quick_links_rels" AS r SET "departments_id_old" = d."id_old" FROM "departments" AS d WHERE r."departments_id" = d."id";

    ALTER TABLE "pre_departure"."department_page_access" ADD COLUMN "department_id_old" integer;
    UPDATE "pre_departure"."department_page_access" AS p SET "department_id_old" = d."id_old" FROM "departments" AS d WHERE p."department_id" = d."id";

    ALTER TABLE "departments" DROP CONSTRAINT "departments_parent_id_departments_id_fk";
    ALTER TABLE "users" DROP CONSTRAINT "users_department_id_departments_id_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_departments_fk";
    ALTER TABLE "permissions_rels" DROP CONSTRAINT "permissions_rels_departments_fk";
    ALTER TABLE "quick_links_rels" DROP CONSTRAINT "quick_links_rels_departments_fk";
    ALTER TABLE "pre_departure"."department_page_access" DROP CONSTRAINT "department_page_access_department_id_fkey";

    ALTER TABLE "departments" DROP COLUMN "parent_id";
    ALTER TABLE "departments" RENAME COLUMN "parent_id_old" TO "parent_id";

    ALTER TABLE "users" DROP COLUMN "department_id";
    ALTER TABLE "users" RENAME COLUMN "department_id_old" TO "department_id";

    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "departments_id";
    ALTER TABLE "payload_locked_documents_rels" RENAME COLUMN "departments_id_old" TO "departments_id";

    ALTER TABLE "permissions_rels" DROP COLUMN "departments_id";
    ALTER TABLE "permissions_rels" RENAME COLUMN "departments_id_old" TO "departments_id";

    ALTER TABLE "quick_links_rels" DROP COLUMN "departments_id";
    ALTER TABLE "quick_links_rels" RENAME COLUMN "departments_id_old" TO "departments_id";

    ALTER TABLE "pre_departure"."department_page_access" DROP COLUMN "department_id";
    ALTER TABLE "pre_departure"."department_page_access" RENAME COLUMN "department_id_old" TO "department_id";
    ALTER TABLE "pre_departure"."department_page_access" ALTER COLUMN "department_id" SET NOT NULL;

    ALTER TABLE "departments" DROP CONSTRAINT "departments_pkey";
    ALTER TABLE "departments" DROP COLUMN "id";
    ALTER TABLE "departments" RENAME COLUMN "id_old" TO "id";
    ALTER TABLE "departments" ADD PRIMARY KEY ("id");

    ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_departments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL;
    ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_departments_fk" FOREIGN KEY ("departments_id") REFERENCES "departments"("id") ON DELETE CASCADE;
    ALTER TABLE "permissions_rels" ADD CONSTRAINT "permissions_rels_departments_fk" FOREIGN KEY ("departments_id") REFERENCES "departments"("id") ON DELETE CASCADE;
    ALTER TABLE "quick_links_rels" ADD CONSTRAINT "quick_links_rels_departments_fk" FOREIGN KEY ("departments_id") REFERENCES "departments"("id") ON DELETE CASCADE;
    ALTER TABLE "pre_departure"."department_page_access" ADD CONSTRAINT "department_page_access_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE;
  `)
}

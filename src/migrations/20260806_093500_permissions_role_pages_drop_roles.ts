import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   -- Fold 'editor' into 'admin' before the enum loses the value; dedupe any
  -- resulting duplicate role row per user.
  -- The 'editor' enum label itself is left in place (harmless once unused) rather than
  -- recreating the enum type: a pre_departure Supabase RLS policy casts users_roles.value
  -- to enum_users_roles, and this migration's DB role lacks privileges on the auth schema
  -- to recreate that policy, so an ALTER TYPE ... USING rename dance isn't viable here.
  UPDATE "users_roles" SET "value" = 'admin' WHERE "value" = 'editor';
  DELETE FROM "users_roles" a USING "users_roles" b
  WHERE a.id > b.id AND a.parent_id = b.parent_id AND a.value = b.value;

  -- Permissions.role — which role tier(s) a rule applies to.
  CREATE TYPE "public"."enum_permissions_role" AS ENUM('super-admin', 'admin', 'user');
  CREATE TABLE "permissions_role" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_permissions_role",
  	"id" serial PRIMARY KEY NOT NULL
  );
  ALTER TABLE "permissions_role" ADD CONSTRAINT "permissions_role_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "permissions_role_order_idx" ON "permissions_role" USING btree ("order");
  CREATE INDEX "permissions_role_parent_idx" ON "permissions_role" USING btree ("parent_id");

  -- Permissions.collections -> Permissions.adminCollections (drop 'roles' option, add the
  -- content collections that previously had no Permission concept at all).
  CREATE TYPE "public"."enum_permissions_admin_collections" AS ENUM('all', 'pages', 'posts', 'media', 'categories', 'edms', 'events', 'knowledge-base', 'quick-links', 'time-zones', 'departments', 'permissions', 'users');
  CREATE TABLE "permissions_admin_collections" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_permissions_admin_collections",
  	"id" serial PRIMARY KEY NOT NULL
  );
  ALTER TABLE "permissions_admin_collections" ADD CONSTRAINT "permissions_admin_collections_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "permissions_admin_collections_order_idx" ON "permissions_admin_collections" USING btree ("order");
  CREATE INDEX "permissions_admin_collections_parent_idx" ON "permissions_admin_collections" USING btree ("parent_id");

  INSERT INTO "permissions_admin_collections" ("order", "parent_id", "value")
  SELECT "order", "parent_id", "value"::text::"public"."enum_permissions_admin_collections"
  FROM "permissions_collections"
  WHERE "value"::text != 'roles';

  DROP TABLE "permissions_collections" CASCADE;
  DROP TYPE "public"."enum_permissions_collections";

  -- Permissions.pages — front-end homepage sections / routes a rule grants visibility to.
  CREATE TYPE "public"."enum_permissions_pages" AS ENUM('all', 'home:quickLinks', 'home:knowledgeBase', 'home:eventsBlock', 'home:edmSlider', 'home:newsSlider', 'home:timeZones', 'home:featuredSpotlight', 'route:calendar', 'route:posts');
  CREATE TABLE "permissions_pages" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_permissions_pages",
  	"id" serial PRIMARY KEY NOT NULL
  );
  ALTER TABLE "permissions_pages" ADD CONSTRAINT "permissions_pages_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "permissions_pages_order_idx" ON "permissions_pages" USING btree ("order");
  CREATE INDEX "permissions_pages_parent_idx" ON "permissions_pages" USING btree ("parent_id");

  -- Nothing reads Permissions.key any more.
  DROP INDEX "permissions_key_idx";
  ALTER TABLE "permissions" DROP COLUMN "key";

  -- Drop the Roles collection entirely — nothing at runtime reads it.
  DROP TABLE "roles_rels" CASCADE;
  DROP TABLE "roles" CASCADE;

  -- Leftover columns from users.assignedRoles / payload's per-collection lock tracking,
  -- whose FK constraints were already removed by the cascading drop of "roles" above.
  DROP INDEX "users_rels_roles_id_idx";
  ALTER TABLE "users_rels" DROP COLUMN "roles_id";
  DROP INDEX "payload_locked_documents_rels_roles_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "roles_id";

  -- Seed one baseline, department-agnostic Permission so homepage sections stay visible
  -- for every role tier on day one, until admins narrow things down per department.
  DO $$
  DECLARE
    new_id integer;
  BEGIN
    INSERT INTO "permissions" ("name", "category", "description")
    VALUES ('Default homepage access', 'Baseline', 'Seeded so homepage sections stay visible by default until departments are configured.')
    RETURNING "id" INTO new_id;

    INSERT INTO "permissions_role" ("order", "parent_id", "value") VALUES
      (1, new_id, 'super-admin'),
      (2, new_id, 'admin'),
      (3, new_id, 'user');

    INSERT INTO "permissions_pages" ("order", "parent_id", "value") VALUES
      (1, new_id, 'all');
  END $$;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DELETE FROM "permissions" WHERE "name" = 'Default homepage access';

  DROP TABLE "permissions_pages" CASCADE;
  DROP TYPE "public"."enum_permissions_pages";

  CREATE TYPE "public"."enum_permissions_collections" AS ENUM('all', 'pages', 'posts', 'media', 'categories', 'departments', 'roles', 'permissions', 'users');
  CREATE TABLE "permissions_collections" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_permissions_collections",
  	"id" serial PRIMARY KEY NOT NULL
  );
  ALTER TABLE "permissions_collections" ADD CONSTRAINT "permissions_collections_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "permissions_collections_order_idx" ON "permissions_collections" USING btree ("order");
  CREATE INDEX "permissions_collections_parent_idx" ON "permissions_collections" USING btree ("parent_id");

  INSERT INTO "permissions_collections" ("order", "parent_id", "value")
  SELECT "order", "parent_id", "value"::text::"public"."enum_permissions_collections"
  FROM "permissions_admin_collections"
  WHERE "value"::text IN ('all','pages','posts','media','categories','departments','permissions','users');

  DROP TABLE "permissions_admin_collections" CASCADE;
  DROP TYPE "public"."enum_permissions_admin_collections";

  DROP TABLE "permissions_role" CASCADE;
  DROP TYPE "public"."enum_permissions_role";

  ALTER TABLE "permissions" ADD COLUMN "key" varchar;
  CREATE UNIQUE INDEX "permissions_key_idx" ON "permissions" USING btree ("key");

  -- 'editor' was never removed from enum_users_roles (see up()), so there is no enum to
  -- restore here — the folded editor->admin rows just stay admin on rollback.

  CREATE TABLE "roles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  CREATE TABLE "roles_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"permissions_id" integer,
  	"departments_id" integer
  );
  ALTER TABLE "roles_rels" ADD CONSTRAINT "roles_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "roles_rels" ADD CONSTRAINT "roles_rels_permissions_fk" FOREIGN KEY ("permissions_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "roles_rels" ADD CONSTRAINT "roles_rels_departments_fk" FOREIGN KEY ("departments_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "roles_name_idx" ON "roles" USING btree ("name");
  CREATE INDEX "roles_updated_at_idx" ON "roles" USING btree ("updated_at");
  CREATE INDEX "roles_created_at_idx" ON "roles" USING btree ("created_at");
  CREATE INDEX "roles_rels_order_idx" ON "roles_rels" USING btree ("order");
  CREATE INDEX "roles_rels_parent_idx" ON "roles_rels" USING btree ("parent_id");
  CREATE INDEX "roles_rels_permissions_id_idx" ON "roles_rels" USING btree ("permissions_id");
  CREATE INDEX "roles_rels_departments_id_idx" ON "roles_rels" USING btree ("departments_id");

  ALTER TABLE "users_rels" ADD COLUMN "roles_id" integer;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_roles_fk" FOREIGN KEY ("roles_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_rels_roles_id_idx" ON "users_rels" USING btree ("roles_id");

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "roles_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_roles_fk" FOREIGN KEY ("roles_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_roles_id_idx" ON "payload_locked_documents_rels" USING btree ("roles_id");
  `)
}

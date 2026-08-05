import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "permissions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"departments_id" integer
  );
  
  ALTER TABLE "roles" DROP CONSTRAINT "roles_department_id_departments_id_fk";
  
  DROP INDEX "roles_department_idx";
  ALTER TABLE "roles_rels" ADD COLUMN "departments_id" integer;
  ALTER TABLE "permissions_rels" ADD CONSTRAINT "permissions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "permissions_rels" ADD CONSTRAINT "permissions_rels_departments_fk" FOREIGN KEY ("departments_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "permissions_rels_order_idx" ON "permissions_rels" USING btree ("order");
  CREATE INDEX "permissions_rels_parent_idx" ON "permissions_rels" USING btree ("parent_id");
  CREATE INDEX "permissions_rels_path_idx" ON "permissions_rels" USING btree ("path");
  CREATE INDEX "permissions_rels_departments_id_idx" ON "permissions_rels" USING btree ("departments_id");
  ALTER TABLE "roles_rels" ADD CONSTRAINT "roles_rels_departments_fk" FOREIGN KEY ("departments_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "roles_rels_departments_id_idx" ON "roles_rels" USING btree ("departments_id");

  -- Carry existing single department_id values over into the new hasMany join table
  -- before dropping the column, so roles that already have a department don't lose it.
  INSERT INTO "roles_rels" ("order", "parent_id", "path", "departments_id")
  SELECT 1, "id", 'department', "department_id" FROM "roles" WHERE "department_id" IS NOT NULL;

  ALTER TABLE "roles" DROP COLUMN "department_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "permissions_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "permissions_rels" CASCADE;
  ALTER TABLE "roles_rels" DROP CONSTRAINT "roles_rels_departments_fk";
  
  DROP INDEX "roles_rels_departments_id_idx";
  ALTER TABLE "roles" ADD COLUMN "department_id" integer;
  ALTER TABLE "roles" ADD CONSTRAINT "roles_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "roles_department_idx" ON "roles" USING btree ("department_id");

  -- Restore a single department_id per role from the join table (first one wins, since the
  -- column being restored can't hold more than one).
  UPDATE "roles" SET "department_id" = "roles_rels"."departments_id"
  FROM "roles_rels"
  WHERE "roles_rels"."parent_id" = "roles"."id" AND "roles_rels"."path" = 'department';

  ALTER TABLE "roles_rels" DROP COLUMN "departments_id";`)
}

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "departments_name_idx";
  ALTER TABLE "departments" ADD COLUMN "org_unit_path" varchar;
  CREATE UNIQUE INDEX "departments_org_unit_path_idx" ON "departments" USING btree ("org_unit_path");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "departments_org_unit_path_idx";
  CREATE UNIQUE INDEX "departments_name_idx" ON "departments" USING btree ("name");
  ALTER TABLE "departments" DROP COLUMN "org_unit_path";`)
}

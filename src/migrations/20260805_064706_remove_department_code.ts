import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "departments_code_idx";
  ALTER TABLE "departments" DROP COLUMN "code";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "departments" ADD COLUMN "code" varchar;
  CREATE UNIQUE INDEX "departments_code_idx" ON "departments" USING btree ("code");`)
}

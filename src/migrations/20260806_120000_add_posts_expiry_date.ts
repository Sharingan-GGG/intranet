import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "posts" ADD COLUMN "expiry_date" timestamp(3) with time zone;
  ALTER TABLE "_posts_v" ADD COLUMN "version_expiry_date" timestamp(3) with time zone;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "posts" DROP COLUMN "expiry_date";
  ALTER TABLE "_posts_v" DROP COLUMN "version_expiry_date";
  `)
}

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "permissions_rels" ADD COLUMN "users_id" varchar;
  ALTER TABLE "permissions_rels" ADD CONSTRAINT "permissions_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "permissions_rels_users_id_idx" ON "permissions_rels" USING btree ("users_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "permissions_rels" DROP CONSTRAINT "permissions_rels_users_fk";
  
  DROP INDEX "permissions_rels_users_id_idx";
  ALTER TABLE "permissions_rels" DROP COLUMN "users_id";`)
}

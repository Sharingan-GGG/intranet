import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "quick_links_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"departments_id" integer
  );

  ALTER TABLE "quick_links_rels" ADD CONSTRAINT "quick_links_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."quick_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quick_links_rels" ADD CONSTRAINT "quick_links_rels_departments_fk" FOREIGN KEY ("departments_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "quick_links_rels_order_idx" ON "quick_links_rels" USING btree ("order");
  CREATE INDEX "quick_links_rels_parent_idx" ON "quick_links_rels" USING btree ("parent_id");
  CREATE INDEX "quick_links_rels_path_idx" ON "quick_links_rels" USING btree ("path");
  CREATE INDEX "quick_links_rels_departments_id_idx" ON "quick_links_rels" USING btree ("departments_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "quick_links_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "quick_links_rels" CASCADE;`)
}

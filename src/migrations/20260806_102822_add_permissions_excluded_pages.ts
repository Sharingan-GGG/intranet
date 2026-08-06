import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_permissions_excluded_pages" AS ENUM('all', 'home:quickLinks', 'home:knowledgeBase', 'home:eventsBlock', 'home:edmSlider', 'home:newsSlider', 'home:timeZones', 'home:featuredSpotlight', 'route:calendar', 'route:posts', 'route:search', 'route:seat-scanner', 'route:pre-departure');
  CREATE TABLE "permissions_excluded_pages" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_permissions_excluded_pages",
  	"id" serial PRIMARY KEY NOT NULL
  );
  ALTER TABLE "permissions_excluded_pages" ADD CONSTRAINT "permissions_excluded_pages_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "permissions_excluded_pages_order_idx" ON "permissions_excluded_pages" USING btree ("order");
  CREATE INDEX "permissions_excluded_pages_parent_idx" ON "permissions_excluded_pages" USING btree ("parent_id");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "permissions_excluded_pages" CASCADE;
  DROP TYPE "public"."enum_permissions_excluded_pages";
  `)
}

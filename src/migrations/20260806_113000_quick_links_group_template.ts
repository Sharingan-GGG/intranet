import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "quick_links" ADD COLUMN "name" varchar;
  UPDATE "quick_links" SET "name" = "label";
  ALTER TABLE "quick_links" ALTER COLUMN "name" SET NOT NULL;

  CREATE TABLE "quick_links_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"image_id" integer,
  	"link" varchar NOT NULL
  );

  ALTER TABLE "quick_links_links" ADD CONSTRAINT "quick_links_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quick_links"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quick_links_links" ADD CONSTRAINT "quick_links_links_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "quick_links_links_order_idx" ON "quick_links_links" USING btree ("_order");
  CREATE INDEX "quick_links_links_parent_id_idx" ON "quick_links_links" USING btree ("_parent_id");
  CREATE INDEX "quick_links_links_image_idx" ON "quick_links_links" USING btree ("image_id");

  -- Carry each existing flat quick-link over into its own single-item group,
  -- so pre-existing rows keep working once label/image/link move off the parent.
  INSERT INTO "quick_links_links" ("_order", "_parent_id", "id", "label", "image_id", "link")
  SELECT 1, "id", substr(md5(random()::text || clock_timestamp()::text), 1, 24), "label", "image_id", "link"
  FROM "quick_links";

  ALTER TABLE "quick_links" DROP CONSTRAINT "quick_links_image_id_media_id_fk";
  ALTER TABLE "quick_links" DROP COLUMN "label";
  ALTER TABLE "quick_links" DROP COLUMN "image_id";
  ALTER TABLE "quick_links" DROP COLUMN "link";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "quick_links" ADD COLUMN "label" varchar;
  ALTER TABLE "quick_links" ADD COLUMN "image_id" integer;
  ALTER TABLE "quick_links" ADD COLUMN "link" varchar;

  -- Restore only the first link of each group, since the flat column shape
  -- being restored can't hold more than one link per row.
  UPDATE "quick_links" SET
  	"label" = "quick_links_links"."label",
  	"image_id" = "quick_links_links"."image_id",
  	"link" = "quick_links_links"."link"
  FROM "quick_links_links"
  WHERE "quick_links_links"."_parent_id" = "quick_links"."id" AND "quick_links_links"."_order" = 1;

  ALTER TABLE "quick_links" ALTER COLUMN "label" SET NOT NULL;
  ALTER TABLE "quick_links" ALTER COLUMN "link" SET NOT NULL;
  ALTER TABLE "quick_links" ADD CONSTRAINT "quick_links_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE "quick_links_links" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "quick_links_links" CASCADE;

  ALTER TABLE "quick_links" DROP COLUMN "name";`)
}

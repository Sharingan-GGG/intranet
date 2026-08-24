import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "pages_blocks_feedback_cards" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"button_label" varchar,
  	"button_url" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_feedback_cards" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"button_label" varchar,
  	"button_url" varchar,
  	"_uuid" varchar
  );
  
  ALTER TABLE "pages_blocks_feedback_cards" ADD CONSTRAINT "pages_blocks_feedback_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_feedback"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_feedback_cards" ADD CONSTRAINT "_pages_v_blocks_feedback_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_feedback"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "pages_blocks_feedback_cards_order_idx" ON "pages_blocks_feedback_cards" USING btree ("_order");
  CREATE INDEX "pages_blocks_feedback_cards_parent_id_idx" ON "pages_blocks_feedback_cards" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_feedback_cards_order_idx" ON "_pages_v_blocks_feedback_cards" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_feedback_cards_parent_id_idx" ON "_pages_v_blocks_feedback_cards" USING btree ("_parent_id");

  INSERT INTO "pages_blocks_feedback_cards" ("_order", "_parent_id", "id", "title", "description", "button_label", "button_url")
  SELECT 1, "id", gen_random_uuid()::varchar, "org_chart_title", "org_chart_description", "org_chart_button_label", "org_chart_button_url"
  FROM "pages_blocks_feedback" WHERE "org_chart_title" IS NOT NULL;
  INSERT INTO "pages_blocks_feedback_cards" ("_order", "_parent_id", "id", "title", "description", "button_label", "button_url")
  SELECT 2, "id", gen_random_uuid()::varchar, "feedback_form_title", "feedback_form_description", "feedback_form_button_label", "feedback_form_button_url"
  FROM "pages_blocks_feedback" WHERE "feedback_form_title" IS NOT NULL;
  INSERT INTO "_pages_v_blocks_feedback_cards" ("_order", "_parent_id", "title", "description", "button_label", "button_url")
  SELECT 1, "id", "org_chart_title", "org_chart_description", "org_chart_button_label", "org_chart_button_url"
  FROM "_pages_v_blocks_feedback" WHERE "org_chart_title" IS NOT NULL;
  INSERT INTO "_pages_v_blocks_feedback_cards" ("_order", "_parent_id", "title", "description", "button_label", "button_url")
  SELECT 2, "id", "feedback_form_title", "feedback_form_description", "feedback_form_button_label", "feedback_form_button_url"
  FROM "_pages_v_blocks_feedback" WHERE "feedback_form_title" IS NOT NULL;

  ALTER TABLE "pages_blocks_feedback" DROP COLUMN "org_chart_title";
  ALTER TABLE "pages_blocks_feedback" DROP COLUMN "org_chart_description";
  ALTER TABLE "pages_blocks_feedback" DROP COLUMN "org_chart_button_label";
  ALTER TABLE "pages_blocks_feedback" DROP COLUMN "org_chart_button_url";
  ALTER TABLE "pages_blocks_feedback" DROP COLUMN "feedback_form_title";
  ALTER TABLE "pages_blocks_feedback" DROP COLUMN "feedback_form_description";
  ALTER TABLE "pages_blocks_feedback" DROP COLUMN "feedback_form_button_label";
  ALTER TABLE "pages_blocks_feedback" DROP COLUMN "feedback_form_button_url";
  ALTER TABLE "_pages_v_blocks_feedback" DROP COLUMN "org_chart_title";
  ALTER TABLE "_pages_v_blocks_feedback" DROP COLUMN "org_chart_description";
  ALTER TABLE "_pages_v_blocks_feedback" DROP COLUMN "org_chart_button_label";
  ALTER TABLE "_pages_v_blocks_feedback" DROP COLUMN "org_chart_button_url";
  ALTER TABLE "_pages_v_blocks_feedback" DROP COLUMN "feedback_form_title";
  ALTER TABLE "_pages_v_blocks_feedback" DROP COLUMN "feedback_form_description";
  ALTER TABLE "_pages_v_blocks_feedback" DROP COLUMN "feedback_form_button_label";
  ALTER TABLE "_pages_v_blocks_feedback" DROP COLUMN "feedback_form_button_url";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "pages_blocks_feedback_cards" CASCADE;
  DROP TABLE "_pages_v_blocks_feedback_cards" CASCADE;
  ALTER TABLE "pages_blocks_feedback" ADD COLUMN "org_chart_title" varchar DEFAULT 'CTG Organisational Chart';
  ALTER TABLE "pages_blocks_feedback" ADD COLUMN "org_chart_description" varchar DEFAULT 'See how the Complex Travel Group teams fit together.';
  ALTER TABLE "pages_blocks_feedback" ADD COLUMN "org_chart_button_label" varchar DEFAULT 'View';
  ALTER TABLE "pages_blocks_feedback" ADD COLUMN "org_chart_button_url" varchar;
  ALTER TABLE "pages_blocks_feedback" ADD COLUMN "feedback_form_title" varchar DEFAULT 'Provide Feedback';
  ALTER TABLE "pages_blocks_feedback" ADD COLUMN "feedback_form_description" varchar DEFAULT 'Submit your feedback or ideas for improvement across the organisation. Not limited to Intranet only - think big or think small. We want to hear it.';
  ALTER TABLE "pages_blocks_feedback" ADD COLUMN "feedback_form_button_label" varchar DEFAULT 'Send';
  ALTER TABLE "pages_blocks_feedback" ADD COLUMN "feedback_form_button_url" varchar;
  ALTER TABLE "_pages_v_blocks_feedback" ADD COLUMN "org_chart_title" varchar DEFAULT 'CTG Organisational Chart';
  ALTER TABLE "_pages_v_blocks_feedback" ADD COLUMN "org_chart_description" varchar DEFAULT 'See how the Complex Travel Group teams fit together.';
  ALTER TABLE "_pages_v_blocks_feedback" ADD COLUMN "org_chart_button_label" varchar DEFAULT 'View';
  ALTER TABLE "_pages_v_blocks_feedback" ADD COLUMN "org_chart_button_url" varchar;
  ALTER TABLE "_pages_v_blocks_feedback" ADD COLUMN "feedback_form_title" varchar DEFAULT 'Provide Feedback';
  ALTER TABLE "_pages_v_blocks_feedback" ADD COLUMN "feedback_form_description" varchar DEFAULT 'Submit your feedback or ideas for improvement across the organisation. Not limited to Intranet only - think big or think small. We want to hear it.';
  ALTER TABLE "_pages_v_blocks_feedback" ADD COLUMN "feedback_form_button_label" varchar DEFAULT 'Send';
  ALTER TABLE "_pages_v_blocks_feedback" ADD COLUMN "feedback_form_button_url" varchar;`)
}

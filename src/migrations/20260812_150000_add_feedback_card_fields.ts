import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_feedback" ADD COLUMN "org_chart_title" varchar;
  ALTER TABLE "pages_blocks_feedback" ADD COLUMN "org_chart_description" varchar;
  ALTER TABLE "pages_blocks_feedback" ADD COLUMN "org_chart_button_label" varchar;
  ALTER TABLE "pages_blocks_feedback" ADD COLUMN "org_chart_button_url" varchar;
  ALTER TABLE "pages_blocks_feedback" ADD COLUMN "feedback_form_title" varchar;
  ALTER TABLE "pages_blocks_feedback" ADD COLUMN "feedback_form_description" varchar;
  ALTER TABLE "pages_blocks_feedback" ADD COLUMN "feedback_form_button_label" varchar;
  ALTER TABLE "pages_blocks_feedback" ADD COLUMN "feedback_form_button_url" varchar;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "pages_blocks_feedback" DROP COLUMN "org_chart_title";
  ALTER TABLE "pages_blocks_feedback" DROP COLUMN "org_chart_description";
  ALTER TABLE "pages_blocks_feedback" DROP COLUMN "org_chart_button_label";
  ALTER TABLE "pages_blocks_feedback" DROP COLUMN "org_chart_button_url";
  ALTER TABLE "pages_blocks_feedback" DROP COLUMN "feedback_form_title";
  ALTER TABLE "pages_blocks_feedback" DROP COLUMN "feedback_form_description";
  ALTER TABLE "pages_blocks_feedback" DROP COLUMN "feedback_form_button_label";
  ALTER TABLE "pages_blocks_feedback" DROP COLUMN "feedback_form_button_url";
  `)
}

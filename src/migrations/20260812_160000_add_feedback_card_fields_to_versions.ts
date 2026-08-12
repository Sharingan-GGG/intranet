import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "_pages_v_blocks_feedback" ADD COLUMN "org_chart_title" varchar;
  ALTER TABLE "_pages_v_blocks_feedback" ADD COLUMN "org_chart_description" varchar;
  ALTER TABLE "_pages_v_blocks_feedback" ADD COLUMN "org_chart_button_label" varchar;
  ALTER TABLE "_pages_v_blocks_feedback" ADD COLUMN "org_chart_button_url" varchar;
  ALTER TABLE "_pages_v_blocks_feedback" ADD COLUMN "feedback_form_title" varchar;
  ALTER TABLE "_pages_v_blocks_feedback" ADD COLUMN "feedback_form_description" varchar;
  ALTER TABLE "_pages_v_blocks_feedback" ADD COLUMN "feedback_form_button_label" varchar;
  ALTER TABLE "_pages_v_blocks_feedback" ADD COLUMN "feedback_form_button_url" varchar;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "_pages_v_blocks_feedback" DROP COLUMN "org_chart_title";
  ALTER TABLE "_pages_v_blocks_feedback" DROP COLUMN "org_chart_description";
  ALTER TABLE "_pages_v_blocks_feedback" DROP COLUMN "org_chart_button_label";
  ALTER TABLE "_pages_v_blocks_feedback" DROP COLUMN "org_chart_button_url";
  ALTER TABLE "_pages_v_blocks_feedback" DROP COLUMN "feedback_form_title";
  ALTER TABLE "_pages_v_blocks_feedback" DROP COLUMN "feedback_form_description";
  ALTER TABLE "_pages_v_blocks_feedback" DROP COLUMN "feedback_form_button_label";
  ALTER TABLE "_pages_v_blocks_feedback" DROP COLUMN "feedback_form_button_url";
  `)
}

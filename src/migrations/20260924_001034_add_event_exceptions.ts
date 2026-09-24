import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_events_exceptions_action" AS ENUM('move', 'cancel');
  CREATE TABLE "events_exceptions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"original_date" timestamp(3) with time zone,
  	"action" "enum_events_exceptions_action" DEFAULT 'move',
  	"new_date" timestamp(3) with time zone,
  	"new_time" timestamp(3) with time zone
  );
  
  ALTER TABLE "events_exceptions" ADD CONSTRAINT "events_exceptions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "events_exceptions_order_idx" ON "events_exceptions" USING btree ("_order");
  CREATE INDEX "events_exceptions_parent_id_idx" ON "events_exceptions" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "events_exceptions" CASCADE;
  DROP TYPE "public"."enum_events_exceptions_action";`)
}

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_permissions_pages" ADD VALUE 'route:search';
  ALTER TYPE "public"."enum_permissions_pages" ADD VALUE 'route:seat-scanner';
  ALTER TYPE "public"."enum_permissions_pages" ADD VALUE 'route:pre-departure';
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Postgres has no DROP VALUE for enums — see 20260806_100117's down() for the same
  // constraint. Leaving these labels in the enum on rollback is harmless once unused.
}

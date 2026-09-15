import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Registers the Audit Hub's page key so it can be granted and excluded like any
 * other route. Both enums have to learn the value: `pages` drives the grant
 * select and `excluded_pages` the exclude select, and access is default-deny via
 * a global exclude rule, so a key missing from the second one cannot be denied.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TYPE "public"."enum_permissions_pages" ADD VALUE 'route:audit';
  ALTER TYPE "public"."enum_permissions_excluded_pages" ADD VALUE 'route:audit';
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Postgres has no DROP VALUE for enums — see 20260806_101922's down() for the
  // same constraint. Leaving the label in the enum on rollback is harmless once
  // unused.
}

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * `editor` is a live role (users.roles still has it) and the Permissions `role`
 * select offers it, but 20260806_093500 built enum_permissions_role without it,
 * so saving a rule that targets editors failed at the insert.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TYPE "public"."enum_permissions_role" ADD VALUE IF NOT EXISTS 'editor';
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Postgres has no DROP VALUE for enums; leaving the label is harmless.
}

import { sql } from 'drizzle-orm';
import { db, pool } from './client';

/**
 * Rolls back the most recent migration batch by dropping the last journal entry.
 * For a full rollback, drop the database and re-run migrations.
 *
 * NOTE: Drizzle does not support automatic down-migrations.
 * This script removes the last entry from __drizzle_migrations so the
 * migration will re-run on the next `db:migrate` call.
 */
async function main() {
  console.log('▶ Rolling back last migration...');

  const result = await db.execute(
    sql`SELECT id FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1`,
  );

  if (!result.rows.length) {
    console.log('No migrations to roll back.');
    await pool.end();
    return;
  }

  const lastId = result.rows[0].id;
  await db.execute(sql`DELETE FROM __drizzle_migrations WHERE id = ${lastId}`);
  console.log(`✅ Rolled back migration id: ${String(lastId)}`);
  console.log('Re-run db:migrate after manually reverting the schema change.');

  await pool.end();
}

main().catch((err) => {
  console.error('❌ Rollback failed:', err);
  process.exit(1);
});

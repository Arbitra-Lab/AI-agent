import { Pool } from 'pg';

/**
 * A dedicated Postgres pool for the running server (readiness checks today,
 * request handlers as routes are added). Kept separate from db/client.ts,
 * which powers the Drizzle-based migrate/seed/rollback CLI scripts - those
 * live outside tsconfig's rootDir ("./src") and importing across that
 * boundary breaks `tsc` (the build script). If/when route handlers need
 * real query access via Drizzle, that's worth solving deliberately (likely
 * by widening rootDir) rather than as a side effect of this issue.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DATABASE_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('[db] unexpected error on idle client', err);
});

export async function closeDb(): Promise<void> {
  await pool.end();
}

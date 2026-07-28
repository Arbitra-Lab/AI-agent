import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as schema from "./schema";

dotenv.config();

/**
 * Shared Postgres pool + Drizzle instance used across the app (routes,
 * scripts, migrations). Keeping a single pool means readiness checks and
 * request handlers reuse the same connections instead of opening new ones.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Keep this modest - this is a single backend service, not a
  // high-concurrency web tier. Tune via env if that changes.
  max: Number(process.env.DATABASE_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  // Idle client errors (e.g. dropped connections) shouldn't crash the
  // process - the pool will create a new client on the next checkout.
  // eslint-disable-next-line no-console
  console.error("[db] unexpected error on idle client", err);
});

export const db = drizzle(pool, { schema });

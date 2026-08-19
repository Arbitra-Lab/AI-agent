import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { chainCursors } from '../schema';
import type { CursorStore } from '../../src/blockchain/verification/reconciler';

/**
 * Postgres-backed CursorStore for chain-polling jobs.
 * Upserts by cursor name so each job has exactly one durable position.
 */
export class DrizzleCursorStore implements CursorStore {
  constructor(private readonly db: NodePgDatabase<Record<string, unknown>>) {}

  async get(name: string): Promise<string | null> {
    const rows = await this.db
      .select({ cursor: chainCursors.cursor })
      .from(chainCursors)
      .where(eq(chainCursors.name, name))
      .limit(1);
    return rows[0]?.cursor ?? null;
  }

  async set(name: string, cursor: string): Promise<void> {
    await this.db
      .insert(chainCursors)
      .values({ name, cursor, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: chainCursors.name,
        set: { cursor, updatedAt: new Date() },
      });
  }
}

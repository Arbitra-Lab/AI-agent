import { and, eq, isNotNull, notInArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { escrows } from '../schema';
import type {
  EscrowStateRepository,
  LocalEscrowRecord,
} from '../../src/blockchain/verification/reconciler';
import type { LocalEscrowState } from '../../src/blockchain/verification/types';

/** States that no longer need chain reconciliation. */
const TERMINAL_STATES: LocalEscrowState[] = ['released', 'refunded', 'expired'];

/**
 * Postgres-backed EscrowStateRepository. Tracks escrows that have an
 * on-chain contract id and have not reached a terminal state.
 */
export class DrizzleEscrowStateRepository implements EscrowStateRepository {
  constructor(private readonly db: NodePgDatabase<Record<string, unknown>>) {}

  async listTracked(): Promise<LocalEscrowRecord[]> {
    const rows = await this.db
      .select({
        id: escrows.id,
        contractId: escrows.contractId,
        state: escrows.state,
      })
      .from(escrows)
      .where(
        and(
          isNotNull(escrows.contractId),
          notInArray(escrows.state, TERMINAL_STATES),
        ),
      );

    return rows
      .filter(
        (row): row is typeof row & { contractId: string } =>
          row.contractId !== null,
      )
      .map((row) => ({
        id: row.id,
        chainEscrowId: row.contractId,
        state: row.state,
      }));
  }

  async updateState(id: string, state: LocalEscrowState): Promise<void> {
    await this.db
      .update(escrows)
      .set({
        state,
        updatedAt: new Date(),
        ...(state === 'released' ? { releasedAt: new Date() } : {}),
      })
      .where(eq(escrows.id, id));
  }
}

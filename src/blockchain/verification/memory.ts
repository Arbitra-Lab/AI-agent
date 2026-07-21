import { CursorStore, EscrowStateRepository, LocalEscrowRecord } from './reconciler';
import { LocalEscrowState } from './types';

/**
 * In-memory adapters for the reconciliation ports. Used in tests and as a
 * stand-in until the Postgres wiring (db/adapters) is connected.
 */

export class InMemoryCursorStore implements CursorStore {
  private cursors = new Map<string, string>();

  async get(name: string): Promise<string | null> {
    return this.cursors.get(name) ?? null;
  }

  async set(name: string, cursor: string): Promise<void> {
    this.cursors.set(name, cursor);
  }
}

export class InMemoryEscrowStateRepository implements EscrowStateRepository {
  private records = new Map<string, LocalEscrowRecord>();
  /** Every updateState call, for asserting idempotency in tests. */
  readonly updateCalls: Array<{ id: string; state: LocalEscrowState }> = [];

  seed(record: LocalEscrowRecord): void {
    this.records.set(record.id, { ...record });
  }

  getById(id: string): LocalEscrowRecord | undefined {
    return this.records.get(id);
  }

  async listTracked(): Promise<LocalEscrowRecord[]> {
    return [...this.records.values()].map((r) => ({ ...r }));
  }

  async updateState(id: string, state: LocalEscrowState): Promise<void> {
    const record = this.records.get(id);
    if (!record) {
      throw new Error(`Escrow ${id} not found`);
    }
    record.state = state;
    this.updateCalls.push({ id, state });
  }
}

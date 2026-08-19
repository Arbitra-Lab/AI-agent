import {
  CursorStore,
  EscrowStateRepository,
  LocalEscrowRecord,
} from './reconciler';
import { LocalEscrowState } from './types';

/**
 * In-memory adapters for the reconciliation ports. Used in tests and as a
 * stand-in until the Postgres wiring (db/adapters) is connected.
 */

export class InMemoryCursorStore implements CursorStore {
  private cursors = new Map<string, string>();

  get(name: string): Promise<string | null> {
    return Promise.resolve(this.cursors.get(name) ?? null);
  }

  set(name: string, cursor: string): Promise<void> {
    this.cursors.set(name, cursor);
    return Promise.resolve();
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

  listTracked(): Promise<LocalEscrowRecord[]> {
    return Promise.resolve([...this.records.values()].map((r) => ({ ...r })));
  }

  updateState(id: string, state: LocalEscrowState): Promise<void> {
    const record = this.records.get(id);
    if (!record) {
      throw new Error(`Escrow ${id} not found`);
    }
    record.state = state;
    this.updateCalls.push({ id, state });
    return Promise.resolve();
  }
}

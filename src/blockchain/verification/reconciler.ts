import { logger } from '../../lib/logger';
import { HorizonReader } from './horizon';
import { ChainEscrowStatus, LocalEscrowState } from './types';

/**
 * Escrow state reconciliation: syncs local (Postgres) escrow state from the
 * authoritative on-chain state read via the escrow contract's get_escrow.
 *
 * Invariants:
 *  - Chain state ALWAYS wins on conflict. The database is a cache.
 *  - Reprocessing is idempotent: an escrow already in the chain-derived
 *    state is left untouched, and an already-processed ledger is skipped.
 *  - Divergence where the local state is AHEAD of the chain (e.g. local
 *    says 'released' while the chain says 'funded') is logged loudly as a
 *    bug signal — it means something wrote local state without chain
 *    confirmation.
 */

/** Reader for authoritative escrow state; EscrowContractClient satisfies this. */
export interface EscrowChainReader {
  getEscrow(escrowId: string): Promise<{ status: ChainEscrowStatus }>;
}

/** Local escrow row, as far as reconciliation cares. */
export interface LocalEscrowRecord {
  /** Local primary key (uuid) */
  id: string;
  /** On-chain escrow identifier used with get_escrow */
  chainEscrowId: string;
  state: LocalEscrowState;
}

export interface EscrowStateRepository {
  /** Escrows that have an on-chain id and should be kept in sync. */
  listTracked(): Promise<LocalEscrowRecord[]>;
  updateState(id: string, state: LocalEscrowState): Promise<void>;
}

/** Durable cursor so restarts resume instead of replaying from genesis. */
export interface CursorStore {
  get(name: string): Promise<string | null>;
  set(name: string, cursor: string): Promise<void>;
}

export function mapChainStatusToLocalState(status: ChainEscrowStatus): LocalEscrowState {
  switch (status) {
    case 'PENDING_FUNDING':
      return 'pending_deposit';
    case 'FUNDED':
      return 'funded';
    case 'DISPUTED':
      return 'disputed';
    case 'RELEASED':
      return 'released';
  }
}

/**
 * Lifecycle rank used only to classify divergence severity. A local state
 * ranked above the chain-derived state means the local cache claimed
 * progress the ledger never confirmed — that is a bug, not normal lag.
 */
const STATE_RANK: Record<LocalEscrowState, number> = {
  pending_deposit: 0,
  funded: 1,
  conditions_met: 2,
  disputed: 2,
  released: 3,
  refunded: 3,
  expired: 3,
};

export interface ReconcileResult {
  escrowId: string;
  changed: boolean;
  from: LocalEscrowState;
  to: LocalEscrowState;
  /** True when local state was ahead of chain state (bug signal). */
  divergedAheadOfChain: boolean;
}

export class EscrowReconciler {
  constructor(
    private readonly chain: EscrowChainReader,
    private readonly repo: EscrowStateRepository,
    private readonly log: Pick<typeof logger, 'info' | 'warn' | 'error'> = logger,
  ) {}

  /**
   * Reads authoritative state for one escrow and updates the local row if
   * it differs. Idempotent: a second call with unchanged chain state is a
   * no-op.
   */
  async reconcileEscrow(record: LocalEscrowRecord): Promise<ReconcileResult> {
    const chainState = await this.chain.getEscrow(record.chainEscrowId);
    const target = mapChainStatusToLocalState(chainState.status);

    if (record.state === target) {
      return {
        escrowId: record.id,
        changed: false,
        from: record.state,
        to: target,
        divergedAheadOfChain: false,
      };
    }

    const aheadOfChain = STATE_RANK[record.state] > STATE_RANK[target];
    if (aheadOfChain) {
      this.log.error(
        `[reconciliation] DIVERGENCE for escrow ${record.id} (chain id ${record.chainEscrowId}): ` +
          `local state '${record.state}' is ahead of chain state '${target}'. ` +
          `Local state was written without chain confirmation — this is a bug. Chain wins; overwriting.`,
      );
    } else {
      this.log.info(
        `[reconciliation] Escrow ${record.id}: syncing local state '${record.state}' -> '${target}' from chain.`,
      );
    }

    await this.repo.updateState(record.id, target);
    return {
      escrowId: record.id,
      changed: true,
      from: record.state,
      to: target,
      divergedAheadOfChain: aheadOfChain,
    };
  }
}

export interface ReconciliationRunSummary {
  /** True when the latest ledger was already processed and the run was a no-op. */
  skippedAlreadyProcessed: boolean;
  ledger: number;
  checked: number;
  updated: number;
  /** Escrows whose reconciliation threw; cursor is not advanced when non-empty. */
  errors: Array<{ escrowId: string; error: string }>;
}

export const DEFAULT_CURSOR_NAME = 'escrow-reconciliation';

/**
 * One reconciliation pass, keyed to the latest closed ledger with a durable
 * cursor:
 *  - restart-resume: a new process picks up the persisted cursor and does
 *    not replay ledgers it already processed
 *  - duplicate delivery: running twice against the same ledger is a no-op
 *  - the cursor only advances after a fully successful pass, so failures
 *    are retried on the next run
 */
export class ReconciliationJob {
  private readonly cursorName: string;

  constructor(
    private readonly horizon: Pick<HorizonReader, 'getLatestLedger'>,
    private readonly reconciler: EscrowReconciler,
    private readonly repo: EscrowStateRepository,
    private readonly cursors: CursorStore,
    options: { cursorName?: string } = {},
  ) {
    this.cursorName = options.cursorName ?? DEFAULT_CURSOR_NAME;
  }

  async runOnce(): Promise<ReconciliationRunSummary> {
    const latest = await this.horizon.getLatestLedger();
    const cursor = await this.cursors.get(this.cursorName);

    if (cursor !== null && Number(cursor) >= latest.sequence) {
      return {
        skippedAlreadyProcessed: true,
        ledger: latest.sequence,
        checked: 0,
        updated: 0,
        errors: [],
      };
    }

    const tracked = await this.repo.listTracked();
    let updated = 0;
    const errors: ReconciliationRunSummary['errors'] = [];

    for (const record of tracked) {
      try {
        const result = await this.reconciler.reconcileEscrow(record);
        if (result.changed) updated += 1;
      } catch (error) {
        errors.push({
          escrowId: record.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (errors.length === 0) {
      await this.cursors.set(this.cursorName, String(latest.sequence));
    } else {
      logger.warn(
        `[reconciliation] ${errors.length}/${tracked.length} escrows failed at ledger ${latest.sequence}; ` +
          `cursor not advanced, will retry next run.`,
      );
    }

    return {
      skippedAlreadyProcessed: false,
      ledger: latest.sequence,
      checked: tracked.length,
      updated,
      errors,
    };
  }
}

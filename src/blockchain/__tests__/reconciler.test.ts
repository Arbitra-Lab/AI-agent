/**
 * Tests for escrow state reconciliation (issue #24).
 */

import {
  EscrowChainReader,
  EscrowReconciler,
  ReconciliationJob,
  mapChainStatusToLocalState,
} from '../verification/reconciler';
import {
  InMemoryCursorStore,
  InMemoryEscrowStateRepository,
} from '../verification/memory';
import { ChainEscrowStatus } from '../verification/types';

const silentLog = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

function chainReporting(
  statuses: Record<string, ChainEscrowStatus>,
): EscrowChainReader {
  return {
    getEscrow(escrowId: string) {
      const status = statuses[escrowId];
      if (!status) throw new Error(`Escrow ${escrowId} not found on chain`);
      return Promise.resolve({ status });
    },
  };
}

function fixedLedger(sequence: number) {
  return {
    getLatestLedger() {
      return Promise.resolve({ sequence, closedAt: '2026-07-21T10:00:00Z' });
    },
  };
}

beforeEach(() => jest.clearAllMocks());

describe('mapChainStatusToLocalState', () => {
  it('maps every contract status to a local state', () => {
    expect(mapChainStatusToLocalState('PENDING_FUNDING')).toBe(
      'pending_deposit',
    );
    expect(mapChainStatusToLocalState('FUNDED')).toBe('funded');
    expect(mapChainStatusToLocalState('DISPUTED')).toBe('disputed');
    expect(mapChainStatusToLocalState('RELEASED')).toBe('released');
  });
});

describe('EscrowReconciler', () => {
  it('syncs stale local state from the chain (chain wins)', async () => {
    const repo = new InMemoryEscrowStateRepository();
    repo.seed({ id: 'esc-1', chainEscrowId: 'chain-1', state: 'funded' });
    const reconciler = new EscrowReconciler(
      chainReporting({ 'chain-1': 'RELEASED' }),
      repo,
      silentLog,
    );

    const result = await reconciler.reconcileEscrow(
      (await repo.listTracked())[0],
    );

    expect(result).toMatchObject({
      changed: true,
      from: 'funded',
      to: 'released',
    });
    expect(repo.getById('esc-1')?.state).toBe('released');
    // Normal forward progress is not a divergence bug
    expect(result.divergedAheadOfChain).toBe(false);
    expect(silentLog.error).not.toHaveBeenCalled();
  });

  it('is idempotent: duplicate delivery of the same chain state applies no update', async () => {
    const repo = new InMemoryEscrowStateRepository();
    repo.seed({ id: 'esc-1', chainEscrowId: 'chain-1', state: 'funded' });
    const reconciler = new EscrowReconciler(
      chainReporting({ 'chain-1': 'RELEASED' }),
      repo,
      silentLog,
    );

    const first = await reconciler.reconcileEscrow(
      (await repo.listTracked())[0],
    );
    const second = await reconciler.reconcileEscrow(
      (await repo.listTracked())[0],
    );

    expect(first.changed).toBe(true);
    expect(second.changed).toBe(false);
    expect(repo.updateCalls).toHaveLength(1);
    expect(repo.getById('esc-1')?.state).toBe('released');
  });

  it('logs loudly when local state is ahead of chain state, then lets chain win', async () => {
    const repo = new InMemoryEscrowStateRepository();
    // Local claims released, but the chain says only funded — bug signal.
    repo.seed({ id: 'esc-1', chainEscrowId: 'chain-1', state: 'released' });
    const reconciler = new EscrowReconciler(
      chainReporting({ 'chain-1': 'FUNDED' }),
      repo,
      silentLog,
    );

    const result = await reconciler.reconcileEscrow(
      (await repo.listTracked())[0],
    );

    expect(result.divergedAheadOfChain).toBe(true);
    expect(repo.getById('esc-1')?.state).toBe('funded');
    expect(silentLog.error).toHaveBeenCalledWith(
      expect.stringContaining('DIVERGENCE'),
    );
  });
});

describe('ReconciliationJob', () => {
  it('reconciles tracked escrows and persists the ledger cursor', async () => {
    const repo = new InMemoryEscrowStateRepository();
    repo.seed({
      id: 'esc-1',
      chainEscrowId: 'chain-1',
      state: 'pending_deposit',
    });
    repo.seed({ id: 'esc-2', chainEscrowId: 'chain-2', state: 'funded' });
    const cursors = new InMemoryCursorStore();
    const reconciler = new EscrowReconciler(
      chainReporting({ 'chain-1': 'FUNDED', 'chain-2': 'FUNDED' }),
      repo,
      silentLog,
    );
    const job = new ReconciliationJob(
      fixedLedger(500),
      reconciler,
      repo,
      cursors,
    );

    const summary = await job.runOnce();

    expect(summary).toMatchObject({
      checked: 2,
      updated: 1,
      ledger: 500,
      errors: [],
    });
    expect(repo.getById('esc-1')?.state).toBe('funded');
    expect(await cursors.get('escrow-reconciliation')).toBe('500');
  });

  it('skips an already-processed ledger (duplicate delivery is a no-op)', async () => {
    const repo = new InMemoryEscrowStateRepository();
    repo.seed({
      id: 'esc-1',
      chainEscrowId: 'chain-1',
      state: 'pending_deposit',
    });
    const cursors = new InMemoryCursorStore();
    const reconciler = new EscrowReconciler(
      chainReporting({ 'chain-1': 'FUNDED' }),
      repo,
      silentLog,
    );
    const job = new ReconciliationJob(
      fixedLedger(500),
      reconciler,
      repo,
      cursors,
    );

    await job.runOnce();
    const second = await job.runOnce();

    expect(second.skippedAlreadyProcessed).toBe(true);
    expect(repo.updateCalls).toHaveLength(1);
  });

  it('resumes from the persisted cursor after a restart', async () => {
    const repo = new InMemoryEscrowStateRepository();
    repo.seed({ id: 'esc-1', chainEscrowId: 'chain-1', state: 'funded' });
    const cursors = new InMemoryCursorStore(); // shared "durable" store
    const reconciler = new EscrowReconciler(
      chainReporting({ 'chain-1': 'FUNDED' }),
      repo,
      silentLog,
    );

    const firstProcess = new ReconciliationJob(
      fixedLedger(500),
      reconciler,
      repo,
      cursors,
    );
    await firstProcess.runOnce();

    // Simulate a restart: a brand-new job instance, same cursor store.
    const restarted = new ReconciliationJob(
      fixedLedger(500),
      reconciler,
      repo,
      cursors,
    );
    const afterRestart = await restarted.runOnce();
    expect(afterRestart.skippedAlreadyProcessed).toBe(true);

    // A newer ledger is processed normally.
    const laterLedger = new ReconciliationJob(
      fixedLedger(501),
      reconciler,
      repo,
      cursors,
    );
    const next = await laterLedger.runOnce();
    expect(next.skippedAlreadyProcessed).toBe(false);
    expect(await cursors.get('escrow-reconciliation')).toBe('501');
  });

  it('does not advance the cursor when an escrow fails, so the run is retried', async () => {
    const repo = new InMemoryEscrowStateRepository();
    repo.seed({
      id: 'esc-ok',
      chainEscrowId: 'chain-ok',
      state: 'pending_deposit',
    });
    repo.seed({
      id: 'esc-bad',
      chainEscrowId: 'chain-missing',
      state: 'funded',
    });
    const cursors = new InMemoryCursorStore();
    const reconciler = new EscrowReconciler(
      chainReporting({ 'chain-ok': 'FUNDED' }), // chain-missing throws
      repo,
      silentLog,
    );
    const job = new ReconciliationJob(
      fixedLedger(500),
      reconciler,
      repo,
      cursors,
    );

    const summary = await job.runOnce();

    expect(summary.errors).toEqual([
      { escrowId: 'esc-bad', error: expect.stringContaining('not found') },
    ]);
    // Healthy escrows still got reconciled…
    expect(repo.getById('esc-ok')?.state).toBe('funded');
    // …but the cursor stays put so the next run retries this ledger.
    expect(await cursors.get('escrow-reconciliation')).toBeNull();

    const retry = await job.runOnce();
    expect(retry.skippedAlreadyProcessed).toBe(false);
  });

  it('supports independent cursors per job name', async () => {
    const repo = new InMemoryEscrowStateRepository();
    const cursors = new InMemoryCursorStore();
    const reconciler = new EscrowReconciler(
      chainReporting({}),
      repo,
      silentLog,
    );

    const jobA = new ReconciliationJob(
      fixedLedger(100),
      reconciler,
      repo,
      cursors,
      {
        cursorName: 'job-a',
      },
    );
    await jobA.runOnce();

    expect(await cursors.get('job-a')).toBe('100');
    expect(await cursors.get('escrow-reconciliation')).toBeNull();
  });
});

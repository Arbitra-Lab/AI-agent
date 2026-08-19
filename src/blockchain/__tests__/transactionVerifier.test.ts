/**
 * Tests for on-chain transaction verification (issue #24).
 */

import {
  HorizonReader,
  HorizonTransactionRecord,
  HttpHorizonReader,
  HorizonRequestError,
  FetchLike,
} from '../verification/horizon';
import { TransactionVerifier } from '../verification/transactionVerifier';
import { decodeTransactionResultCode } from '../verification/xdr';

const HASH = 'deadbeef'.repeat(8);

/** TransactionResult XDR: fee (int64) followed by result code (int32). */
function resultXdrWithCode(code: number): string {
  const bytes = Buffer.alloc(12);
  bytes.writeBigInt64BE(100n, 0);
  bytes.writeInt32BE(code, 8);
  return bytes.toString('base64');
}

function successRecord(
  overrides: Partial<HorizonTransactionRecord> = {},
): HorizonTransactionRecord {
  return {
    hash: HASH,
    successful: true,
    ledger: 123456,
    created_at: '2026-07-21T10:00:00Z',
    paging_token: '530242871444480',
    ...overrides,
  };
}

class FakeHorizon implements HorizonReader {
  /** Responses returned in order; the last one repeats forever. */
  constructor(
    private readonly responses: Array<HorizonTransactionRecord | null>,
  ) {}
  calls = 0;

  getTransaction(): Promise<HorizonTransactionRecord | null> {
    const index = Math.min(this.calls, this.responses.length - 1);
    this.calls += 1;
    return Promise.resolve(this.responses[index]);
  }

  getLatestLedger() {
    return Promise.resolve({ sequence: 1, closedAt: '2026-07-21T10:00:00Z' });
  }
}

/** Deterministic clock: sleep() advances now() without real waiting. */
function fakeClock() {
  let t = 0;
  const delays: number[] = [];
  return {
    now: () => t,
    sleep: (ms: number) => {
      delays.push(ms);
      t += ms;
      return Promise.resolve();
    },
    delays,
  };
}

describe('TransactionVerifier.verifyTransaction', () => {
  it('returns pending when Horizon has no record of the hash', async () => {
    const verifier = new TransactionVerifier(new FakeHorizon([null]));
    const result = await verifier.verifyTransaction(HASH);
    expect(result).toEqual({ status: 'pending', hash: HASH });
  });

  it('returns success with ledger info for an applied transaction', async () => {
    const verifier = new TransactionVerifier(
      new FakeHorizon([successRecord()]),
    );
    const result = await verifier.verifyTransaction(HASH);

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.ledger).toBe(123456);
      expect(result.closedAt).toEqual(new Date('2026-07-21T10:00:00Z'));
    }
  });

  it('returns failed with decoded result codes for a rejected transaction', async () => {
    const record = successRecord({
      successful: false,
      result_xdr: resultXdrWithCode(-5), // txBAD_SEQ
    });
    const verifier = new TransactionVerifier(new FakeHorizon([record]));
    const result = await verifier.verifyTransaction(HASH);

    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.resultCodes.transaction).toBe('tx_bad_seq');
      expect(result.resultXdr).toBe(record.result_xdr);
      expect(result.ledger).toBe(123456);
    }
  });

  it('prefers result_codes from the record when present', async () => {
    const record = successRecord({
      successful: false,
      result_codes: {
        transaction: 'tx_failed',
        operations: ['op_underfunded'],
      },
    });
    const verifier = new TransactionVerifier(new FakeHorizon([record]));
    const result = await verifier.verifyTransaction(HASH);

    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.resultCodes).toEqual({
        transaction: 'tx_failed',
        operations: ['op_underfunded'],
      });
    }
  });
});

describe('TransactionVerifier.waitForTransaction', () => {
  it('polls until success', async () => {
    const horizon = new FakeHorizon([null, null, successRecord()]);
    const verifier = new TransactionVerifier(horizon);
    const clock = fakeClock();

    const result = await verifier.waitForTransaction(HASH, {
      timeoutMs: 60_000,
      sleep: clock.sleep,
      now: clock.now,
    });

    expect(result.status).toBe('success');
    expect(horizon.calls).toBe(3);
  });

  it('applies exponential backoff between polls, capped at maxDelayMs', async () => {
    const horizon = new FakeHorizon([null, null, null, null, successRecord()]);
    const verifier = new TransactionVerifier(horizon);
    const clock = fakeClock();

    await verifier.waitForTransaction(HASH, {
      timeoutMs: 600_000,
      initialDelayMs: 1_000,
      maxDelayMs: 4_000,
      backoffFactor: 2,
      sleep: clock.sleep,
      now: clock.now,
    });

    expect(clock.delays).toEqual([1_000, 2_000, 4_000, 4_000]);
  });

  it('returns an explicit timeout outcome instead of polling forever', async () => {
    const horizon = new FakeHorizon([null]); // never confirms
    const verifier = new TransactionVerifier(horizon);
    const clock = fakeClock();

    const result = await verifier.waitForTransaction(HASH, {
      timeoutMs: 10_000,
      initialDelayMs: 1_000,
      sleep: clock.sleep,
      now: clock.now,
    });

    expect(result.status).toBe('timeout');
    if (result.status === 'timeout') {
      expect(result.attempts).toBeGreaterThan(0);
      expect(result.elapsedMs).toBeLessThanOrEqual(10_000);
    }
  });

  it('stops after maxAttempts even if time budget remains', async () => {
    const horizon = new FakeHorizon([null]);
    const verifier = new TransactionVerifier(horizon);
    const clock = fakeClock();

    const result = await verifier.waitForTransaction(HASH, {
      timeoutMs: 600_000,
      maxAttempts: 3,
      sleep: clock.sleep,
      now: clock.now,
    });

    expect(result.status).toBe('timeout');
    expect(horizon.calls).toBe(3);
  });

  it('surfaces a failed transaction discovered mid-poll', async () => {
    const failed = successRecord({
      successful: false,
      result_xdr: resultXdrWithCode(-1),
    });
    const horizon = new FakeHorizon([null, failed]);
    const verifier = new TransactionVerifier(horizon);
    const clock = fakeClock();

    const result = await verifier.waitForTransaction(HASH, {
      sleep: clock.sleep,
      now: clock.now,
    });

    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.resultCodes.transaction).toBe('tx_failed');
    }
  });
});

describe('decodeTransactionResultCode', () => {
  it('decodes known transaction result codes', () => {
    expect(decodeTransactionResultCode(resultXdrWithCode(-1))).toBe(
      'tx_failed',
    );
    expect(decodeTransactionResultCode(resultXdrWithCode(-9))).toBe(
      'tx_insufficient_fee',
    );
    expect(decodeTransactionResultCode(resultXdrWithCode(-17))).toBe(
      'tx_soroban_invalid',
    );
  });

  it('labels unknown codes without throwing', () => {
    expect(decodeTransactionResultCode(resultXdrWithCode(-99))).toBe(
      'tx_unknown_code_-99',
    );
  });

  it('returns undefined for garbage input', () => {
    expect(decodeTransactionResultCode('not-xdr')).toBeUndefined();
    expect(decodeTransactionResultCode('')).toBeUndefined();
  });
});

describe('HttpHorizonReader', () => {
  function fakeFetch(status: number, body: unknown): FetchLike {
    return () =>
      Promise.resolve({
        status,
        ok: status >= 200 && status < 300,
        json: () => Promise.resolve(body),
      });
  }

  it('returns null for 404 (transaction not yet ingested)', async () => {
    const reader = new HttpHorizonReader(
      'https://horizon.example',
      fakeFetch(404, {}),
    );
    expect(await reader.getTransaction(HASH)).toBeNull();
  });

  it('returns the record on 200', async () => {
    const record = successRecord();
    const reader = new HttpHorizonReader(
      'https://horizon.example/',
      fakeFetch(200, record),
    );
    expect(await reader.getTransaction(HASH)).toEqual(record);
  });

  it('throws HorizonRequestError on server errors', async () => {
    const reader = new HttpHorizonReader(
      'https://horizon.example',
      fakeFetch(500, {}),
    );
    await expect(reader.getTransaction(HASH)).rejects.toThrow(
      HorizonRequestError,
    );
  });

  it('reads the latest ledger from the embedded records', async () => {
    const body = {
      _embedded: {
        records: [{ sequence: 999, closed_at: '2026-07-21T10:00:00Z' }],
      },
    };
    const reader = new HttpHorizonReader(
      'https://horizon.example',
      fakeFetch(200, body),
    );
    expect(await reader.getLatestLedger()).toEqual({
      sequence: 999,
      closedAt: '2026-07-21T10:00:00Z',
    });
  });
});

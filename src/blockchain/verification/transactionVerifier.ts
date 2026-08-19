import { HorizonReader, HorizonTransactionRecord } from './horizon';
import { decodeTransactionResultCode } from './xdr';
import {
  TransactionOutcome,
  TransactionResultCodes,
  TransactionVerification,
} from './types';

export interface WaitOptions {
  /** Give up after this much wall-clock time. Default 60s. */
  timeoutMs?: number;
  /** Give up after this many Horizon checks, regardless of time. Default 20. */
  maxAttempts?: number;
  /** Delay before the second check. Default 1s. */
  initialDelayMs?: number;
  /** Backoff cap. Default 10s. */
  maxDelayMs?: number;
  /** Multiplier applied to the delay after each pending check. Default 2. */
  backoffFactor?: number;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable for tests. */
  now?: () => number;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Verifies transaction finality against Horizon.
 *
 * The chain is the source of truth: statuses come exclusively from ledger
 * records. Polling is always bounded — `waitForTransaction` resolves to an
 * explicit 'timeout' outcome instead of polling forever or throwing.
 */
export class TransactionVerifier {
  constructor(private readonly horizon: HorizonReader) {}

  /**
   * Single point-in-time check of a transaction's on-chain status.
   * pending  — Horizon has no record of the hash yet
   * success  — included in a ledger and applied
   * failed   — included in a ledger but rejected; result codes attached
   */
  async verifyTransaction(hash: string): Promise<TransactionVerification> {
    const record = await this.horizon.getTransaction(hash);
    if (record === null) {
      return { status: 'pending', hash };
    }
    if (record.successful) {
      return {
        status: 'success',
        hash,
        ledger: record.ledger,
        closedAt: new Date(record.created_at),
      };
    }
    return {
      status: 'failed',
      hash,
      ledger: record.ledger,
      resultCodes: extractResultCodes(record),
      resultXdr: record.result_xdr,
    };
  }

  /**
   * Polls until the transaction reaches a final state (success/failed),
   * with exponential backoff, or returns an explicit 'timeout' outcome
   * once the time or attempt budget is exhausted.
   */
  async waitForTransaction(
    hash: string,
    options: WaitOptions = {},
  ): Promise<TransactionOutcome> {
    const timeoutMs = options.timeoutMs ?? 60_000;
    const maxAttempts = options.maxAttempts ?? 20;
    const maxDelayMs = options.maxDelayMs ?? 10_000;
    const backoffFactor = options.backoffFactor ?? 2;
    const sleep = options.sleep ?? defaultSleep;
    const now = options.now ?? Date.now;

    const startedAt = now();
    let delayMs = options.initialDelayMs ?? 1_000;
    let attempts = 0;

    for (;;) {
      attempts += 1;
      const verification = await this.verifyTransaction(hash);
      if (verification.status !== 'pending') {
        return verification;
      }

      const elapsedMs = now() - startedAt;
      if (attempts >= maxAttempts || elapsedMs + delayMs > timeoutMs) {
        return { status: 'timeout', hash, attempts, elapsedMs };
      }

      await sleep(delayMs);
      delayMs = Math.min(delayMs * backoffFactor, maxDelayMs);
    }
  }
}

function extractResultCodes(
  record: HorizonTransactionRecord,
): TransactionResultCodes {
  if (record.result_codes) {
    return record.result_codes;
  }
  if (record.result_xdr) {
    const transaction = decodeTransactionResultCode(record.result_xdr);
    if (transaction) {
      return { transaction };
    }
  }
  return {};
}

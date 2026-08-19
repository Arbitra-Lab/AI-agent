/**
 * On-chain transaction verification & reconciliation types.
 *
 * Core invariant: a submission acknowledgment is NOT success. Every
 * agent-facing status produced by this module is derived from what the
 * ledger (via Horizon) reports — never from the fact that a transaction
 * was accepted into the queue.
 */

/**
 * Result codes for a failed transaction, as reported by Horizon
 * (e.g. transaction: 'tx_bad_seq', operations: ['op_underfunded']).
 */
export interface TransactionResultCodes {
  transaction?: string;
  operations?: string[];
}

export interface PendingTransaction {
  status: 'pending';
  hash: string;
}

export interface SuccessfulTransaction {
  status: 'success';
  hash: string;
  /** Ledger sequence the transaction was included in */
  ledger: number;
  closedAt: Date;
}

export interface FailedTransaction {
  status: 'failed';
  hash: string;
  /** Ledger sequence the failed transaction was recorded in, if known */
  ledger?: number;
  resultCodes: TransactionResultCodes;
  /** Raw base64 TransactionResult XDR, for deeper debugging */
  resultXdr?: string;
}

/** Result of a single point-in-time verification against Horizon. */
export type TransactionVerification =
  PendingTransaction | SuccessfulTransaction | FailedTransaction;

/**
 * Polling gave up before the transaction reached a final state.
 * This is an explicit outcome, not an exception — callers must handle it
 * and must NOT report the transaction as succeeded or failed.
 */
export interface TransactionTimeout {
  status: 'timeout';
  hash: string;
  attempts: number;
  elapsedMs: number;
}

/** Final outcome of bounded polling: a verification or an explicit timeout. */
export type TransactionOutcome = TransactionVerification | TransactionTimeout;

/** Escrow status as reported by the escrow contract's get_escrow (issue #22). */
export type ChainEscrowStatus =
  'PENDING_FUNDING' | 'FUNDED' | 'DISPUTED' | 'RELEASED';

/** Escrow state values as stored in Postgres (db/schema/escrows.ts). */
export type LocalEscrowState =
  | 'pending_deposit'
  | 'funded'
  | 'conditions_met'
  | 'released'
  | 'refunded'
  | 'disputed'
  | 'expired';

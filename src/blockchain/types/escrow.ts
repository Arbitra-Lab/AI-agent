/**
 * Escrow Error Types
 * Maps contract error codes to readable, typed errors
 */

export enum EscrowErrorCode {
  // Access Control
  UNAUTHORIZED = 'UNAUTHORIZED',
  NOT_PARTY = 'NOT_PARTY',
  NOT_ARBITER = 'NOT_ARBITER',
  INVALID_MULTISIG = 'INVALID_MULTISIG',

  // Escrow State
  ESCROW_NOT_FOUND = 'ESCROW_NOT_FOUND',
  ALREADY_FUNDED = 'ALREADY_FUNDED',
  NOT_FUNDED = 'NOT_FUNDED',
  INVALID_STATE = 'INVALID_STATE',
  NOT_APPROVED = 'NOT_APPROVED',

  // Amount/Balance
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  AMOUNT_PRECISION_MISMATCH = 'AMOUNT_PRECISION_MISMATCH',

  // Timing
  TIMEOUT_NOT_REACHED = 'TIMEOUT_NOT_REACHED',
  TIMEOUT_ALREADY_EXECUTED = 'TIMEOUT_ALREADY_EXECUTED',

  // Release/Dispute
  INVALID_RELEASE_AMOUNT = 'INVALID_RELEASE_AMOUNT',
  DISPUTE_ALREADY_FILED = 'DISPUTE_ALREADY_FILED',
  DISPUTED_CANNOT_RELEASE = 'DISPUTED_CANNOT_RELEASE',

  // Simulation
  SIMULATION_FAILED = 'SIMULATION_FAILED',
  INSUFFICIENT_FEES = 'INSUFFICIENT_FEES',

  // Generic
  INVALID_INPUT = 'INVALID_INPUT',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class EscrowError extends Error {
  constructor(
    readonly code: EscrowErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'EscrowError';
    Object.setPrototypeOf(this, EscrowError.prototype);
  }
}

/**
 * Typed Escrow Configuration
 */
export interface EscrowConfig {
  /** Network name: 'testnet' or 'public' */
  network: 'testnet' | 'public';

  /** Contract ID for the escrow contract */
  contractId: string;

  /** Stellar Horizon endpoint */
  horizonUrl: string;

  /** Network passphrase for signing */
  networkPassphrase: string;
}

/**
 * Escrow Metadata
 */
export interface EscrowMetadata {
  escrowId: string;
  party1: string;
  party2: string;
  amount: bigint;
  asset: {
    code: string;
    issuer: string;
  };
  created: Date;
  status: 'PENDING_FUNDING' | 'FUNDED' | 'DISPUTED' | 'RELEASED';
  releaseCondition: string;
  timeoutSeconds: number;
  arbiter?: string;
}

/**
 * Approval Count Response
 */
export interface ApprovalCount {
  escrowId: string;
  totalApprovalsNeeded: number;
  currentApprovals: number;
  approvers: string[];
}

/**
 * Release History Entry
 */
export interface ReleaseHistoryEntry {
  timestamp: Date;
  releasedAmount: bigint;
  releasedTo: string;
  reason: string;
}

/**
 * Timeout Configuration
 */
export interface TimeoutConfig {
  escrowId: string;
  timeoutSeconds: number;
  createdAt: Date;
  expiresAt: Date;
  isExpired: boolean;
}

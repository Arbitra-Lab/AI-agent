/**
 * Arbitra AI Agent - Blockchain Module
 *
 * Typed TypeScript client for Soroban contracts on Stellar
 */

// Configuration
export { BlockchainConfig } from './config';

// Types
export {
  EscrowError,
  EscrowErrorCode,
  EscrowConfig,
  EscrowMetadata,
  ApprovalCount,
  ReleaseHistoryEntry,
  TimeoutConfig,
} from './types/escrow';

// Clients
export { EscrowContractClient } from './clients/escrow';

// Transaction verification & escrow state reconciliation
export * from './verification';

// Utilities
export {
  stringToBytes32,
  bytes32ToString,
  isValidStellarAddress,
  isValidEscrowId,
  validateAmount,
  formatAmount,
  parseAmount,
  createAssetId,
  parseAssetId,
} from './utils/soroban';

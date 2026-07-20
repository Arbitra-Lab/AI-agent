/**
 * Soroban Type Utilities
 * Helpers for working with Soroban contract types
 */

/**
 * Convert string to BytesN<32>
 * Used for escrow IDs and other 32-byte identifiers
 */
export function stringToBytes32(value: string): Uint8Array {
  // Remove 0x prefix if present
  let hex = value.startsWith('0x') ? value.slice(2) : value;

  // Validate hex format
  if (!/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error('Invalid hex format');
  }

  if (hex.length > 64) {
    throw new Error('BytesN<32> must be at most 64 hex characters');
  }

  // Pad with zeros if necessary
  const padded = hex.padEnd(64, '0');
  const bytes = new Uint8Array(32);

  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(padded.substr(i * 2, 2), 16);
  }

  return bytes;
}

/**
 * Convert BytesN<32> to hex string
 */
export function bytes32ToString(bytes: Uint8Array): string {
  if (bytes.length !== 32) {
    throw new Error('BytesN<32> must be exactly 32 bytes');
  }

  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Validate Stellar Address format
 */
export function isValidStellarAddress(address: string): boolean {
  // Stellar addresses start with 'G' and are exactly 56 characters total
  // Format: G followed by 55 characters from base32 alphabet (A-Z, 2-7)
  return /^G[A-Z2-7]{55}$/.test(address);
}

/**
 * Validate escrow ID format (hex string, up to 64 chars)
 */
export function isValidEscrowId(escrowId: string): boolean {
  return /^[0-9a-fA-F]{0,64}$/.test(escrowId);
}

/**
 * Validate amounts as bigint
 * Prevents precision loss from number type
 */
export function validateAmount(amount: unknown): bigint {
  if (typeof amount === 'bigint') return amount;
  if (typeof amount === 'string') return BigInt(amount);
  if (typeof amount === 'number') {
    if (!Number.isInteger(amount)) {
      throw new Error('Amount must be an integer (no decimals)');
    }
    return BigInt(amount);
  }

  throw new Error('Amount must be bigint, string, or integer number');
}

/**
 * Format amount for display (assuming stroops/8 decimal places)
 */
export function formatAmount(
  amount: bigint,
  decimals: number = 7,
): string {
  const factor = BigInt(Math.pow(10, decimals));
  const whole = amount / factor;
  const remainder = amount % factor;

  if (remainder === 0n) {
    return whole.toString();
  }

  const remainderStr = remainder.toString().padStart(decimals, '0');
  return `${whole}.${remainderStr.replace(/0+$/, '')}`;
}

/**
 * Parse amount from string (assuming stroops/7 decimal places)
 */
export function parseAmount(
  amountStr: string,
  decimals: number = 7,
): bigint {
  const parts = amountStr.split('.');
  if (parts.length > 2) {
    throw new Error('Invalid amount format');
  }

  const whole = BigInt(parts[0] || '0');
  const factor = BigInt(Math.pow(10, decimals));

  if (parts.length === 1) {
    return whole * factor;
  }

  const decimalStr = parts[1].padEnd(decimals, '0').substring(0, decimals);
  const decimal = BigInt(decimalStr);

  return whole * factor + decimal;
}

/**
 * Create asset identifier string
 */
export function createAssetId(code: string, issuer: string): string {
  if (!isValidStellarAddress(issuer)) {
    throw new Error(`Invalid issuer address: ${issuer}`);
  }

  if (code.length > 12) {
    throw new Error('Asset code must be at most 12 characters');
  }

  return `${code}:${issuer}`;
}

/**
 * Parse asset identifier string
 */
export function parseAssetId(assetId: string): { code: string; issuer: string } {
  const parts = assetId.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid asset ID format');
  }

  const [code, issuer] = parts;

  if (!code || !isValidStellarAddress(issuer)) {
    throw new Error('Invalid asset ID');
  }

  return { code, issuer };
}

/**
 * Parses a string amount strictly into a bigint.
 * Rejects ambiguous, fractional, negative, or non-numeric values.
 */
export function parseBigIntAmount(amount: string): bigint {
  if (typeof amount !== 'string') {
    throw new Error('Amount must be a string.');
  }

  const trimmed = amount.trim();
  if (trimmed === '') {
    throw new Error(`Invalid or ambiguous amount: "${amount}". Amount cannot be empty.`);
  }

  // Check if it's a positive integer (digits only, no decimal point, no signs)
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`Invalid or ambiguous amount: "${amount}". Amounts must be positive integers representing base units (stroops). Fractional or signed amounts are not permitted.`);
  }

  const value = BigInt(trimmed);
  if (value <= 0n) {
    throw new Error(`Invalid or ambiguous amount: "${amount}". Amount must be greater than zero.`);
  }

  return value;
}

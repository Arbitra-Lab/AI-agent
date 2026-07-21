/**
 * Minimal TransactionResult XDR decoding.
 *
 * Horizon transaction records carry the raw base64 `result_xdr` but not a
 * `result_codes` field. Decoding the full structure requires the Stellar
 * SDK; for failure reporting we only need the transaction-level result
 * code, which sits at a fixed offset: TransactionResult = fee (int64)
 * followed by the result discriminant (int32).
 */

const TRANSACTION_RESULT_CODES: Record<number, string> = {
  1: 'tx_fee_bump_inner_success',
  0: 'tx_success',
  [-1]: 'tx_failed',
  [-2]: 'tx_too_early',
  [-3]: 'tx_too_late',
  [-4]: 'tx_missing_operation',
  [-5]: 'tx_bad_seq',
  [-6]: 'tx_bad_auth',
  [-7]: 'tx_insufficient_balance',
  [-8]: 'tx_no_source_account',
  [-9]: 'tx_insufficient_fee',
  [-10]: 'tx_bad_auth_extra',
  [-11]: 'tx_internal_error',
  [-12]: 'tx_not_supported',
  [-13]: 'tx_fee_bump_inner_failed',
  [-14]: 'tx_bad_sponsorship',
  [-15]: 'tx_bad_min_seq_age_or_gap',
  [-16]: 'tx_malformed',
  [-17]: 'tx_soroban_invalid',
};

/**
 * Extracts the transaction-level result code (e.g. 'tx_bad_seq') from a
 * base64 TransactionResult XDR. Returns undefined if the XDR cannot be
 * parsed — callers still have the raw XDR for debugging.
 */
export function decodeTransactionResultCode(resultXdr: string): string | undefined {
  try {
    const bytes = Buffer.from(resultXdr, 'base64');
    if (bytes.length < 12) return undefined;
    const code = bytes.readInt32BE(8);
    return TRANSACTION_RESULT_CODES[code] ?? `tx_unknown_code_${code}`;
  } catch {
    return undefined;
  }
}

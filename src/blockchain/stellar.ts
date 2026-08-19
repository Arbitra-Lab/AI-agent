import {
  FeeBumpTransaction,
  Horizon,
  Keypair,
  Memo,
  Networks,
  Transaction,
  TransactionBuilder,
  xdr,
} from '@stellar/stellar-sdk';
import { BlockchainError } from '../lib/errors';
import { logger } from '../lib/logger';

/**
 * Stellar Horizon client (issue #21).
 *
 * A single, correctly-configured entry point for account lookups, fee
 * estimation, and transaction submission. Safety properties:
 *  - mainnet requires an explicit STELLAR_ALLOW_MAINNET=true opt-in; a
 *    misread env var refuses to boot instead of moving real funds
 *  - the network passphrase is derived from STELLAR_NETWORK via the SDK's
 *    Networks constants, never hardcoded strings
 *  - every transaction built here carries timebounds, and submission
 *    refuses unbounded transactions outright
 *  - the secret key is loaded once, kept private, never logged, and never
 *    returned from any function
 *
 * Env parsing lives in loadStellarConfig until the typed Zod config from
 * issue #5 lands; it is written so the schema can absorb it.
 */

export type StellarNetwork = 'testnet' | 'mainnet';

export interface StellarConfig {
  network: StellarNetwork;
  horizonUrl: string;
  /** Derived from network via SDK Networks constants. */
  networkPassphrase: string;
  /** Upper bound for estimateFee, in stroops per operation. */
  maxFeeStroops: number;
  /** Fallback fee when Horizon fee stats are unavailable, in stroops. */
  baseFeeStroops: number;
  /** Timebounds window applied to every built transaction, in seconds. */
  txTimeoutSeconds: number;
  /** Resubmission attempts for retryable submit failures (504/timeout). */
  submitRetries: number;
}

/** Configuration problems refuse to boot; they must never be caught and ignored. */
export class StellarConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StellarConfigError';
  }
}

const DEFAULT_HORIZON: Record<StellarNetwork, string> = {
  testnet: 'https://horizon-testnet.stellar.org',
  mainnet: 'https://horizon.stellar.org',
};

function parsePositiveInt(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number,
): number {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new StellarConfigError(
      `${key} must be a positive integer, got '${raw}'`,
    );
  }
  return value;
}

export function loadStellarConfig(
  env: NodeJS.ProcessEnv = process.env,
): StellarConfig {
  const rawNetwork = (env.STELLAR_NETWORK ?? 'testnet').toLowerCase();
  if (
    rawNetwork !== 'testnet' &&
    rawNetwork !== 'mainnet' &&
    rawNetwork !== 'public'
  ) {
    throw new StellarConfigError(
      `STELLAR_NETWORK must be 'testnet' or 'mainnet', got '${rawNetwork}'`,
    );
  }
  const network: StellarNetwork =
    rawNetwork === 'public' ? 'mainnet' : rawNetwork;

  if (network === 'mainnet' && env.STELLAR_ALLOW_MAINNET !== 'true') {
    throw new StellarConfigError(
      'STELLAR_NETWORK=mainnet requires the explicit opt-in STELLAR_ALLOW_MAINNET=true. ' +
        'Refusing to boot: a misread environment variable must not move real funds.',
    );
  }

  return {
    network,
    horizonUrl: (env.STELLAR_HORIZON_URL ?? DEFAULT_HORIZON[network]).replace(
      /\/+$/,
      '',
    ),
    networkPassphrase:
      network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET,
    maxFeeStroops: parsePositiveInt(env, 'STELLAR_MAX_FEE_STROOPS', 10_000),
    baseFeeStroops: parsePositiveInt(env, 'STELLAR_BASE_FEE_STROOPS', 100),
    txTimeoutSeconds: parsePositiveInt(env, 'STELLAR_TX_TIMEOUT_SECONDS', 180),
    submitRetries: parsePositiveInt(env, 'STELLAR_SUBMIT_RETRIES', 3),
  };
}

/** Horizon error payload shape (subset we consume). */
interface HorizonErrorData {
  status?: number;
  title?: string;
  detail?: string;
  extras?: {
    result_codes?: { transaction?: string; operations?: string[] };
    result_xdr?: string;
  };
}

export interface HorizonResultCodes {
  transaction?: string;
  operations?: string[];
}

/**
 * Horizon failures mapped into the shared error taxonomy (#7), with
 * result_codes preserved for callers that need to branch on them.
 */
export class StellarHorizonError extends BlockchainError {
  readonly httpStatus?: number;
  readonly resultCodes?: HorizonResultCodes;

  constructor(
    message: string,
    options: {
      retryable?: boolean;
      httpStatus?: number;
      resultCodes?: HorizonResultCodes;
    } = {},
  ) {
    super(message, options.retryable ?? false);
    this.httpStatus = options.httpStatus;
    this.resultCodes = options.resultCodes;
  }
}

const RETRYABLE_HTTP_STATUSES = new Set([429, 503, 504]);

function isNetworkTimeout(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: string }).code;
  return (
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT' ||
    /timeout/i.test(error.message)
  );
}

/** Maps any Horizon/SDK/network error to a StellarHorizonError. */
export function mapHorizonError(error: unknown): StellarHorizonError {
  if (error instanceof StellarHorizonError) return error;

  const response = (
    error as { response?: { status?: number; data?: HorizonErrorData } }
  ).response;
  const data = response?.data;
  const httpStatus = response?.status ?? data?.status;
  const resultCodes = data?.extras?.result_codes;

  const retryable =
    (httpStatus !== undefined && RETRYABLE_HTTP_STATUSES.has(httpStatus)) ||
    isNetworkTimeout(error);

  const parts: string[] = [];
  parts.push(
    data?.title ??
      (error instanceof Error ? error.message : 'Horizon request failed'),
  );
  if (data?.detail) parts.push(data.detail);
  if (resultCodes?.transaction)
    parts.push(`result_codes.transaction=${resultCodes.transaction}`);
  if (resultCodes?.operations?.length) {
    parts.push(
      `result_codes.operations=[${resultCodes.operations.join(', ')}]`,
    );
  }

  return new StellarHorizonError(parts.join(' — '), {
    retryable,
    httpStatus,
    resultCodes,
  });
}

export interface AccountBalance {
  assetType: string;
  /** Undefined for native XLM */
  assetCode?: string;
  /** Undefined for native XLM */
  assetIssuer?: string;
  balance: string;
}

export interface SubmitResult {
  hash: string;
  ledger: number;
  successful: true;
  /**
   * True when a resubmission raced an earlier attempt that had already
   * landed (detected via tx_bad_seq + hash lookup).
   */
  alreadyApplied?: boolean;
}

/** The slice of Horizon.Server this client uses; injectable for unit tests. */
export interface HorizonServerLike {
  loadAccount(accountId: string): Promise<Horizon.AccountResponse>;
  feeStats(): Promise<Horizon.HorizonApi.FeeStatsResponse>;
  submitTransaction(
    tx: Transaction | FeeBumpTransaction,
  ): Promise<Horizon.HorizonApi.SubmitTransactionResponse>;
  transactions(): {
    transaction(hash: string): {
      call(): Promise<Horizon.ServerApi.TransactionRecord>;
    };
  };
}

export interface StellarClientOptions {
  config?: StellarConfig;
  /** Injectable Horizon server for tests. */
  server?: HorizonServerLike;
  /** Overrides STELLAR_SECRET_KEY. Held privately; never logged or returned. */
  secretKey?: string;
  env?: NodeJS.ProcessEnv;
  /** Base delay between submit retries; injectable for tests. */
  retryDelayMs?: number;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export class StellarClient {
  readonly config: StellarConfig;
  private readonly server: HorizonServerLike;
  private readonly keypair: Keypair | null;
  private readonly retryDelayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: StellarClientOptions = {}) {
    const env = options.env ?? process.env;
    this.config = options.config ?? loadStellarConfig(env);
    this.server = options.server ?? new Horizon.Server(this.config.horizonUrl);
    this.retryDelayMs = options.retryDelayMs ?? 1_000;
    this.sleep = options.sleep ?? defaultSleep;

    // Loaded exactly once. The raw value is never stored on this object,
    // never logged, and no method returns it.
    const secret = options.secretKey ?? env.STELLAR_SECRET_KEY;
    if (secret !== undefined && secret !== '') {
      try {
        this.keypair = Keypair.fromSecret(secret);
      } catch {
        // Deliberately does not echo the value.
        throw new StellarConfigError(
          'STELLAR_SECRET_KEY is not a valid Stellar secret key',
        );
      }
    } else {
      this.keypair = null;
    }
  }

  /** Public key of the configured signing account, if one is configured. */
  get publicKey(): string | null {
    return this.keypair?.publicKey() ?? null;
  }

  get hasSigningKey(): boolean {
    return this.keypair !== null;
  }

  /** Signs in place with the configured key. The key itself is never exposed. */
  signTransaction(tx: Transaction | FeeBumpTransaction): void {
    if (!this.keypair) {
      throw new StellarConfigError(
        'No signing key configured: set STELLAR_SECRET_KEY to sign transactions',
      );
    }
    tx.sign(this.keypair);
  }

  async loadAccount(accountId: string): Promise<Horizon.AccountResponse> {
    try {
      return await this.server.loadAccount(accountId);
    } catch (error) {
      throw mapHorizonError(error);
    }
  }

  async getBalances(accountId: string): Promise<AccountBalance[]> {
    const account = await this.loadAccount(accountId);
    return account.balances.map((b) => ({
      assetType: b.asset_type,
      assetCode: 'asset_code' in b ? b.asset_code : undefined,
      assetIssuer: 'asset_issuer' in b ? b.asset_issuer : undefined,
      balance: b.balance,
    }));
  }

  /**
   * Fee per operation in stroops, from recent ledger fee stats (p50 of
   * fees charged, floored at the current base fee), capped at
   * maxFeeStroops. Falls back to baseFeeStroops when Horizon is
   * unreachable — the cap still applies.
   */
  async estimateFee(): Promise<number> {
    try {
      const stats = await this.server.feeStats();
      const baseFee =
        Number(stats.last_ledger_base_fee) || this.config.baseFeeStroops;
      const p50 = Number(stats.fee_charged?.p50) || baseFee;
      return Math.min(Math.max(baseFee, p50), this.config.maxFeeStroops);
    } catch (error) {
      logger.warn(
        `[stellar] fee stats unavailable (${error instanceof Error ? error.message : String(error)}); ` +
          `falling back to base fee ${this.config.baseFeeStroops}`,
      );
      return Math.min(this.config.baseFeeStroops, this.config.maxFeeStroops);
    }
  }

  /**
   * Builds a transaction bound to this client's network, with a dynamic
   * fee (unless given) and timebounds ALWAYS set from txTimeoutSeconds.
   */
  async buildTransaction(
    sourceAccountId: string,
    operations: xdr.Operation[],
    options: { feeStroops?: number; memo?: Memo } = {},
  ): Promise<Transaction> {
    const account = await this.loadAccount(sourceAccountId);
    const fee = options.feeStroops ?? (await this.estimateFee());

    const builder = new TransactionBuilder(account, {
      fee: String(fee),
      networkPassphrase: this.config.networkPassphrase,
    });
    for (const op of operations) {
      builder.addOperation(op);
    }
    if (options.memo) {
      builder.addMemo(options.memo);
    }
    // Never submit unbounded: every transaction gets an expiry.
    builder.setTimeout(this.config.txTimeoutSeconds);
    return builder.build();
  }

  /**
   * Submits a signed transaction. Refuses unbounded transactions.
   *
   * Retry semantics: a 504/timeout from Horizon means "not confirmed", not
   * "failed" — the same signed envelope is resubmitted (idempotent: same
   * hash, same sequence number). If a resubmission comes back tx_bad_seq,
   * the sequence number was consumed; we look the hash up on Horizon to
   * distinguish "our earlier attempt actually landed" (success) from a
   * genuine sequence error (failure with result_codes preserved).
   */
  async submitTransaction(
    tx: Transaction | FeeBumpTransaction,
  ): Promise<SubmitResult> {
    assertHasTimebounds(tx);
    const hash = tx.hash().toString('hex');

    for (let attempt = 0; ; attempt++) {
      try {
        const response = await this.server.submitTransaction(tx);
        return {
          hash: response.hash,
          ledger: response.ledger,
          successful: true,
        };
      } catch (error) {
        const mapped = mapHorizonError(error);

        if (mapped.resultCodes?.transaction === 'tx_bad_seq') {
          const existing = await this.findTransaction(hash);
          if (existing?.successful) {
            logger.info(
              `[stellar] tx ${hash} reported tx_bad_seq but an earlier attempt already ` +
                `landed in ledger ${existing.ledger}; treating as success`,
            );
            return {
              hash,
              ledger: existing.ledger,
              successful: true,
              alreadyApplied: true,
            };
          }
          throw mapped;
        }

        if (!mapped.isRetryable || attempt >= this.config.submitRetries) {
          throw mapped;
        }

        const delay = this.retryDelayMs * (attempt + 1);
        logger.warn(
          `[stellar] submit attempt ${attempt + 1} for tx ${hash} failed ` +
            `(${mapped.httpStatus ?? 'network timeout'}); resubmitting in ${delay}ms`,
        );
        await this.sleep(delay);
      }
    }
  }

  /** Looks up a transaction by hash; null when Horizon has no record. */
  async findTransaction(
    hash: string,
  ): Promise<{ successful: boolean; ledger: number } | null> {
    try {
      const record = await this.server.transactions().transaction(hash).call();
      return { successful: record.successful, ledger: record.ledger_attr };
    } catch (error) {
      const mapped = mapHorizonError(error);
      if (mapped.httpStatus === 404) return null;
      throw mapped;
    }
  }
}

/**
 * Rejects transactions without an upper timebound. For fee-bump
 * transactions the timebounds live on the inner transaction.
 */
export function assertHasTimebounds(
  tx: Transaction | FeeBumpTransaction,
): void {
  const inner = tx instanceof FeeBumpTransaction ? tx.innerTransaction : tx;
  const maxTime = inner.timeBounds?.maxTime;
  if (!maxTime || maxTime === '0') {
    throw new StellarHorizonError(
      'Refusing to submit an unbounded transaction: timebounds with a max time are required ' +
        '(build via StellarClient.buildTransaction or call setTimeout on the builder)',
      { retryable: false },
    );
  }
}

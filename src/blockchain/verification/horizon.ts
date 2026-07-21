import { TransactionResultCodes } from './types';

/**
 * Minimal Horizon REST reader.
 *
 * Deliberately does not depend on @stellar/stellar-sdk: verification only
 * needs two read endpoints, and keeping the surface small makes it trivial
 * to fake in tests. Uses the global fetch available in Node 18+.
 */

/** Shape of a Horizon transaction record (fields we consume). */
export interface HorizonTransactionRecord {
  hash: string;
  successful: boolean;
  ledger: number;
  created_at: string;
  paging_token: string;
  result_xdr?: string;
  /** Present on some responses (e.g. submission error extras) */
  result_codes?: TransactionResultCodes;
}

export interface HorizonLedgerSummary {
  sequence: number;
  closedAt: string;
}

export interface HorizonReader {
  /** Returns the transaction record, or null if Horizon has not seen it yet. */
  getTransaction(hash: string): Promise<HorizonTransactionRecord | null>;
  /** Returns the most recently closed ledger. */
  getLatestLedger(): Promise<HorizonLedgerSummary>;
}

export class HorizonRequestError extends Error {
  constructor(
    readonly url: string,
    readonly httpStatus: number,
  ) {
    super(`Horizon request failed with HTTP ${httpStatus}: ${url}`);
    this.name = 'HorizonRequestError';
  }
}

/** Injectable fetch, so tests never touch the network. */
export type FetchLike = (url: string) => Promise<{
  status: number;
  ok: boolean;
  json(): Promise<unknown>;
}>;

function globalFetch(): FetchLike {
  const f = (globalThis as { fetch?: FetchLike }).fetch;
  if (!f) {
    throw new Error('global fetch is not available; Node 18+ is required');
  }
  return f.bind(globalThis);
}

export class HttpHorizonReader implements HorizonReader {
  private readonly baseUrl: string;
  private readonly fetchFn: FetchLike;

  constructor(baseUrl: string, fetchFn?: FetchLike) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.fetchFn = fetchFn ?? globalFetch();
  }

  async getTransaction(hash: string): Promise<HorizonTransactionRecord | null> {
    const url = `${this.baseUrl}/transactions/${encodeURIComponent(hash)}`;
    const res = await this.fetchFn(url);
    if (res.status === 404) {
      // Horizon has not ingested the transaction (yet) — still pending.
      return null;
    }
    if (!res.ok) {
      throw new HorizonRequestError(url, res.status);
    }
    return (await res.json()) as HorizonTransactionRecord;
  }

  async getLatestLedger(): Promise<HorizonLedgerSummary> {
    const url = `${this.baseUrl}/ledgers?order=desc&limit=1`;
    const res = await this.fetchFn(url);
    if (!res.ok) {
      throw new HorizonRequestError(url, res.status);
    }
    const body = (await res.json()) as {
      _embedded?: { records?: Array<{ sequence: number; closed_at: string }> };
    };
    const record = body._embedded?.records?.[0];
    if (!record) {
      throw new Error(`Horizon returned no ledger records: ${url}`);
    }
    return { sequence: record.sequence, closedAt: record.closed_at };
  }
}

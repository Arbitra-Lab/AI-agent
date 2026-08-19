/**
 * Unit tests for the Stellar Horizon client (issue #21).
 * All Horizon interaction is mocked; no network access.
 */

import {
  Account,
  Asset,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import {
  StellarClient,
  StellarConfig,
  StellarConfigError,
  StellarHorizonError,
  HorizonServerLike,
  loadStellarConfig,
  mapHorizonError,
  assertHasTimebounds,
} from '../stellar';

const TESTNET_CONFIG: StellarConfig = {
  network: 'testnet',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  networkPassphrase: Networks.TESTNET,
  maxFeeStroops: 10_000,
  baseFeeStroops: 100,
  txTimeoutSeconds: 180,
  submitRetries: 3,
};

/** Builds a Horizon-style error as thrown by the SDK's HTTP layer. */
function horizonHttpError(
  status: number,
  extras?: { result_codes?: { transaction?: string; operations?: string[] } },
): Error {
  const error = new Error(`Request failed with status code ${status}`);
  (error as unknown as { response: unknown }).response = {
    status,
    data: { status, title: `HTTP ${status}`, extras },
  };
  return error;
}

function fakeServer(
  overrides: Partial<HorizonServerLike> = {},
): HorizonServerLike {
  return {
    loadAccount: jest
      .fn()
      .mockRejectedValue(new Error('loadAccount not stubbed')),
    feeStats: jest.fn().mockRejectedValue(new Error('feeStats not stubbed')),
    submitTransaction: jest
      .fn()
      .mockRejectedValue(new Error('submitTransaction not stubbed')),
    transactions: jest.fn(() => ({
      transaction: jest.fn(() => ({
        call: jest.fn().mockRejectedValue(horizonHttpError(404)),
      })),
    })),
    ...overrides,
  };
}

function client(
  server: HorizonServerLike,
  options: { secretKey?: string } = {},
): StellarClient {
  return new StellarClient({
    config: TESTNET_CONFIG,
    server,
    sleep: () => Promise.resolve(undefined), // no real waiting in tests
    ...options,
  });
}

const SIGNER = Keypair.random();

/** A signed, timebounded payment-to-self built entirely offline. */
function signedTransaction(timeoutSeconds = 300) {
  const builder = new TransactionBuilder(new Account(SIGNER.publicKey(), '0'), {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  }).addOperation(
    Operation.payment({
      destination: SIGNER.publicKey(),
      asset: Asset.native(),
      amount: '1',
    }),
  );
  builder.setTimeout(timeoutSeconds);
  const tx = builder.build();
  tx.sign(SIGNER);
  return tx;
}

describe('loadStellarConfig', () => {
  it('defaults to testnet with the testnet Horizon URL and derived passphrase', () => {
    const config = loadStellarConfig({});
    expect(config.network).toBe('testnet');
    expect(config.horizonUrl).toBe('https://horizon-testnet.stellar.org');
    expect(config.networkPassphrase).toBe(Networks.TESTNET);
  });

  it('respects STELLAR_HORIZON_URL and trims trailing slashes', () => {
    const config = loadStellarConfig({
      STELLAR_HORIZON_URL: 'https://my-horizon.example/',
    });
    expect(config.horizonUrl).toBe('https://my-horizon.example');
  });

  it('refuses to boot on mainnet without the explicit STELLAR_ALLOW_MAINNET opt-in', () => {
    expect(() => loadStellarConfig({ STELLAR_NETWORK: 'mainnet' })).toThrow(
      StellarConfigError,
    );
    // Truthy-looking values are not enough — only the literal 'true'.
    expect(() =>
      loadStellarConfig({
        STELLAR_NETWORK: 'mainnet',
        STELLAR_ALLOW_MAINNET: '1',
      }),
    ).toThrow(StellarConfigError);
    expect(() =>
      loadStellarConfig({
        STELLAR_NETWORK: 'mainnet',
        STELLAR_ALLOW_MAINNET: 'TRUE',
      }),
    ).toThrow(StellarConfigError);
  });

  it('allows mainnet with STELLAR_ALLOW_MAINNET=true and derives the public passphrase', () => {
    const config = loadStellarConfig({
      STELLAR_NETWORK: 'mainnet',
      STELLAR_ALLOW_MAINNET: 'true',
    });
    expect(config.network).toBe('mainnet');
    expect(config.networkPassphrase).toBe(Networks.PUBLIC);
    expect(config.horizonUrl).toBe('https://horizon.stellar.org');
  });

  it("treats 'public' as mainnet, including the opt-in gate", () => {
    expect(() => loadStellarConfig({ STELLAR_NETWORK: 'public' })).toThrow(
      StellarConfigError,
    );
  });

  it('rejects unknown networks', () => {
    expect(() => loadStellarConfig({ STELLAR_NETWORK: 'futurenet' })).toThrow(
      StellarConfigError,
    );
  });

  it('rejects malformed numeric overrides', () => {
    expect(() =>
      loadStellarConfig({ STELLAR_MAX_FEE_STROOPS: 'lots' }),
    ).toThrow(StellarConfigError);
    expect(() =>
      loadStellarConfig({ STELLAR_TX_TIMEOUT_SECONDS: '-5' }),
    ).toThrow(StellarConfigError);
  });
});

describe('secret key handling', () => {
  it('exposes the public key but never the secret', () => {
    const c = client(fakeServer(), { secretKey: SIGNER.secret() });
    expect(c.publicKey).toBe(SIGNER.publicKey());
    expect(c.hasSigningKey).toBe(true);
    // Nothing reachable from the client serializes the secret.
    expect(JSON.stringify(c)).not.toContain(SIGNER.secret());
    expect(JSON.stringify(c.config)).not.toContain(SIGNER.secret());
  });

  it('rejects an invalid secret without echoing its value', () => {
    const bogus = 'SNOTAREALSECRETKEYVALUE';
    try {
      client(fakeServer(), { secretKey: bogus });
      fail('expected StellarConfigError');
    } catch (error) {
      expect(error).toBeInstanceOf(StellarConfigError);
      expect((error as Error).message).not.toContain(bogus);
    }
  });

  it('signs transactions without a key round-trip', () => {
    const c = client(fakeServer(), { secretKey: SIGNER.secret() });
    const tx = signedTransaction();
    const before = tx.signatures.length;
    c.signTransaction(tx);
    expect(tx.signatures.length).toBe(before + 1);
  });

  it('refuses to sign when no key is configured', () => {
    const c = client(fakeServer());
    expect(c.hasSigningKey).toBe(false);
    expect(() => c.signTransaction(signedTransaction())).toThrow(
      StellarConfigError,
    );
  });
});

describe('estimateFee', () => {
  function feeStatsResponse(p50: string, baseFee = '100') {
    return {
      last_ledger_base_fee: baseFee,
      fee_charged: { p50 },
    } as unknown as Horizon.HorizonApi.FeeStatsResponse;
  }

  it('uses the p50 of recently charged fees', async () => {
    const server = fakeServer({
      feeStats: jest.fn().mockResolvedValue(feeStatsResponse('350')),
    });
    expect(await client(server).estimateFee()).toBe(350);
  });

  it('never goes below the current base fee', async () => {
    const server = fakeServer({
      feeStats: jest.fn().mockResolvedValue(feeStatsResponse('50', '200')),
    });
    expect(await client(server).estimateFee()).toBe(200);
  });

  it('caps the estimate at maxFeeStroops during fee spikes', async () => {
    const server = fakeServer({
      feeStats: jest.fn().mockResolvedValue(feeStatsResponse('2500000')),
    });
    expect(await client(server).estimateFee()).toBe(
      TESTNET_CONFIG.maxFeeStroops,
    );
  });

  it('falls back to the configured base fee when fee stats are unavailable', async () => {
    const server = fakeServer({
      feeStats: jest.fn().mockRejectedValue(new Error('connect ETIMEDOUT')),
    });
    expect(await client(server).estimateFee()).toBe(
      TESTNET_CONFIG.baseFeeStroops,
    );
  });
});

describe('accounts and balances', () => {
  it('maps Horizon balances to typed entries', async () => {
    const account = {
      balances: [
        { asset_type: 'native', balance: '100.5000000' },
        {
          asset_type: 'credit_alphanum4',
          asset_code: 'USDC',
          asset_issuer: 'GISSUER',
          balance: '42.0000000',
        },
      ],
    } as unknown as Horizon.AccountResponse;
    const server = fakeServer({
      loadAccount: jest.fn().mockResolvedValue(account),
    });

    const balances = await client(server).getBalances('GACCOUNT');

    expect(balances).toEqual([
      {
        assetType: 'native',
        assetCode: undefined,
        assetIssuer: undefined,
        balance: '100.5000000',
      },
      {
        assetType: 'credit_alphanum4',
        assetCode: 'USDC',
        assetIssuer: 'GISSUER',
        balance: '42.0000000',
      },
    ]);
  });

  it('maps loadAccount failures to StellarHorizonError', async () => {
    const server = fakeServer({
      loadAccount: jest.fn().mockRejectedValue(horizonHttpError(404)),
    });
    await expect(client(server).loadAccount('GMISSING')).rejects.toBeInstanceOf(
      StellarHorizonError,
    );
  });
});

describe('buildTransaction', () => {
  it('sets timebounds and a dynamically estimated fee', async () => {
    const account = new Account(SIGNER.publicKey(), '7');
    const server = fakeServer({
      loadAccount: jest.fn().mockResolvedValue(account),
      feeStats: jest.fn().mockResolvedValue({
        last_ledger_base_fee: '100',
        fee_charged: { p50: '250' },
      }),
    });
    const tx = await client(server).buildTransaction(SIGNER.publicKey(), [
      Operation.payment({
        destination: SIGNER.publicKey(),
        asset: Asset.native(),
        amount: '1',
      }),
    ]);

    expect(tx.fee).toBe('250');
    expect(tx.timeBounds?.maxTime).toBeDefined();
    expect(Number(tx.timeBounds!.maxTime)).toBeGreaterThan(Date.now() / 1000);
    expect(tx.networkPassphrase).toBe(Networks.TESTNET);
  });
});

describe('submitTransaction', () => {
  it('refuses unbounded transactions outright', async () => {
    const unbounded = new TransactionBuilder(
      new Account(SIGNER.publicKey(), '0'),
      {
        fee: '100',
        networkPassphrase: Networks.TESTNET,
      },
    )
      .addOperation(Operation.bumpSequence({ bumpTo: '1' }))
      .setTimeout(0) // TimeoutInfinite — no upper timebound
      .build();

    const server = fakeServer();
    await expect(client(server).submitTransaction(unbounded)).rejects.toThrow(
      /unbounded/i,
    );
    expect((server.submitTransaction as jest.Mock).mock.calls.length).toBe(0);
  });

  it('returns hash and ledger on success', async () => {
    const tx = signedTransaction();
    const server = fakeServer({
      submitTransaction: jest.fn().mockResolvedValue({
        hash: tx.hash().toString('hex'),
        ledger: 4242,
        successful: true,
      }),
    });

    const result = await client(server).submitTransaction(tx);

    expect(result).toEqual({
      hash: tx.hash().toString('hex'),
      ledger: 4242,
      successful: true,
    });
  });

  it('resubmits on 504 and succeeds on a later attempt', async () => {
    const tx = signedTransaction();
    const submit = jest
      .fn()
      .mockRejectedValueOnce(horizonHttpError(504))
      .mockRejectedValueOnce(horizonHttpError(504))
      .mockResolvedValue({
        hash: tx.hash().toString('hex'),
        ledger: 9,
        successful: true,
      });
    const server = fakeServer({ submitTransaction: submit });

    const result = await client(server).submitTransaction(tx);

    expect(result.successful).toBe(true);
    expect(submit).toHaveBeenCalledTimes(3);
  });

  it('gives up after submitRetries and surfaces a retryable error', async () => {
    const tx = signedTransaction();
    const submit = jest.fn().mockRejectedValue(horizonHttpError(504));
    const server = fakeServer({ submitTransaction: submit });

    try {
      await client(server).submitTransaction(tx);
      fail('expected StellarHorizonError');
    } catch (error) {
      expect(error).toBeInstanceOf(StellarHorizonError);
      expect((error as StellarHorizonError).isRetryable).toBe(true);
      expect((error as StellarHorizonError).httpStatus).toBe(504);
    }
    // initial attempt + submitRetries resubmissions
    expect(submit).toHaveBeenCalledTimes(TESTNET_CONFIG.submitRetries + 1);
  });

  it('does not retry non-retryable failures', async () => {
    const tx = signedTransaction();
    const submit = jest.fn().mockRejectedValue(
      horizonHttpError(400, {
        result_codes: { transaction: 'tx_insufficient_fee' },
      }),
    );
    const server = fakeServer({ submitTransaction: submit });

    await expect(client(server).submitTransaction(tx)).rejects.toMatchObject({
      resultCodes: { transaction: 'tx_insufficient_fee' },
    });
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('treats tx_bad_seq as success when the earlier attempt actually landed', async () => {
    const tx = signedTransaction();
    const hash = tx.hash().toString('hex');
    const submit = jest
      .fn()
      .mockRejectedValueOnce(horizonHttpError(504))
      .mockRejectedValue(
        horizonHttpError(400, { result_codes: { transaction: 'tx_bad_seq' } }),
      );
    const transactionCall = jest.fn().mockResolvedValue({
      successful: true,
      ledger_attr: 777,
    });
    const server = fakeServer({
      submitTransaction: submit,
      transactions: jest.fn(() => ({
        transaction: jest.fn((h: string) => {
          expect(h).toBe(hash);
          return { call: transactionCall };
        }),
      })),
    });

    const result = await client(server).submitTransaction(tx);

    expect(result).toEqual({
      hash,
      ledger: 777,
      successful: true,
      alreadyApplied: true,
    });
  });

  it('surfaces genuine tx_bad_seq with result_codes preserved', async () => {
    const tx = signedTransaction();
    const submit = jest
      .fn()
      .mockRejectedValue(
        horizonHttpError(400, { result_codes: { transaction: 'tx_bad_seq' } }),
      );
    const server = fakeServer({ submitTransaction: submit }); // hash lookup 404s

    try {
      await client(server).submitTransaction(tx);
      fail('expected StellarHorizonError');
    } catch (error) {
      expect(error).toBeInstanceOf(StellarHorizonError);
      expect((error as StellarHorizonError).resultCodes).toEqual({
        transaction: 'tx_bad_seq',
      });
      expect((error as StellarHorizonError).isRetryable).toBe(false);
    }
    expect(submit).toHaveBeenCalledTimes(1);
  });
});

describe('mapHorizonError', () => {
  it('preserves result_codes including operation codes', () => {
    const mapped = mapHorizonError(
      horizonHttpError(400, {
        result_codes: {
          transaction: 'tx_failed',
          operations: ['op_underfunded', 'op_success'],
        },
      }),
    );
    expect(mapped).toBeInstanceOf(StellarHorizonError);
    expect(mapped.resultCodes).toEqual({
      transaction: 'tx_failed',
      operations: ['op_underfunded', 'op_success'],
    });
    expect(mapped.message).toContain('tx_failed');
    expect(mapped.message).toContain('op_underfunded');
    expect(mapped.code).toBe('BLOCKCHAIN_ERROR');
  });

  it('marks 429/503/504 and network timeouts as retryable', () => {
    expect(mapHorizonError(horizonHttpError(429)).isRetryable).toBe(true);
    expect(mapHorizonError(horizonHttpError(503)).isRetryable).toBe(true);
    expect(mapHorizonError(horizonHttpError(504)).isRetryable).toBe(true);
    const timeout = Object.assign(new Error('timeout of 60000ms exceeded'), {
      code: 'ECONNABORTED',
    });
    expect(mapHorizonError(timeout).isRetryable).toBe(true);
    expect(mapHorizonError(horizonHttpError(400)).isRetryable).toBe(false);
  });
});

describe('assertHasTimebounds', () => {
  it('accepts a transaction with timebounds', () => {
    expect(() => assertHasTimebounds(signedTransaction())).not.toThrow();
  });
});

/**
 * Integration tests for the Stellar Horizon client against the live
 * testnet (issue #21).
 *
 * CI-gated: skipped unless STELLAR_INTEGRATION_TESTS=true, because they
 * depend on friendbot funding and testnet availability. Run locally with:
 *
 *   STELLAR_INTEGRATION_TESTS=true npx jest stellar.integration
 */

import { Asset, Keypair, Operation } from '@stellar/stellar-sdk';
import { StellarClient, loadStellarConfig } from '../stellar';

const RUN_INTEGRATION = process.env.STELLAR_INTEGRATION_TESTS === 'true';
const describeIntegration = RUN_INTEGRATION ? describe : describe.skip;

jest.setTimeout(120_000);

describeIntegration('StellarClient against Horizon testnet', () => {
  const keypair = Keypair.random();
  let client: StellarClient;

  beforeAll(async () => {
    client = new StellarClient({
      config: loadStellarConfig({ STELLAR_NETWORK: 'testnet' }),
      secretKey: keypair.secret(),
    });

    const friendbot = await fetch(
      `https://friendbot.stellar.org?addr=${encodeURIComponent(keypair.publicKey())}`,
    );
    if (!friendbot.ok) {
      throw new Error(`friendbot funding failed: HTTP ${friendbot.status}`);
    }
  });

  it('loads the funded account and reads a native balance', async () => {
    const balances = await client.getBalances(keypair.publicKey());
    const native = balances.find((b) => b.assetType === 'native');
    expect(native).toBeDefined();
    expect(Number(native!.balance)).toBeGreaterThan(0);
  });

  it('estimates a fee within the configured cap', async () => {
    const fee = await client.estimateFee();
    expect(fee).toBeGreaterThanOrEqual(100);
    expect(fee).toBeLessThanOrEqual(client.config.maxFeeStroops);
  });

  it('builds, signs, and submits a timebounded payment', async () => {
    const tx = await client.buildTransaction(keypair.publicKey(), [
      Operation.payment({
        destination: keypair.publicKey(),
        asset: Asset.native(),
        amount: '1',
      }),
    ]);

    expect(tx.timeBounds?.maxTime).toBeDefined();
    expect(tx.timeBounds!.maxTime).not.toBe('0');

    client.signTransaction(tx);
    const result = await client.submitTransaction(tx);

    expect(result.successful).toBe(true);
    expect(result.ledger).toBeGreaterThan(0);

    // The submitted hash is verifiable on-chain (ties into issue #24).
    const found = await client.findTransaction(result.hash);
    expect(found?.successful).toBe(true);
  });
});

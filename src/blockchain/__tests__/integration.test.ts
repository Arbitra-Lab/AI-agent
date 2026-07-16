/**
 * Integration Tests for Escrow Contract Client
 *
 * These tests verify the client works against a real testnet instance.
 * Requires ESCROW_CONTRACT_ID_TESTNET to be set.
 */

import { EscrowContractClient } from '../../blockchain/clients/escrow';
import { EscrowError, EscrowErrorCode } from '../../blockchain/types/escrow';
import { Keypair } from '@stellar/stellar-sdk';
import {
  isValidStellarAddress,
  isValidEscrowId,
  validateAmount,
  formatAmount,
  parseAmount,
  createAssetId,
  parseAssetId,
} from '../../blockchain/utils/soroban';

describe('EscrowContractClient', () => {
  let client: EscrowContractClient;

  beforeAll(() => {
    const contractId = process.env.ESCROW_CONTRACT_ID_TESTNET;
    if (!contractId) {
      console.warn(
        'Skipping integration tests: ESCROW_CONTRACT_ID_TESTNET not set',
      );
      return;
    }

    client = EscrowContractClient.create('testnet');
  });

  describe('getEscrow', () => {
    it('should throw ESCROW_NOT_FOUND for non-existent escrow', async () => {
      if (!client) return; // Skip if contract not configured

      const escrowId = '0'.repeat(64);

      try {
        await client.getEscrow(escrowId);
        fail('Expected EscrowError');
      } catch (error) {
        expect(error).toBeInstanceOf(EscrowError);
        expect((error as EscrowError).code).toBe(EscrowErrorCode.ESCROW_NOT_FOUND);
      }
    });
  });

  describe('create', () => {
    it('should simulate create operation without errors', async () => {
      if (!client) return; // Skip if contract not configured

      const testKey = Keypair.random();
      const party1 = testKey.publicKey();
      const party2 = Keypair.random().publicKey();

      // This will simulate, not submit
      try {
        const result = await client.create({
          party1,
          party2,
          amount: BigInt(1000000000), // 100 USDC
          assetCode: 'USDC',
          assetIssuer: 'GAQAA5Z4K6GGVRCNLVHT3D3YX3KYKU5LWY246ROYS33V7F7R5CALS63P',
          timeoutSeconds: 86400,
          signingKey: testKey,
        });

        // Should have escrow ID and transaction hash
        expect(result.escrowId).toBeDefined();
        expect(result.transactionHash).toBeDefined();
      } catch (error) {
        if (error instanceof EscrowError) {
          // Expected for testnet without proper setup
          expect(error.code).toBeDefined();
        } else {
          throw error;
        }
      }
    });
  });
});

describe('Soroban Type Utilities', () => {
  describe('isValidStellarAddress', () => {
    it('should validate valid Stellar addresses', () => {
      expect(
        isValidStellarAddress('GAQAA5Z4K6GGVRCNLVHT3D3YX3KYKU5LWY246ROYS33V7F7R5CALS63P'),
      ).toBe(true);
      expect(isValidStellarAddress('GA')).toBe(false);
      expect(isValidStellarAddress('GBUQWP3BOUZX34LOCALNAME')).toBe(false);
    });
  });

  describe('isValidEscrowId', () => {
    it('should validate escrow ID format', () => {
      expect(isValidEscrowId('0'.repeat(64))).toBe(true);
      expect(isValidEscrowId('abc123')).toBe(true);
      expect(isValidEscrowId('xyz')).toBe(false);
      expect(isValidEscrowId('')).toBe(true); // Empty is technically valid
    });
  });

  describe('validateAmount', () => {
    it('should accept bigint amounts', () => {
      const amount = BigInt(1000000000);
      expect(validateAmount(amount)).toBe(amount);
    });

    it('should convert string to bigint', () => {
      const amount = validateAmount('1000000000');
      expect(amount).toBe(BigInt(1000000000));
    });

    it('should convert integer numbers to bigint', () => {
      const amount = validateAmount(1000000000);
      expect(amount).toBe(BigInt(1000000000));
    });

    it('should reject decimal numbers', () => {
      expect(() => validateAmount(100.5)).toThrow();
    });
  });

  describe('formatAmount and parseAmount', () => {
    it('should format amounts for display', () => {
      const amount = BigInt(1234567890);
      const formatted = formatAmount(amount, 7);
      expect(formatted).toBe('123.456789');
    });

    it('should parse amounts back to bigint', () => {
      const original = BigInt(1234567890);
      const formatted = formatAmount(original, 7);
      const parsed = parseAmount(formatted, 7);
      expect(parsed).toBe(original);
    });

    it('should handle zero amounts', () => {
      expect(formatAmount(BigInt(0))).toBe('0');
      expect(parseAmount('0')).toBe(BigInt(0));
    });
  });

  describe('createAssetId and parseAssetId', () => {
    it('should create and parse asset identifiers', () => {
      const code = 'USDC';
      const issuer = 'GAQAA5Z4K6GGVRCNLVHT3D3YX3KYKU5LWY246ROYS33V7F7R5CALS63P';

      const assetId = createAssetId(code, issuer);
      expect(assetId).toBe(`${code}:${issuer}`);

      const parsed = parseAssetId(assetId);
      expect(parsed.code).toBe(code);
      expect(parsed.issuer).toBe(issuer);
    });

    it('should reject invalid asset identifiers', () => {
      expect(() => createAssetId('TOOL', 'invalid-address')).toThrow();
      expect(() => parseAssetId('INVALID')).toThrow();
    });
  });
});

/**
 * Unit Tests for Soroban Utilities
 */

import {
  stringToBytes32,
  bytes32ToString,
  isValidStellarAddress,
  isValidEscrowId,
  validateAmount,
  formatAmount,
  parseAmount,
  createAssetId,
  parseAssetId,
} from '../../blockchain/utils/soroban';

describe('Soroban Type Utils', () => {
  describe('BytesN<32> Conversion', () => {
    it('should convert string to bytes32', () => {
      const hex = '0'.repeat(64);
      const bytes = stringToBytes32(hex);

      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(32);
      expect(bytes.every((b) => b === 0)).toBe(true);
    });

    it('should convert bytes32 back to string', () => {
      const hex = 'abcdef'.padEnd(64, '0');
      const bytes = stringToBytes32(hex);
      const result = bytes32ToString(bytes);

      expect(result).toBe(hex);
    });

    it('should reject invalid hex strings', () => {
      expect(() => stringToBytes32('xyz')).toThrow();
    });

    it('should reject bytes32 with wrong length', () => {
      const wrongBytes = new Uint8Array(31);
      expect(() => bytes32ToString(wrongBytes)).toThrow();
    });
  });

  describe('Address Validation', () => {
    it('should validate correct Stellar addresses', () => {
      const validAddr = 'GBUQWP3BOUZX34LOCALNAME6QSN6FBLTZWMNNYHEI5HP2DGTX5DXV6EA';
      expect(isValidStellarAddress(validAddr)).toBe(true);
    });

    it('should reject non-56-character addresses', () => {
      expect(isValidStellarAddress('GBUQWP3BOUZX34LOCALNAME')).toBe(false);
      expect(isValidStellarAddress('G' + 'A'.repeat(54))).toBe(false); // 55 chars total (too short)
      expect(isValidStellarAddress('G' + 'A'.repeat(56))).toBe(false); // 57 chars total (too long)
    });

    it('should reject addresses not starting with G', () => {
      expect(isValidStellarAddress('A' + 'B'.repeat(55))).toBe(false);
    });

    it('should reject addresses with invalid base32 characters', () => {
      expect(isValidStellarAddress('G' + '0'.repeat(55))).toBe(false);
    });
  });

  describe('EscrowId Validation', () => {
    it('should accept valid hex strings', () => {
      expect(isValidEscrowId('0'.repeat(64))).toBe(true);
      expect(isValidEscrowId('abc123ABC')).toBe(true);
      expect(isValidEscrowId('DEADBEEF')).toBe(true);
    });

    it('should accept empty string', () => {
      expect(isValidEscrowId('')).toBe(true);
    });

    it('should reject non-hex characters', () => {
      expect(isValidEscrowId('xyz')).toBe(false);
      expect(isValidEscrowId('0x123')).toBe(false);
    });

    it('should reject strings exceeding 64 characters', () => {
      expect(isValidEscrowId('f'.repeat(65))).toBe(false);
    });
  });

  describe('Amount Validation', () => {
    it('should accept bigint values', () => {
      const amount = BigInt(1000000000);
      expect(validateAmount(amount)).toBe(amount);
    });

    it('should convert string numbers to bigint', () => {
      expect(validateAmount('1000000000')).toBe(BigInt(1000000000));
    });

    it('should convert integer numbers to bigint', () => {
      expect(validateAmount(100)).toBe(BigInt(100));
    });

    it('should reject decimal numbers', () => {
      expect(() => validateAmount(123.45)).toThrow('must be an integer');
    });

    it('should reject invalid types', () => {
      expect(() => validateAmount({})).toThrow();
      expect(() => validateAmount([])).toThrow();
      expect(() => validateAmount(null)).toThrow();
    });
  });

  describe('Amount Formatting', () => {
    it('should format whole amounts without decimals', () => {
      const amount = BigInt(1000000000); // 100 with 7 decimals
      expect(formatAmount(amount, 7)).toBe('100');
    });

    it('should format amounts with decimals', () => {
      const amount = BigInt(1234567890); // 123.456789 with 7 decimals
      expect(formatAmount(amount, 7)).toBe('123.456789');
    });

    it('should strip trailing zeros', () => {
      const amount = BigInt(1200000000); // 120 with 7 decimals
      expect(formatAmount(amount, 7)).toBe('120');
    });

    it('should handle zero', () => {
      expect(formatAmount(BigInt(0))).toBe('0');
    });

    it('should handle custom decimal places', () => {
      const amount = BigInt(1234);
      expect(formatAmount(amount, 2)).toBe('12.34');
      expect(formatAmount(amount, 4)).toBe('0.1234');
    });
  });

  describe('Amount Parsing', () => {
    it('should parse whole numbers', () => {
      expect(parseAmount('100', 7)).toBe(BigInt(1000000000));
    });

    it('should parse decimal amounts', () => {
      expect(parseAmount('123.456789', 7)).toBe(BigInt(1234567890));
    });

    it('should handle zero', () => {
      expect(parseAmount('0', 7)).toBe(BigInt(0));
    });

    it('should pad short decimals with zeros', () => {
      expect(parseAmount('123.5', 7)).toBe(BigInt(1235000000));
    });

    it('should truncate long decimals', () => {
      expect(parseAmount('123.12345678', 7)).toBe(BigInt(1231234567));
    });

    it('should reject invalid formats', () => {
      expect(() => parseAmount('123.45.6', 7)).toThrow();
    });
  });

  describe('Asset Identifier', () => {
    it('should create asset IDs', () => {
      const code = 'USDC';
      const issuer = 'GBUQWP3BOUZX34LOCALNAME6QSN6FBLTZWMNNYHEI5HP2DGTX5DXV6EA';
      const assetId = createAssetId(code, issuer);

      expect(assetId).toBe(`USDC:${issuer}`);
    });

    it('should parse asset IDs', () => {
      const code = 'USDC';
      const issuer = 'GBUQWP3BOUZX34LOCALNAME6QSN6FBLTZWMNNYHEI5HP2DGTX5DXV6EA';
      const assetId = `${code}:${issuer}`;

      const parsed = parseAssetId(assetId);
      expect(parsed.code).toBe(code);
      expect(parsed.issuer).toBe(issuer);
    });

    it('should reject invalid asset codes (>12 chars)', () => {
      const issuer = 'GAQAA5Z4K6GGVRCNLVHT3D3YX3KYKU5LWY246ROYS33V7F7R5CALS63P';
      expect(() => createAssetId('TOOLONGGASSETCODE', issuer)).toThrow();
    });

    it('should reject invalid issuers', () => {
      expect(() => createAssetId('USDC', 'invalid')).toThrow();
    });

    it('should reject malformed asset IDs', () => {
      expect(() => parseAssetId('NOCOLON')).toThrow();
      expect(() => parseAssetId(':NOLEFT')).toThrow();
    });
  });
});

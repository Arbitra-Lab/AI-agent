# Blockchain Module

Typed TypeScript client for Arbitra Soroban contracts on Stellar.

## Overview

The blockchain module provides a strongly-typed, intention-revealing client for interacting with the Arbitra escrow contract. All write operations are simulated before submission to surface errors early and prevent wasted transaction fees.

### Key Features

- **Generated Bindings**: TypeScript bindings auto-generated from Soroban contract WASM
- **Type Safety**: Proper handling of Soroban types (BytesN<32>, Address, i128)
- **Simulation**: All write operations simulated before submission
- **Typed Errors**: Contract errors mapped to readable `EscrowError` variants
- **Bigint Support**: Uses `bigint` for all amount handling (no precision loss)
- **Configuration Management**: Network-specific contract IDs and endpoints

## Structure

```
blockchain/
├── clients/              # Contract clients
│   └── escrow.ts        # Typed Soroban escrow contract client
├── config.ts            # Network config and contract IDs
├── types/               # Type definitions
│   └── escrow.ts        # Escrow contract types and errors
├── utils/               # Utilities
│   └── soroban.ts       # Soroban type helpers
├── generated/           # Auto-generated bindings
│   └── lib.ts           # Generated from stellar CLI
└── __tests__/           # Tests
    ├── integration.test.ts
    └── utils.test.ts
```

## Setup

### 1. Environment Configuration

Set required environment variables in `.env`:

```env
# Network selection
STELLAR_NETWORK=testnet

# Contract IDs (per network)
ESCROW_CONTRACT_ID_TESTNET=CAAA...
ESCROW_CONTRACT_ID_PUBLIC=CBBB...
```

### 2. Generate Bindings

Generate TypeScript bindings from the contract WASM:

```bash
# Prerequisites: stellar CLI installed
npm install -g @stellar/cli

# Generate bindings
npm run generate:escrow-bindings
```

The script does:

1. Locates the contract WASM (from sibling `Arbitra/contract` repo)
2. Generates TypeScript bindings
3. Creates type-safe function stubs

### 3. Install Dependencies

```bash
npm install
```

## Usage

### Creating the Client

```typescript
import { EscrowContractClient } from './blockchain/clients/escrow';

// Create with testnet config
const client = EscrowContractClient.create('testnet');

// Or create with custom config
import { BlockchainConfig } from './blockchain/config';

const config = BlockchainConfig.getEscrowConfig('testnet');
const client = new EscrowContractClient(config);
```

### Reading Escrow Data

```typescript
// Get escrow details
const escrow = await client.getEscrow(escrowId);
console.log(`Escrow ${escrowId}: ${escrow.status}`);

// Check approval count
const approvals = await client.getApprovalCount(escrowId);
console.log(
  `Approvals: ${approvals.currentApprovals}/${approvals.totalApprovalsNeeded}`,
);

// Get release history
const history = await client.getReleaseHistory(escrowId);

// Get timeout config
const timeout = await client.getTimeoutConfig(escrowId);
```

### Creating an Escrow

```typescript
import { Keypair } from 'stellar-sdk';

const signingKey = Keypair.fromSecret(process.env.STELLAR_SECRET_KEY!);

const result = await client.create({
  party1: 'G...', // Stellar address
  party2: 'G...', // Stellar address
  amount: BigInt(1000000000), // Always use bigint!
  assetCode: 'USDC',
  assetIssuer: 'G...', // Stellar address of issuer
  timeoutSeconds: 86400, // 1 day
  arbiter: 'G...', // Optional
  signingKey,
});

console.log(`Created escrow: ${result.escrowId}`);
```

### Funding an Escrow

```typescript
const result = await client.fundEscrow({
  escrowId,
  amount: BigInt(1000000000),
  signingKey,
});

console.log(`Funded: ${result.transactionHash}`);
```

### Approving Release

```typescript
// Full release
await client.approveRelease({
  escrowId,
  signingKey,
});

// Partial release
await client.approvePartialRelease({
  escrowId,
  amount: BigInt(500000000), // Half the amount
  signingKey,
});
```

### Releasing Funds

```typescript
// Release with no deductions
const result = await client.releaseEscrowPartial({
  escrowId,
  toParty: 'G...',
  amount: BigInt(1000000000),
  signingKey,
});

// Release with deductions (fees, etc)
await client.releaseWithDeduction({
  escrowId,
  toParty: 'G...',
  amount: BigInt(1000000000),
  deductions: [
    { recipient: 'PLATFORM_FEE_ADDRESS', amount: BigInt(10000000) },
    { recipient: 'ARBITER_ADDRESS', amount: BigInt(5000000) },
  ],
  signingKey,
});
```

### Filing a Dispute

```typescript
await client.initiateDispute({
  escrowId,
  initiatedBy: 'G...',
  reason: 'Non-delivery of goods',
  signingKey,
});
```

### Timeout Release

```typescript
// After timeout period expires
await client.releaseEscrowOnTimeout({
  escrowId,
  signingKey,
});
```

## Type Safety

### Amount Handling

Always use `bigint` for amounts to prevent precision loss:

```typescript
// ✅ Correct
const amount = BigInt(1000000000);
await client.fundEscrow({ escrowId, amount, signingKey });

// ❌ Wrong (precision loss)
const amount = 1000000000;
await client.fundEscrow({ escrowId, amount, signingKey });
```

Utilities for amount conversion:

```typescript
import {
  validateAmount,
  formatAmount,
  parseAmount,
} from './blockchain/utils/soroban';

// Convert to bigint (handles strings, numbers, bigint)
const amount = validateAmount('1000000000');

// Format for display (default: 7 decimals)
const display = formatAmount(BigInt(1234567890), 7); // "123.456789"

// Parse from display string
const parsed = parseAmount('123.456789', 7); // BigInt(1234567890)
```

### Address Validation

```typescript
import { isValidStellarAddress } from './blockchain/utils/soroban';

if (!isValidStellarAddress(userAddress)) {
  throw new Error('Invalid Stellar address');
}
```

### Error Handling

```typescript
import { EscrowError, EscrowErrorCode } from './blockchain/types/escrow';

try {
  await client.getEscrow(escrowId);
} catch (error) {
  if (error instanceof EscrowError) {
    switch (error.code) {
      case EscrowErrorCode.ESCROW_NOT_FOUND:
        console.log('Escrow does not exist');
        break;
      case EscrowErrorCode.UNAUTHORIZED:
        console.log('You are not authorized for this operation');
        break;
      case EscrowErrorCode.INSUFFICIENT_BALANCE:
        console.log('Not enough balance to fund escrow');
        break;
      // ... handle other error codes
    }
  }
}
```

## Simulation

All write operations are simulated before submission. Simulation includes:

- XDR validation
- Signature verification
- Account sequence number checks
- Contract error simulation
- Fee estimation

If simulation fails, the error is surfaced as an `EscrowError` and the transaction is **not** submitted.

```typescript
try {
  await client.fundEscrow({
    escrowId: 'invalid-id',
    amount: BigInt(1000000000),
    signingKey,
  });
} catch (error) {
  if (error instanceof EscrowError) {
    console.log(`Operation would fail: ${error.message}`);
  }
}
```

## Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

Requires contract deployed to testnet and environment variables set:

```bash
ESCROW_CONTRACT_ID_TESTNET=C... npm run test:integration
```

## Binding Regeneration

When the contract ABI changes:

1. Build the contract in the sibling repo
2. Run the binding generation script:
   ```bash
   npm run generate:escrow-bindings
   ```
3. Update `src/blockchain/clients/escrow.ts` if method signatures changed
4. Run tests to ensure compatibility

CI/CD should fail if bindings are stale to prevent ABI drift.

## Security Considerations

1. **Never use `number` for amounts** — always `bigint` to prevent precision loss
2. **Validate addresses** — use `isValidStellarAddress()` before passing to contract
3. **Simulate before submission** — all write operations are simulated first
4. **Handle errors properly** — check for `EscrowError` and specific error codes
5. **Secure secrets** — never log secret keys; use environment variables
6. **Verify contract ID** — ensure it matches the intended network before submitting transactions

## Roadmap

- [ ] Implement actual Soroban bindings integration
- [ ] Add Horizon event polling for escrow status
- [ ] Implement appeal workflow for dispute resolution
- [ ] Add multi-currency settlement via Stellar DEX
- [ ] Create settlement coordination primitives
- [ ] Add automated notification system

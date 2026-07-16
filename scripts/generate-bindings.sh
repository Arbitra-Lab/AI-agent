#!/bin/bash
#
# Generate TypeScript bindings for the escrow Soroban contract
#
# This script:
# 1. Builds the contract WASM (assumes contract is in sibling repo)
# 2. Generates TypeScript bindings using stellar CLI
# 3. Places bindings in src/blockchain/generated/
#
# Prerequisites:
# - stellar CLI installed (npm install -g @stellar/cli)
# - Contract built and WASM available
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Output directory
OUTPUT_DIR="${PROJECT_ROOT}/src/blockchain/generated"

echo "🔨 Generating Soroban escrow contract bindings..."

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Check if stellar CLI is available
if ! command -v stellar &> /dev/null; then
  echo "❌ stellar CLI not found. Install with: npm install -g @stellar/cli"
  exit 1
fi

# Path to contract WASM (adjust based on actual location)
ESCROW_WASM="${PROJECT_ROOT}/../contract/target/wasm32-unknown-unknown/release/arbitra_escrow.wasm"

if [ ! -f "$ESCROW_WASM" ]; then
  echo "❌ Escrow contract WASM not found at $ESCROW_WASM"
  echo "Make sure the contract is built in the sibling Arbitra/contract repository"
  exit 1
fi

# Generate bindings
echo "📦 Generating TypeScript bindings from $ESCROW_WASM..."
stellar contract bindings typescript \
  --output-dir "$OUTPUT_DIR" \
  "$ESCROW_WASM"

echo "✅ Bindings generated successfully!"
echo "📍 Location: $OUTPUT_DIR"

# Create index file that re-exports generated bindings
cat > "${OUTPUT_DIR}/index.ts" << 'EOF'
/**
 * Generated Soroban Escrow Contract Bindings
 *
 * WARNING: This file is auto-generated. Do not edit directly.
 * Regenerate with: npm run generate:escrow-bindings
 */

export * from './lib';
EOF

echo "✅ Done! Generated bindings are ready to use."
echo ""
echo "📝 Next steps:"
echo "1. Update src/blockchain/clients/escrow.ts to use the generated bindings"
echo "2. Update ESCROW_CONTRACT_ID environment variables"
echo "3. Run tests: npm run test:integration"

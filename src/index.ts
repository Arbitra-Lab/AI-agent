/**
 * Arbitra AI Agent
 *
 * Intelligent AI agent for on-chain arbitration and escrow on Stellar
 */

import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Export blockchain module
export * from './blockchain';

// Health check and startup
async function startup() {
  console.log('🚀 Arbitra AI Agent');
  console.log(`Network: ${process.env.STELLAR_NETWORK || 'testnet'}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Verify critical configuration
  const network = process.env.STELLAR_NETWORK || 'testnet';
  const contractIdKey = `ESCROW_CONTRACT_ID_${network.toUpperCase()}`;

  if (!process.env[contractIdKey]) {
    console.warn(`⚠️  ${contractIdKey} not set`);
    console.warn('   Blockchain operations will not work until configured');
  }

  console.log('✅ Agent ready');
}

// Only run startup if this is the main module
if (require.main === module) {
  startup().catch((error) => {
    console.error('❌ Startup failed:', error);
    process.exit(1);
  });
}

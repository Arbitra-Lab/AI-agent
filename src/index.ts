/**
 * Arbitra AI Agent
 *
 * Intelligent AI agent for on-chain arbitration and escrow on Stellar
 */

import * as dotenv from 'dotenv';
import { PromptManager } from './agent/prompts';
import { Server } from 'http';

// Load environment variables
dotenv.config();

import { createApp } from './app';
import { pool } from './lib/db';
import { closeRedis } from './lib/redis';
import { logger } from './lib/logger';

// Export modules
export * from './blockchain';
export * from './agent';
export { createApp } from './app';

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function startup() {
  // No `await` occurs below, but this must stay `async` so that a
  // synchronous throw anywhere in this function (e.g. from
  // PromptManager.initialize()) becomes a rejected promise, caught by
  // startup().catch(...) below, instead of an uncaught exception.
  await Promise.resolve();

  console.log('🚀 Arbitra AI Agent');
  console.log(`Network: ${process.env.STELLAR_NETWORK || 'testnet'}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Initialize prompt manager
  PromptManager.initialize();
  console.log(
    `✅ Prompts initialized (v${PromptManager.getCurrentSystemPromptVersion()})`,
  );

  // Verify critical configuration
  const network = process.env.STELLAR_NETWORK || 'testnet';
  const contractIdKey = `ESCROW_CONTRACT_ID_${network.toUpperCase()}`;

  if (!process.env[contractIdKey]) {
    console.warn(`⚠️  ${contractIdKey} not set`);
    console.warn('   Blockchain operations will not work until configured');
  }

  const port = Number(process.env.PORT) || 3000;
  const app = createApp();

  const server: Server = app.listen(port, () => {
    logger.info(`✅ Agent ready - listening on port ${port}`);
  });

  let shuttingDown = false;

  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info(`${signal} received, shutting down gracefully...`);

    const forceExit = setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    try {
      // Stop accepting new connections and let in-flight requests drain.
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });

      // Close downstream connections once the HTTP server is fully drained.
      await Promise.all([pool.end(), closeRedis()]);

      clearTimeout(forceExit);
      logger.info('Shutdown complete');
      process.exit(0);
    } catch (err) {
      clearTimeout(forceExit);
      logger.error(`Error during shutdown: ${(err as Error).message}`);
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

// Only run startup if this is the main module
if (require.main === module) {
  startup().catch((error) => {
    console.error('❌ Startup failed:', error);
    process.exit(1);
  });
}

/**
 * Stellar SDK / Horizon API / Soroban smart contract clients
 * (escrow, dispute_resolution, payment, agent_registry, rent_obligation).
 */
import { config } from '@/config/index.js';

export function getStellarNetworkInfo(): {
  network: string;
  horizonUrl: string;
} {
  return {
    network: config.stellar.network,
    horizonUrl: config.stellar.horizonUrl,
  };
}

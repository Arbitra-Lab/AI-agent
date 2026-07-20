import { EscrowConfig } from './types/escrow';

/**
 * Configuration Manager for Soroban contracts
 * Handles network-specific contract IDs and endpoints
 */
export class BlockchainConfig {
  private static readonly TESTNET_HORIZON = 'https://horizon-testnet.stellar.org';
  private static readonly PUBLIC_HORIZON = 'https://horizon.stellar.org';

  private static readonly TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
  private static readonly PUBLIC_PASSPHRASE = 'Public Global Stellar Network ; September 2015';

  /**
   * Get Escrow contract configuration
   */
  static getEscrowConfig(network: 'testnet' | 'public' = 'testnet'): EscrowConfig {
    const contractId = this.getContractId('ESCROW', network);

    if (!contractId) {
      throw new Error(
        `Escrow contract ID not configured for ${network}. ` +
        `Set ESCROW_CONTRACT_ID_${network.toUpperCase()}`,
      );
    }

    return {
      network,
      contractId,
      horizonUrl: network === 'testnet' ? this.TESTNET_HORIZON : this.PUBLIC_HORIZON,
      networkPassphrase:
        network === 'testnet' ? this.TESTNET_PASSPHRASE : this.PUBLIC_PASSPHRASE,
    };
  }

  /**
   * Get network passphrase
   */
  static getNetworkPassphrase(network: 'testnet' | 'public'): string {
    return network === 'testnet' ? this.TESTNET_PASSPHRASE : this.PUBLIC_PASSPHRASE;
  }

  /**
   * Get Horizon URL for network
   */
  static getHorizonUrl(network: 'testnet' | 'public'): string {
    return network === 'testnet' ? this.TESTNET_HORIZON : this.PUBLIC_HORIZON;
  }

  /**
   * Get contract ID from environment
   */
  private static getContractId(contract: string, network: 'testnet' | 'public'): string | undefined {
    const envKey = `${contract}_CONTRACT_ID_${network.toUpperCase()}`;
    const value = process.env[envKey];

    if (!value && process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required environment variable: ${envKey}`);
    }

    return value;
  }
}

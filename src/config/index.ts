/**
 * Centralized application configuration, sourced from environment variables.
 * Import this instead of reading `process.env` directly elsewhere.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL ?? '',
  stellar: {
    network: process.env.STELLAR_NETWORK ?? 'testnet',
    horizonUrl:
      process.env.STELLAR_HORIZON_URL ?? 'https://horizon-testnet.stellar.org',
    secretKey: process.env.STELLAR_SECRET_KEY ?? '',
  },
} as const;

export { required };

import Redis from 'ioredis';
import { authConfig } from '../config';

let client: Redis | undefined;

/**
 * Lazy singleton Redis client for rate limiting. `maxRetriesPerRequest: 1`
 * and a short `commandTimeout` are deliberate: the rate limiter must fail
 * fast into its closed-by-default path on an outage rather than hang the
 * request queue waiting on ioredis's own retry logic.
 */
export function getRedisClient(): Redis {
  if (!client) {
    client = new Redis(authConfig.redis.url, {
      maxRetriesPerRequest: 1,
      commandTimeout: 1000,
      lazyConnect: true,
    });
    client.on('error', () => {
      // Swallow — callers see failures via rejected command promises and
      // must handle them (fail closed). A dangling 'error' listener would
      // otherwise crash the process on every reconnect attempt.
    });
  }
  return client;
}

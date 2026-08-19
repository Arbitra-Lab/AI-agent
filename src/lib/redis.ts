import Redis from 'ioredis';
import { authConfig } from '../config';
import { logger } from './logger';

let client: Redis | undefined;

/**
 * Lazy singleton Redis client, shared by the rate limiter
 * (src/auth/rateLimiters.ts) and the readiness check / graceful shutdown
 * below. `maxRetriesPerRequest: 1` and a short `commandTimeout` are
 * deliberate: callers must fail fast into their own fallback (the rate
 * limiter's closed-by-default path, or a 503 from /ready) rather than hang
 * waiting on ioredis's own retry logic.
 */
export function getRedisClient(): Redis {
  if (!client) {
    client = new Redis(authConfig.redis.url, {
      maxRetriesPerRequest: 1,
      commandTimeout: 1000,
      lazyConnect: true,
    });
    client.on('error', (err) => {
      // ioredis emits 'error' on connection issues; without a listener this
      // would crash the process. Callers see failures via rejected command
      // promises and must handle them (fail closed).
      logger.error(`[redis] connection error: ${err.message}`);
    });
  }
  return client;
}

/**
 * Attempts a PING against Redis. Resolves true/false rather than throwing,
 * so readiness checks can run Postgres and Redis checks concurrently
 * without one rejecting the other.
 */
export async function pingRedis(timeoutMs = 2_000): Promise<boolean> {
  const redis = getRedisClient();
  try {
    if (redis.status !== 'ready' && redis.status !== 'connecting') {
      await redis.connect();
    }
    const result = await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('redis ping timeout')), timeoutMs),
      ),
    ]);
    return result === 'PONG';
  } catch {
    return false;
  }
}

/** Closes the Redis connection - called during graceful shutdown. */
export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => client?.disconnect());
    client = undefined;
  }
}

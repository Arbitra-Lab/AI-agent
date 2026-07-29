import type Redis from 'ioredis';

export interface RateLimitHit {
  /** Requests seen in the current window, including this one. */
  count: number;
  /** Milliseconds remaining until the window resets. */
  ttlMs: number;
}

/**
 * Storage seam for the rate limiter. Kept as an interface so tests can
 * supply an in-memory fake instead of a real Redis server — the same DI
 * pattern used throughout db/adapters for other persistence.
 */
export interface RateLimitStore {
  hit(key: string, windowMs: number): Promise<RateLimitHit>;
}

// INCR + conditional PEXPIRE + PTTL in one round trip, so a crash between
// steps can never leave a counter incremented without an expiry.
const HIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return {count, ttl}
`;

export class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly client: Redis) {}

  async hit(key: string, windowMs: number): Promise<RateLimitHit> {
    const result = (await this.client.eval(HIT_SCRIPT, 1, key, windowMs)) as [
      number,
      number,
    ];
    const [count, ttlMs] = result;
    return { count, ttlMs };
  }
}

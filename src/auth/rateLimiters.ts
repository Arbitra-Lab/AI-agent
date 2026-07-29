import { authConfig } from '../config';
import { getRedisClient } from '../lib/redis';
import { createRateLimiter } from './rateLimit';
import { RedisRateLimitStore } from './rateLimitStore';

/**
 * Ready-to-mount rate limiters for the three presets called out in issue
 * #29: strict for /api/chat (LLM cost), loose for reads, tighter for
 * mutating escrow/dispute routes. Routes from #23/#26/#27 should import
 * these directly rather than constructing their own limiter instances.
 */
const store = new RedisRateLimitStore(getRedisClient());

export const chatRateLimiter = createRateLimiter(
  store,
  authConfig.rateLimits.chat,
  'chat',
);
export const readRateLimiter = createRateLimiter(
  store,
  authConfig.rateLimits.read,
  'read',
);
export const mutateRateLimiter = createRateLimiter(
  store,
  authConfig.rateLimits.mutate,
  'mutate',
);

import { Request, Response, NextFunction } from 'express';
import { RateLimitError, ServiceUnavailableError } from '../lib/errors';
import { logger } from '../lib/logger';
import { RateLimitPreset } from '../config';
import { RateLimitStore } from './rateLimitStore';

/**
 * Redis-backed rate limiting. Keyed by authenticated user id when
 * available, falling back to IP for anonymous callers. On a Redis outage
 * this fails CLOSED (503, not silently unlimited) — see acceptance
 * criteria on issue #29.
 */
export function createRateLimiter(
  store: RateLimitStore,
  preset: RateLimitPreset,
  keyPrefix: string,
) {
  const windowMs = preset.durationSeconds * 1000;

  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const requestId = req.id || 'unknown';
    const identifier = req.user?.id ?? req.ip ?? 'unknown';
    const key = `ratelimit:${keyPrefix}:${identifier}`;

    let hit;
    try {
      hit = await store.hit(key, windowMs);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(
        `[${requestId}] rate limiter unavailable (${keyPrefix}): ${message}`,
      );
      res.setHeader('Retry-After', String(preset.durationSeconds));
      next(
        new ServiceUnavailableError('Rate limiting is temporarily unavailable'),
      );
      return;
    }

    if (hit.count > preset.points) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((hit.ttlMs > 0 ? hit.ttlMs : windowMs) / 1000),
      );
      res.setHeader('Retry-After', String(retryAfterSeconds));
      logger.warn(
        `[${requestId}] rate limit exceeded (${keyPrefix}) for ${identifier}`,
      );
      next(new RateLimitError(`Rate limit exceeded for ${keyPrefix}`));
      return;
    }

    next();
  };
}

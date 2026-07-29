import { logger } from '../lib/logger';

/**
 * Auth/rate-limit configuration, sourced from environment variables.
 *
 * This is deliberately scoped to what issue #29 needs (JWT secrets, token
 * TTLs, Redis URL, rate-limit presets) rather than a project-wide config
 * system — that's issue #5's job. Follow-up work there should be able to
 * absorb this module without changing its call sites.
 */

const DEV_FALLBACK_SECRET = 'dev-insecure-secret-change-me';

function requireSecret(envKey: string): string {
  const value = process.env[envKey];
  if (value && value.trim() !== '') {
    return value;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${envKey}`);
  }

  logger.warn(
    `${envKey} not set — using an insecure development fallback. Do not use in production.`,
  );
  return `${DEV_FALLBACK_SECRET}:${envKey}`;
}

function intFromEnv(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export interface RateLimitPreset {
  /** Max requests allowed within the window. */
  points: number;
  /** Window length, in seconds. */
  durationSeconds: number;
}

export const authConfig = {
  jwt: {
    accessSecret: requireSecret('JWT_ACCESS_SECRET'),
    refreshSecret: requireSecret('JWT_REFRESH_SECRET'),
    accessTokenTtlSeconds: intFromEnv('JWT_ACCESS_TTL_SECONDS', 15 * 60), // 15 minutes
    refreshTokenTtlSeconds: intFromEnv(
      'JWT_REFRESH_TTL_SECONDS',
      30 * 24 * 60 * 60,
    ), // 30 days
    issuer: process.env.JWT_ISSUER || 'arbitra-ai-agent',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  rateLimits: {
    chat: {
      points: intFromEnv('RATE_LIMIT_CHAT_POINTS', 5),
      durationSeconds: intFromEnv('RATE_LIMIT_CHAT_WINDOW_SECONDS', 60),
    } satisfies RateLimitPreset,
    read: {
      points: intFromEnv('RATE_LIMIT_READ_POINTS', 100),
      durationSeconds: intFromEnv('RATE_LIMIT_READ_WINDOW_SECONDS', 60),
    } satisfies RateLimitPreset,
    mutate: {
      points: intFromEnv('RATE_LIMIT_MUTATE_POINTS', 15),
      durationSeconds: intFromEnv('RATE_LIMIT_MUTATE_WINDOW_SECONDS', 60),
    } satisfies RateLimitPreset,
  },
};

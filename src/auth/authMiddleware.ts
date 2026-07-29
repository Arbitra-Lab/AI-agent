import { Request, Response, NextFunction } from 'express';
import { AuthError } from '../lib/errors';
import { logger } from '../lib/logger';
import { verifyAccessToken } from './tokens';

const BEARER_PREFIX = 'Bearer ';

function extractToken(req: Request): string | null {
  const header = req.header('Authorization');
  if (!header || !header.startsWith(BEARER_PREFIX)) return null;
  const token = header.slice(BEARER_PREFIX.length).trim();
  return token === '' ? null : token;
}

/**
 * Validates the request's access token and populates `req.user`.
 * Never logs the token itself — only outcome, user id, and request id.
 */
export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const requestId = req.id || 'unknown';
  const token = extractToken(req);

  if (!token) {
    logger.warn(`[${requestId}] auth: missing bearer token`);
    next(new AuthError('Missing bearer token'));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, stellarAddress: payload.stellarAddress };
    logger.info(`[${requestId}] auth: authenticated user ${payload.sub}`);
    next();
  } catch (err) {
    const message =
      err instanceof AuthError ? err.message : 'Authentication failed';
    logger.warn(`[${requestId}] auth: rejected — ${message}`);
    next(err instanceof AuthError ? err : new AuthError(message));
  }
}

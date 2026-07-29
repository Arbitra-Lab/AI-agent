import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

/**
 * Assigns a correlation id to every request so downstream logging (auth
 * events, error responses) can be tied together. A fuller request-id /
 * correlation system is issue #6's job; this is the minimal seam auth
 * logging needs in the meantime.
 */
export function requestId(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.header('X-Request-Id');
  req.id = incoming && incoming.trim() !== '' ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

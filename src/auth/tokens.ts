import jwt from 'jsonwebtoken';
import { authConfig } from '../config';
import { AuthError } from '../lib/errors';
import {
  AccessTokenPayload,
  AuthenticatedUser,
  RefreshTokenPayload,
} from './types';

/**
 * Thin wrapper around jsonwebtoken. Verification failures (expired,
 * tampered, malformed) are normalized to AuthError so callers never need
 * to know about jsonwebtoken's own error types.
 */

export function signAccessToken(user: AuthenticatedUser): string {
  const payload: Omit<AccessTokenPayload, 'exp' | 'iat'> = {
    sub: user.id,
    stellarAddress: user.stellarAddress,
    type: 'access',
  };
  return jwt.sign(payload, authConfig.jwt.accessSecret, {
    expiresIn: authConfig.jwt.accessTokenTtlSeconds,
    issuer: authConfig.jwt.issuer,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = verify(token, authConfig.jwt.accessSecret);
  if (decoded.type !== 'access') {
    throw new AuthError('Token is not an access token');
  }
  return decoded as AccessTokenPayload;
}

export function signRefreshToken(userId: string, jti: string): string {
  const payload: Omit<RefreshTokenPayload, 'exp' | 'iat'> = {
    sub: userId,
    jti,
    type: 'refresh',
  };
  return jwt.sign(payload, authConfig.jwt.refreshSecret, {
    expiresIn: authConfig.jwt.refreshTokenTtlSeconds,
    issuer: authConfig.jwt.issuer,
  });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = verify(token, authConfig.jwt.refreshSecret);
  if (decoded.type !== 'refresh') {
    throw new AuthError('Token is not a refresh token');
  }
  return decoded as RefreshTokenPayload;
}

function verify(
  token: string,
  secret: string,
): jwt.JwtPayload & { type?: string } {
  try {
    const decoded = jwt.verify(token, secret, {
      issuer: authConfig.jwt.issuer,
    });
    if (typeof decoded === 'string') {
      throw new AuthError('Malformed token payload');
    }
    return decoded;
  } catch (err) {
    if (err instanceof AuthError) throw err;
    if (err instanceof jwt.TokenExpiredError) {
      throw new AuthError('Token has expired');
    }
    // Covers JsonWebTokenError (bad signature, malformed, wrong issuer, etc.)
    throw new AuthError('Invalid token');
  }
}

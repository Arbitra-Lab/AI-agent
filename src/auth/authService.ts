import { randomUUID, createHash } from 'crypto';
import { authConfig } from '../config';
import { AuthError } from '../lib/errors';
import { logger } from '../lib/logger';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from './tokens';
import { RefreshTokenRepository } from './refreshTokenRepository';
import { UserDirectory } from './userDirectory';
import { AuthenticatedUser } from './types';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** SHA-256 hex digest — the only form of the refresh token that touches storage. */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export class AuthService {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly users: UserDirectory,
  ) {}

  async issueTokenPair(user: AuthenticatedUser): Promise<TokenPair> {
    const jti = randomUUID();
    const refreshToken = signRefreshToken(user.id, jti);
    await this.refreshTokens.create({
      id: jti,
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(
        Date.now() + authConfig.jwt.refreshTokenTtlSeconds * 1000,
      ),
    });

    return {
      accessToken: signAccessToken(user),
      refreshToken,
      expiresIn: authConfig.jwt.accessTokenTtlSeconds,
    };
  }

  /**
   * Validates and rotates a refresh token: the presented token is revoked
   * and a new pair is issued in its place. Presenting a token that was
   * already rotated (or revoked) is treated as a signal of token theft —
   * the entire chain for that user is revoked and the caller must
   * re-authenticate.
   */
  async rotateRefreshToken(rawToken: string): Promise<TokenPair> {
    const payload = verifyRefreshToken(rawToken);
    const record = await this.refreshTokens.findByHash(hashToken(rawToken));

    if (!record || record.id !== payload.jti) {
      throw new AuthError('Invalid refresh token');
    }

    if (record.revokedAt) {
      await this.refreshTokens.revokeAllForUser(record.userId);
      logger.warn(
        `Refresh token reuse detected for user ${record.userId}; all sessions revoked`,
      );
      throw new AuthError(
        'Refresh token reuse detected; all sessions have been revoked',
      );
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw new AuthError('Refresh token has expired');
    }

    const user = await this.users.getById(record.userId);
    if (!user) {
      throw new AuthError('User no longer exists');
    }

    const nextJti = randomUUID();
    const nextRefreshToken = signRefreshToken(user.id, nextJti);
    await this.refreshTokens.create({
      id: nextJti,
      userId: user.id,
      tokenHash: hashToken(nextRefreshToken),
      expiresAt: new Date(
        Date.now() + authConfig.jwt.refreshTokenTtlSeconds * 1000,
      ),
    });
    await this.refreshTokens.revoke(record.id, nextJti);

    return {
      accessToken: signAccessToken(user),
      refreshToken: nextRefreshToken,
      expiresIn: authConfig.jwt.accessTokenTtlSeconds,
    };
  }

  async revokeRefreshToken(rawToken: string): Promise<void> {
    const payload = verifyRefreshToken(rawToken);
    const record = await this.refreshTokens.findByHash(hashToken(rawToken));
    if (record && record.id === payload.jti && !record.revokedAt) {
      await this.refreshTokens.revoke(record.id);
    }
  }
}

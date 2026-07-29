import { AuthService } from '../../src/auth/authService';
import {
  RefreshTokenRepository,
  RefreshTokenRecord,
} from '../../src/auth/refreshTokenRepository';
import { UserDirectory } from '../../src/auth/userDirectory';
import { AuthenticatedUser } from '../../src/auth/types';
import { AuthError } from '../../src/lib/errors';

interface StoredToken extends RefreshTokenRecord {
  tokenHash: string;
}

class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  private rows = new Map<string, StoredToken>();

  async create(record: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    this.rows.set(record.id, {
      ...record,
      revokedAt: null,
      replacedByTokenId: null,
    });
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    for (const row of this.rows.values()) {
      if (row.tokenHash === tokenHash) return row;
    }
    return null;
  }

  async revoke(id: string, replacedByTokenId?: string): Promise<void> {
    const row = this.rows.get(id);
    if (!row) return;
    row.revokedAt = new Date();
    if (replacedByTokenId) row.replacedByTokenId = replacedByTokenId;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    for (const row of this.rows.values()) {
      if (row.userId === userId) row.revokedAt = new Date();
    }
  }
}

class InMemoryUserDirectory implements UserDirectory {
  constructor(private readonly users: Map<string, AuthenticatedUser>) {}
  async getById(userId: string): Promise<AuthenticatedUser | null> {
    return this.users.get(userId) ?? null;
  }
}

describe('AuthService', () => {
  const user: AuthenticatedUser = { id: 'user-1', stellarAddress: 'GALICE...' };
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService(
      new InMemoryRefreshTokenRepository(),
      new InMemoryUserDirectory(new Map([[user.id, user]])),
    );
  });

  it('issues an access/refresh token pair', async () => {
    const pair = await service.issueTokenPair(user);
    expect(pair.accessToken).toEqual(expect.any(String));
    expect(pair.refreshToken).toEqual(expect.any(String));
    expect(pair.expiresIn).toBeGreaterThan(0);
  });

  it('rotates a refresh token and revokes the presented one', async () => {
    const first = await service.issueTokenPair(user);
    const rotated = await service.rotateRefreshToken(first.refreshToken);

    expect(rotated.refreshToken).not.toBe(first.refreshToken);
    await expect(
      service.rotateRefreshToken(first.refreshToken),
    ).rejects.toThrow(AuthError);
  });

  it('detects refresh token reuse and revokes the whole chain', async () => {
    const first = await service.issueTokenPair(user);
    const rotated = await service.rotateRefreshToken(first.refreshToken);

    // Replaying the already-rotated token is a theft signal.
    await expect(
      service.rotateRefreshToken(first.refreshToken),
    ).rejects.toThrow(/reuse detected/i);

    // The legitimately-issued successor is revoked too, since we can no
    // longer tell it apart from an attacker's copy.
    await expect(
      service.rotateRefreshToken(rotated.refreshToken),
    ).rejects.toThrow(AuthError);
  });

  it('revokes a refresh token on logout', async () => {
    const pair = await service.issueTokenPair(user);
    await service.revokeRefreshToken(pair.refreshToken);
    await expect(service.rotateRefreshToken(pair.refreshToken)).rejects.toThrow(
      AuthError,
    );
  });

  it('rejects rotation of an unknown token', async () => {
    await expect(
      service.rotateRefreshToken('not-a-real-token'),
    ).rejects.toThrow(AuthError);
  });
});

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByTokenId: string | null;
}

/**
 * Persistence seam for the refresh-token rotation chain. Kept as an
 * interface (Drizzle implementation lives in db/adapters) so authService
 * can be unit tested without a live database — the same pattern used by
 * EscrowStateRepository / CursorStore in src/blockchain/verification.
 */
export interface RefreshTokenRepository {
  create(record: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revoke(id: string, replacedByTokenId?: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}

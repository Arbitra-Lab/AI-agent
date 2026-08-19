import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { refreshTokens } from '../schema';
import type {
  RefreshTokenRepository,
  RefreshTokenRecord,
} from '../../src/auth/refreshTokenRepository';

export class DrizzleRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly db: NodePgDatabase<Record<string, unknown>>) {}

  async create(record: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.db.insert(refreshTokens).values({
      id: record.id,
      userId: record.userId,
      tokenHash: record.tokenHash,
      expiresAt: record.expiresAt,
    });
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const rows = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      userId: row.userId,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      replacedByTokenId: row.replacedByTokenId,
    };
  }

  async revoke(id: string, replacedByTokenId?: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({
        revokedAt: new Date(),
        ...(replacedByTokenId ? { replacedByTokenId } : {}),
      })
      .where(eq(refreshTokens.id, id));
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.userId, userId));
  }
}

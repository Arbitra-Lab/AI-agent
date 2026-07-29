import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Refresh token rotation chain. Only a SHA-256 hash of the token is ever
 * stored — the raw token exists solely in the client's possession.
 * `replacedByTokenId` links rotations so reuse of an already-rotated
 * token can be detected and the whole chain revoked (theft signal).
 */
export const refreshTokens = pgTable("refresh_tokens", {
  id:                uuid("id").primaryKey().defaultRandom(),
  userId:            uuid("user_id").notNull().references(() => users.id),
  tokenHash:         varchar("token_hash", { length: 64 }).notNull().unique(),
  expiresAt:         timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt:         timestamp("revoked_at", { withTimezone: true }),
  replacedByTokenId: uuid("replaced_by_token_id"),
  createdAt:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RefreshToken    = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;

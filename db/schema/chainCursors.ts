import { pgTable, varchar, timestamp } from "drizzle-orm/pg-core";

/**
 * Durable cursors for chain-polling jobs (e.g. escrow reconciliation).
 * Persisting the last-processed position lets a restarted process resume
 * instead of replaying from genesis.
 */
export const chainCursors = pgTable("chain_cursors", {
  /** Job identifier, e.g. "escrow-reconciliation" */
  name:      varchar("name", { length: 64 }).primaryKey(),
  /** Opaque position: ledger sequence or Horizon paging_token */
  cursor:    varchar("cursor", { length: 255 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ChainCursor    = typeof chainCursors.$inferSelect;
export type NewChainCursor = typeof chainCursors.$inferInsert;

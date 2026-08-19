import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  pgEnum,
  text,
} from 'drizzle-orm/pg-core';
import { agreements } from './agreements';
import { users } from './users';

export const escrowStateEnum = pgEnum('escrow_state', [
  'pending_deposit',
  'funded',
  'conditions_met',
  'released',
  'refunded',
  'disputed',
  'expired',
]);

export const escrows = pgTable('escrows', {
  id: uuid('id').primaryKey().defaultRandom(),
  agreementId: uuid('agreement_id')
    .notNull()
    .references(() => agreements.id),
  depositor: uuid('depositor')
    .notNull()
    .references(() => users.id),
  beneficiary: uuid('beneficiary')
    .notNull()
    .references(() => users.id),

  // ── Money (NEVER floating point) ────────────────────────────────────────────
  /** Amount in the smallest representable unit; stored as NUMERIC */
  amount: numeric('amount', { precision: 36, scale: 7 }).notNull(),
  /** e.g. "XLM", "USDC" */
  assetCode: varchar('asset_code', { length: 12 }).notNull(),
  /** Stellar issuer address for non-native assets; null for XLM */
  assetIssuer: varchar('asset_issuer', { length: 56 }),

  state: escrowStateEnum('state').notNull().default('pending_deposit'),

  /** On-chain Soroban contract id */
  contractId: varchar('contract_id', { length: 255 }),

  /** Human-readable release conditions */
  releaseConditions: text('release_conditions'),

  expiresAt: timestamp('expires_at', { withTimezone: true }),
  releasedAt: timestamp('released_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Escrow = typeof escrows.$inferSelect;
export type NewEscrow = typeof escrows.$inferInsert;

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  pgEnum,
  jsonb,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const agreementStateEnum = pgEnum('agreement_state', [
  'draft',
  'pending_signatures',
  'active',
  'completed',
  'cancelled',
  'disputed',
]);

export const agreements = pgTable('agreements', {
  id: uuid('id').primaryKey().defaultRandom(),
  /**
   * Vertical discriminator — keeps the core table generic.
   * e.g. "rental", "freelance", "trade_finance", "insurance"
   */
  vertical: varchar('vertical', { length: 64 }).notNull(),
  partyA: uuid('party_a')
    .notNull()
    .references(() => users.id),
  partyB: uuid('party_b')
    .notNull()
    .references(() => users.id),
  state: agreementStateEnum('state').notNull().default('draft'),
  /**
   * Flexible JSONB terms — vertical-specific data lives here,
   * not in additional columns on this table.
   */
  terms: jsonb('terms').notNull().default({}),
  /** Soroban contract id once deployed on-chain */
  contractId: varchar('contract_id', { length: 255 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Agreement = typeof agreements.$inferSelect;
export type NewAgreement = typeof agreements.$inferInsert;

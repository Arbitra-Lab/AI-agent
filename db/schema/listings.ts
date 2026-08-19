/**
 * RENTAL REFERENCE IMPLEMENTATION
 *
 * This table is intentionally isolated from the core Arbitra schema.
 * It demonstrates how a vertical (rentals) integrates with the platform
 * via the `agreements` table's `vertical = "rental"` discriminator.
 *
 * Do NOT couple core tables (escrows, disputes) to this table.
 */
import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  boolean,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const listingStatusEnum = pgEnum('listing_status', [
  'draft',
  'active',
  'rented',
  'inactive',
]);

export const listings = pgTable('listings', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  location: varchar('location', { length: 512 }),
  /** Monthly rent — stored as NUMERIC, never float */
  rentAmount: numeric('rent_amount', { precision: 18, scale: 7 }).notNull(),
  assetCode: varchar('asset_code', { length: 12 }).notNull().default('USDC'),
  assetIssuer: varchar('asset_issuer', { length: 56 }),
  status: listingStatusEnum('status').notNull().default('draft'),
  amenities: text('amenities'), // comma-separated or JSON string
  bedroomCount: varchar('bedroom_count', { length: 8 }),
  isAvailable: boolean('is_available').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;

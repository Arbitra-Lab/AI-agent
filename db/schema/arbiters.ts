import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const arbiters = pgTable('arbiters', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id),
  /** Comma-separated vertical tags, e.g. "rental,freelance" */
  specialisations: varchar('specialisations', { length: 255 }),
  /** Vote weight in weighted-panel rulings */
  weight: integer('weight').notNull().default(1),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Arbiter = typeof arbiters.$inferSelect;
export type NewArbiter = typeof arbiters.$inferInsert;

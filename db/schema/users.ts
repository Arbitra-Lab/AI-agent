import { pgTable, uuid, varchar, text, boolean, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const verificationStatusEnum = pgEnum("verification_status", [
  "unverified",
  "pending",
  "verified",
  "rejected",
]);

export const users = pgTable("users", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  stellarAddress:     varchar("stellar_address", { length: 56 }).unique(),
  email:              varchar("email", { length: 255 }).unique(),
  displayName:        varchar("display_name", { length: 120 }),
  verificationStatus: verificationStatusEnum("verification_status")
                        .notNull()
                        .default("unverified"),
  /** Reputation score — higher is better, starts at 0 */
  reputationScore:    numeric("reputation_score", { precision: 10, scale: 4 })
                        .notNull()
                        .default("0"),
  isActive:           boolean("is_active").notNull().default(true),
  metadata:           text("metadata"), // JSONB-compatible text for extra fields
  createdAt:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User    = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
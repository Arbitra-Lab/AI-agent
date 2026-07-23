import { pgTable, uuid, varchar, text, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { agreements } from "./agreements";
import { escrows } from "./escrows";
import { users } from "./users";
import { arbiters } from "./arbiters";

export const disputeStateEnum = pgEnum("dispute_state", [
  "filed",
  "under_review",
  "ruled",
  "appealed",
  "resolved",
]);

export const disputeVoteEnum = pgEnum("dispute_vote", [
  "approve_claimant",
  "approve_respondent",
  "split",
  "abstain",
]);

export const disputes = pgTable("disputes", {
  id:           uuid("id").primaryKey().defaultRandom(),
  agreementId:  uuid("agreement_id").notNull().references(() => agreements.id),
  escrowId:     uuid("escrow_id").references(() => escrows.id),
  claimant:     uuid("claimant").notNull().references(() => users.id),
  respondent:   uuid("respondent").notNull().references(() => users.id),
  state:        disputeStateEnum("state").notNull().default("filed"),
  claimSummary: text("claim_summary"),
  ruling:       text("ruling"),
  ruledBy:      uuid("ruled_by").references(() => users.id),
  ruledAt:      timestamp("ruled_at", { withTimezone: true }),
  deadlineAt:   timestamp("deadline_at", { withTimezone: true }),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const disputeEvidence = pgTable("dispute_evidence", {
  id:          uuid("id").primaryKey().defaultRandom(),
  disputeId:   uuid("dispute_id").notNull().references(() => disputes.id),
  submitter:   uuid("submitter").notNull().references(() => users.id),
  /** Off-chain storage pointer, e.g. "ipfs://..." */
  contentRef:  varchar("content_ref", { length: 512 }).notNull(),
  /** Hex digest of the content, for tamper detection */
  contentHash: varchar("content_hash", { length: 128 }).notNull(),
  description: text("description"),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const disputeVotes = pgTable("dispute_votes", {
  id:         uuid("id").primaryKey().defaultRandom(),
  disputeId:  uuid("dispute_id").notNull().references(() => disputes.id),
  arbiterId:  uuid("arbiter_id").notNull().references(() => arbiters.id),
  vote:       disputeVoteEnum("vote"),
  /** Weight snapshot at cast time, so later weight changes don't rewrite history */
  weight:     integer("weight").notNull().default(1),
  rationale:  text("rationale"),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Dispute         = typeof disputes.$inferSelect;
export type NewDispute      = typeof disputes.$inferInsert;
export type DisputeEvidence    = typeof disputeEvidence.$inferSelect;
export type NewDisputeEvidence = typeof disputeEvidence.$inferInsert;
export type DisputeVote     = typeof disputeVotes.$inferSelect;
export type NewDisputeVote  = typeof disputeVotes.$inferInsert;

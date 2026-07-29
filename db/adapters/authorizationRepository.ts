import { and, eq, or } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { agreements, arbiters, disputes, disputeVotes, users } from "../schema";
import type { AuthorizationRepository } from "../../src/auth/authorize";

/**
 * "Assigned" arbiter today means: an active arbiter with a dispute_votes
 * row for that dispute (cast or pending — `vote` is nullable to represent
 * "on the panel, hasn't voted yet"), or the arbiter who issued the ruling.
 * There's no separate pre-vote assignment table yet — see docs/ADR-002
 * for why that's a deliberate follow-up rather than something invented
 * here.
 */
export class DrizzleAuthorizationRepository implements AuthorizationRepository {
  constructor(private readonly db: NodePgDatabase<Record<string, unknown>>) {}

  async resolveUserId(identifier: string): Promise<string | null> {
    const rows = await this.db
      .select({ id: users.id })
      .from(users)
      .where(or(eq(users.id, identifier), eq(users.stellarAddress, identifier)))
      .limit(1);
    return rows[0]?.id ?? null;
  }

  async isPartyToAgreement(userId: string, agreementId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: agreements.id })
      .from(agreements)
      .where(
        and(
          eq(agreements.id, agreementId),
          or(eq(agreements.partyA, userId), eq(agreements.partyB, userId))
        )
      )
      .limit(1);
    return rows.length > 0;
  }

  async isArbiterAssignedToDispute(userId: string, disputeId: string): Promise<boolean> {
    const arbiterRows = await this.db
      .select({ id: arbiters.id })
      .from(arbiters)
      .where(and(eq(arbiters.userId, userId), eq(arbiters.isActive, true)))
      .limit(1);
    const arbiter = arbiterRows[0];
    if (!arbiter) return false;

    const ruledRows = await this.db
      .select({ id: disputes.id })
      .from(disputes)
      .where(and(eq(disputes.id, disputeId), eq(disputes.ruledBy, userId)))
      .limit(1);
    if (ruledRows.length > 0) return true;

    const voteRows = await this.db
      .select({ id: disputeVotes.id })
      .from(disputeVotes)
      .where(and(eq(disputeVotes.disputeId, disputeId), eq(disputeVotes.arbiterId, arbiter.id)))
      .limit(1);
    return voteRows.length > 0;
  }
}

import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { users } from "../schema";
import type { UserDirectory } from "../../src/auth/userDirectory";
import type { AuthenticatedUser } from "../../src/auth/types";

export class DrizzleUserDirectory implements UserDirectory {
  constructor(private readonly db: NodePgDatabase<Record<string, unknown>>) {}

  async getById(userId: string): Promise<AuthenticatedUser | null> {
    const rows = await this.db
      .select({ id: users.id, stellarAddress: users.stellarAddress, isActive: users.isActive })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const row = rows[0];
    if (!row || !row.isActive) return null;

    return { id: row.id, stellarAddress: row.stellarAddress };
  }
}

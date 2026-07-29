import { AuthenticatedUser } from './types';

/**
 * Minimal user lookup seam needed by auth (re-issuing an access token on
 * refresh needs current user fields). Drizzle implementation lives in
 * db/adapters/userDirectory.ts.
 */
export interface UserDirectory {
  getById(userId: string): Promise<AuthenticatedUser | null>;
}

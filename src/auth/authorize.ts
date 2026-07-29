import { Request, Response, NextFunction } from 'express';
import { AuthError, ForbiddenError } from '../lib/errors';
import { ToolContext } from '../types/context';

/**
 * Relationship-based authorization. What matters is not a role, but
 * whether the caller is a party to the agreement/dispute in question.
 *
 * This is the single implementation of those predicates — both Express
 * routes (via `requireParty` / `requireArbiter`) and agent tools (via
 * `isPartyTo` / `isAssignedArbiter` directly, see `assertPartyTo` below)
 * call into the same `AuthorizationRepository`, backed by
 * db/adapters/authorizationRepository.ts in production.
 */
export interface AuthorizationRepository {
  /**
   * Bridges the two identity spaces callers show up in: a DB user id
   * (from a verified JWT) or a raw Stellar address (ToolContext.caller,
   * pending SEP-10 — see docs/ADR-002). Returns the canonical user id
   * either way, or null if the identifier resolves to no known user.
   */
  resolveUserId(identifier: string): Promise<string | null>;
  isPartyToAgreement(userId: string, agreementId: string): Promise<boolean>;
  isArbiterAssignedToDispute(
    userId: string,
    disputeId: string,
  ): Promise<boolean>;
}

export async function isPartyTo(
  repo: AuthorizationRepository,
  callerIdentifier: string,
  agreementId: string,
): Promise<boolean> {
  const userId = await repo.resolveUserId(callerIdentifier);
  if (!userId) return false;
  return repo.isPartyToAgreement(userId, agreementId);
}

export async function isAssignedArbiter(
  repo: AuthorizationRepository,
  callerIdentifier: string,
  disputeId: string,
): Promise<boolean> {
  const userId = await repo.resolveUserId(callerIdentifier);
  if (!userId) return false;
  return repo.isArbiterAssignedToDispute(userId, disputeId);
}

/** Express middleware: 403s unless the authenticated user is a party to the agreement. */
export function requireParty(
  repo: AuthorizationRepository,
  getAgreementId: (req: Request) => string,
) {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!req.user) {
      next(new AuthError());
      return;
    }
    const allowed = await isPartyTo(repo, req.user.id, getAgreementId(req));
    if (!allowed) {
      next(new ForbiddenError('You are not a party to this agreement'));
      return;
    }
    next();
  };
}

/** Express middleware: 403s unless the authenticated user is an arbiter assigned to the dispute. */
export function requireArbiter(
  repo: AuthorizationRepository,
  getDisputeId: (req: Request) => string,
) {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!req.user) {
      next(new AuthError());
      return;
    }
    const allowed = await isAssignedArbiter(
      repo,
      req.user.id,
      getDisputeId(req),
    );
    if (!allowed) {
      next(
        new ForbiddenError('You are not an arbiter assigned to this dispute'),
      );
      return;
    }
    next();
  };
}

/**
 * Tool-context equivalent of `requireParty`, for agent tools that mutate
 * or read agreement-scoped data. Throws ForbiddenError rather than
 * returning a boolean so tool `execute()` bodies can call it and continue
 * straight-line, matching how they already throw on other invalid state.
 */
export async function assertPartyTo(
  repo: AuthorizationRepository,
  context: ToolContext,
  agreementId: string,
): Promise<void> {
  if (!(await isPartyTo(repo, context.caller, agreementId))) {
    throw new ForbiddenError(
      `Caller '${context.caller}' is not a party to agreement '${agreementId}'.`,
    );
  }
}

export async function assertAssignedArbiter(
  repo: AuthorizationRepository,
  context: ToolContext,
  disputeId: string,
): Promise<void> {
  if (!(await isAssignedArbiter(repo, context.caller, disputeId))) {
    throw new ForbiddenError(
      `Caller '${context.caller}' is not an arbiter assigned to dispute '${disputeId}'.`,
    );
  }
}

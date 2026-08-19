import {
  isPartyTo,
  isAssignedArbiter,
  requireParty,
  requireArbiter,
  assertPartyTo,
  assertAssignedArbiter,
  AuthorizationRepository,
} from '../../src/auth/authorize';
import { ForbiddenError, AuthError } from '../../src/lib/errors';

class FakeAuthorizationRepository implements AuthorizationRepository {
  constructor(
    private readonly knownUsers: Set<string>,
    private readonly agreementParties: Map<string, [string, string]>,
    private readonly disputeArbiters: Map<string, Set<string>>,
  ) {}

  resolveUserId(identifier: string): Promise<string | null> {
    return Promise.resolve(this.knownUsers.has(identifier) ? identifier : null);
  }

  isPartyToAgreement(userId: string, agreementId: string): Promise<boolean> {
    const parties = this.agreementParties.get(agreementId);
    return Promise.resolve(!!parties && parties.includes(userId));
  }

  isArbiterAssignedToDispute(
    userId: string,
    disputeId: string,
  ): Promise<boolean> {
    return Promise.resolve(
      this.disputeArbiters.get(disputeId)?.has(userId) ?? false,
    );
  }
}

const repo = new FakeAuthorizationRepository(
  new Set(['alice', 'bob', 'stranger', 'arb-1']),
  new Map([['agreement-1', ['alice', 'bob']]]),
  new Map([['dispute-1', new Set(['arb-1'])]]),
);

describe('isPartyTo / isAssignedArbiter predicates', () => {
  it('is true for a party to the agreement', async () => {
    expect(await isPartyTo(repo, 'alice', 'agreement-1')).toBe(true);
    expect(await isPartyTo(repo, 'bob', 'agreement-1')).toBe(true);
  });

  it('is false for a caller who is not a party', async () => {
    expect(await isPartyTo(repo, 'stranger', 'agreement-1')).toBe(false);
  });

  it('is false for an unresolvable caller identifier', async () => {
    expect(await isPartyTo(repo, 'ghost', 'agreement-1')).toBe(false);
  });

  it('is true for an arbiter assigned to the dispute', async () => {
    expect(await isAssignedArbiter(repo, 'arb-1', 'dispute-1')).toBe(true);
  });

  it('is false for a non-arbiter', async () => {
    expect(await isAssignedArbiter(repo, 'alice', 'dispute-1')).toBe(false);
  });
});

describe('requireParty / requireArbiter middleware', () => {
  it('requireParty allows a party through', async () => {
    const next = jest.fn();
    await requireParty(repo, () => 'agreement-1')(
      { user: { id: 'alice' } } as any,
      {} as any,
      next,
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('requireParty forbids a non-party', async () => {
    const next = jest.fn();
    await requireParty(repo, () => 'agreement-1')(
      { user: { id: 'stranger' } } as any,
      {} as any,
      next,
    );
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('requireParty rejects unauthenticated requests', async () => {
    const next = jest.fn();
    await requireParty(repo, () => 'agreement-1')({} as any, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(AuthError));
  });

  it('requireArbiter allows an assigned arbiter through', async () => {
    const next = jest.fn();
    await requireArbiter(repo, () => 'dispute-1')(
      { user: { id: 'arb-1' } } as any,
      {} as any,
      next,
    );
    expect(next).toHaveBeenCalledWith();
  });

  it('requireArbiter forbids a non-arbiter', async () => {
    const next = jest.fn();
    await requireArbiter(repo, () => 'dispute-1')(
      { user: { id: 'alice' } } as any,
      {} as any,
      next,
    );
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});

describe('tool-context helpers (shared with agent tools)', () => {
  it('assertPartyTo resolves for a party and throws for a non-party', async () => {
    await expect(
      assertPartyTo(repo, { caller: 'alice' }, 'agreement-1'),
    ).resolves.toBeUndefined();
    await expect(
      assertPartyTo(repo, { caller: 'stranger' }, 'agreement-1'),
    ).rejects.toThrow(ForbiddenError);
  });

  it('assertAssignedArbiter resolves for an assigned arbiter and throws otherwise', async () => {
    await expect(
      assertAssignedArbiter(repo, { caller: 'arb-1' }, 'dispute-1'),
    ).resolves.toBeUndefined();
    await expect(
      assertAssignedArbiter(repo, { caller: 'alice' }, 'dispute-1'),
    ).rejects.toThrow(ForbiddenError);
  });
});

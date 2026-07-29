import jwt from 'jsonwebtoken';
import { Request } from 'express';
import { authenticate } from '../../src/auth/authMiddleware';
import { signAccessToken } from '../../src/auth/tokens';
import { authConfig } from '../../src/config';
import { AuthError } from '../../src/lib/errors';
import { AuthenticatedUser } from '../../src/auth/types';

function makeReq(authorizationHeader?: string): Request {
  return {
    id: 'req-123',
    header: jest.fn((name: string) =>
      name === 'Authorization' ? authorizationHeader : undefined,
    ),
  } as unknown as Request;
}

describe('authenticate middleware', () => {
  const user: AuthenticatedUser = { id: 'user-1', stellarAddress: 'GALICE...' };
  let next: jest.Mock;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    next = jest.fn();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('populates req.user for a valid token', () => {
    const token = signAccessToken(user);
    const req = makeReq(`Bearer ${token}`);
    authenticate(req, {} as any, next);
    expect(req.user).toEqual(user);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a missing Authorization header', () => {
    const req = makeReq(undefined);
    authenticate(req, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(AuthError));
    expect(req.user).toBeUndefined();
  });

  it('rejects a non-Bearer Authorization header', () => {
    const req = makeReq('Basic dXNlcjpwYXNz');
    authenticate(req, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(AuthError));
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign(
      { sub: user.id, stellarAddress: user.stellarAddress, type: 'access' },
      authConfig.jwt.accessSecret,
      { expiresIn: -10, issuer: authConfig.jwt.issuer },
    );
    const req = makeReq(`Bearer ${expired}`);
    authenticate(req, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(AuthError));
  });

  it('rejects a tampered token', () => {
    const token = signAccessToken(user);
    const parts = token.split('.');
    const lastChar = parts[2].slice(-1);
    parts[2] = parts[2].slice(0, -1) + (lastChar === 'a' ? 'b' : 'a');
    const req = makeReq(`Bearer ${parts.join('.')}`);
    authenticate(req, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.any(AuthError));
  });

  it('never logs the raw token value', () => {
    const token = signAccessToken(user);
    const req = makeReq(`Bearer ${token}`);
    authenticate(req, {} as any, next);

    const loggedText = [...logSpy.mock.calls, ...warnSpy.mock.calls]
      .flat()
      .join(' ');
    expect(loggedText).not.toContain(token);
  });
});

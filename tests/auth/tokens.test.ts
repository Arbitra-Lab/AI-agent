import jwt from 'jsonwebtoken';
import { authConfig } from '../../src/config';
import {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../src/auth/tokens';
import { AuthError } from '../../src/lib/errors';
import { AuthenticatedUser } from '../../src/auth/types';

function tamper(token: string): string {
  const parts = token.split('.');
  const lastChar = parts[2].slice(-1);
  parts[2] = parts[2].slice(0, -1) + (lastChar === 'a' ? 'b' : 'a');
  return parts.join('.');
}

describe('access tokens', () => {
  const user: AuthenticatedUser = { id: 'user-1', stellarAddress: 'GALICE...' };

  it('round-trips a valid token', () => {
    const token = signAccessToken(user);
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe(user.id);
    expect(payload.stellarAddress).toBe(user.stellarAddress);
    expect(payload.type).toBe('access');
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign(
      { sub: user.id, stellarAddress: user.stellarAddress, type: 'access' },
      authConfig.jwt.accessSecret,
      { expiresIn: -10, issuer: authConfig.jwt.issuer },
    );
    expect(() => verifyAccessToken(expired)).toThrow(AuthError);
    expect(() => verifyAccessToken(expired)).toThrow(/expired/i);
  });

  it('rejects a tampered token', () => {
    const token = signAccessToken(user);
    expect(() => verifyAccessToken(tamper(token))).toThrow(AuthError);
  });

  it('rejects a refresh token presented as an access token', () => {
    const refreshToken = signRefreshToken(user.id, 'jti-1');
    expect(() => verifyAccessToken(refreshToken)).toThrow(AuthError);
  });
});

describe('refresh tokens', () => {
  const user: AuthenticatedUser = { id: 'user-1', stellarAddress: null };

  it('round-trips a valid token', () => {
    const token = signRefreshToken(user.id, 'jti-1');
    const payload = verifyRefreshToken(token);
    expect(payload.sub).toBe(user.id);
    expect(payload.jti).toBe('jti-1');
    expect(payload.type).toBe('refresh');
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign(
      { sub: user.id, jti: 'jti-1', type: 'refresh' },
      authConfig.jwt.refreshSecret,
      { expiresIn: -10, issuer: authConfig.jwt.issuer },
    );
    expect(() => verifyRefreshToken(expired)).toThrow(AuthError);
    expect(() => verifyRefreshToken(expired)).toThrow(/expired/i);
  });

  it('rejects a tampered token', () => {
    const token = signRefreshToken(user.id, 'jti-1');
    expect(() => verifyRefreshToken(tamper(token))).toThrow(AuthError);
  });

  it('rejects an access token presented as a refresh token', () => {
    const accessToken = signAccessToken(user);
    expect(() => verifyRefreshToken(accessToken)).toThrow(AuthError);
  });
});

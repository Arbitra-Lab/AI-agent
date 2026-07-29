/**
 * The authenticated identity attached to a request by `authenticate`.
 * `id` is the durable DB user id (users.id) — the same identity space
 * relationship predicates in `authorize.ts` operate on.
 */
export interface AuthenticatedUser {
  id: string;
  stellarAddress: string | null;
}

export interface AccessTokenPayload {
  sub: string; // user id
  stellarAddress: string | null;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string; // user id
  jti: string; // refresh_tokens.id — ties the JWT to its DB row
  type: 'refresh';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      id?: string;
    }
  }
}

export {};

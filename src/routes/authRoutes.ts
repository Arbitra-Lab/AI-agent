import { Router } from 'express';
import { asyncHandler } from '../utils/async-handler';
import { ValidationError } from '../lib/errors';
import { AuthService } from '../auth/authService';

/**
 * Refresh rotation and logout only. Initial token issuance (login) is
 * intentionally not exposed here — Phase 1 has no password/credential
 * store, and SEP-10 wallet-signature auth is the intended long-term
 * issuance path (see docs/ADR-002). Until that lands, `AuthService.issueTokenPair`
 * is the seam whatever issues the first token pair (currently: internal
 * callers / tests) should call.
 */
export function createAuthRoutes(authService: AuthService): Router {
  const router = Router();

  router.post(
    '/refresh',
    asyncHandler(async (req, res) => {
      const { refreshToken } = req.body ?? {};
      if (typeof refreshToken !== 'string' || refreshToken === '') {
        throw new ValidationError("'refreshToken' is required");
      }
      const pair = await authService.rotateRefreshToken(refreshToken);
      res.json(pair);
    }),
  );

  router.post(
    '/logout',
    asyncHandler(async (req, res) => {
      const { refreshToken } = req.body ?? {};
      if (typeof refreshToken !== 'string' || refreshToken === '') {
        throw new ValidationError("'refreshToken' is required");
      }
      await authService.revokeRefreshToken(refreshToken);
      res.status(204).send();
    }),
  );

  return router;
}

/**
 * Express routes, controllers, and middleware live here.
 * See README "API Endpoints" for the planned surface:
 * /api/chat, /api/escrow, /api/disputes, /api/recommendations, /api/contracts/analyze.
 */
import { Router } from 'express';

export const router: Router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

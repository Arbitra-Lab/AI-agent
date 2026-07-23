import express, { Express } from 'express';
import { AuthService } from './auth/authService';
import { createAuthRoutes } from './routes/authRoutes';
import { requestId } from './middleware/requestId';
import { errorHandler } from './middleware/error-handler';

/**
 * Builds the Express app from injected dependencies rather than
 * constructing them here. Keeps this file (and everything under src/)
 * free of imports from db/ — the compiled `src/**` program has a strict
 * rootDir and db/ is a sibling tree run via tsx, not tsc. The concrete
 * Drizzle-backed wiring lives in server.ts at the repo root.
 */
export function createApp(authService: AuthService): Express {
  const app = express();

  app.use(express.json());
  app.use(requestId);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', createAuthRoutes(authService));

  app.use(errorHandler);

  return app;
}

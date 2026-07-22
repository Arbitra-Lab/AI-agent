import express, { Express, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { pool } from "./lib/db";
import { pingRedis } from "./lib/redis";
import { errorHandler } from "./middleware/error-handler";
import { logger } from "./lib/logger";

// Read directly rather than `import ... from "../package.json"` - tsconfig's
// rootDir is "./src", so a static import of a file outside it fails the build.
// This path works from both src/ (dev, via tsx) and dist/ (after tsc build),
// since both sit one level below the repo root.
const pkg = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8")
) as { version: string };

/** Attaches a request id (used by the error handler and logs). */
function requestId(req: Request, _res: Response, next: NextFunction) {
  (req as Request & { id?: string }).id =
    (req.headers["x-request-id"] as string) || randomUUID();
  next();
}

async function checkPostgres(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch (err) {
    logger.error(`[ready] postgres check failed: ${(err as Error).message}`);
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  const ok = await pingRedis();
  if (!ok) {
    logger.error("[ready] redis check failed");
  }
  return ok;
}

/**
 * Builds a configured Express app without binding a port. Kept separate
 * from src/index.ts's listen() call so tests can exercise routes directly
 * with supertest, and so nothing here has a side effect on import.
 */
export function createApp(): Express {
  const app = express();

  // Express sits behind a proxy/load balancer in most deployments; this
  // makes req.ip and rate limiting (future work) reflect the real client.
  app.set("trust proxy", true);

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(requestId);

  app.get("/health", (_req: Request, res: Response) => {
    // Liveness: always 200 once the process is up and this handler can run.
    // Deliberately does NOT touch Postgres/Redis - a slow dependency should
    // not make an orchestrator think the process itself is unhealthy.
    res.status(200).json({
      status: "ok",
      version: pkg.version,
      uptime: process.uptime(),
    });
  });

  app.get("/ready", async (_req: Request, res: Response) => {
    const [postgresOk, redisOk] = await Promise.all([
      checkPostgres(),
      checkRedis(),
    ]);

    const ready = postgresOk && redisOk;
    const body = {
      status: ready ? "ok" : "unavailable",
      checks: {
        postgres: postgresOk ? "ok" : "unavailable",
        redis: redisOk ? "ok" : "unavailable",
      },
    };

    res.status(ready ? 200 : 503).json(body);
  });

  // 404 for anything unmatched, before the error handler.
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: `Cannot ${req.method} ${req.path}`,
      },
    });
  });

  app.use(errorHandler);

  return app;
}

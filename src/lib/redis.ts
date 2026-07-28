import Redis from "ioredis";

/**
 * Minimal Redis connection used only for readiness checks in this issue.
 *
 * Deliberately narrow scope: connection lifecycle + a ping, nothing more.
 * A full client with caching helpers is tracked separately in issue #12
 * ("Redis client with connection lifecycle and caching helpers") - when
 * that lands it should likely replace this module rather than duplicate it.
 */
let client: Redis | null = null;

function getRedisClient(): Redis {
  if (!client) {
    client = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      // Fail fast for readiness checks instead of buffering commands while
      // disconnected, and don't let ioredis retry forever in the background.
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      enableOfflineQueue: false,
    });

    client.on("error", (err) => {
      // ioredis emits 'error' on connection issues; without a listener this
      // would crash the process. Readiness checks below surface the actual
      // failure to the caller.
      // eslint-disable-next-line no-console
      console.error("[redis] connection error", err.message);
    });
  }
  return client;
}

/**
 * Attempts a PING against Redis. Resolves true/false rather than throwing,
 * so readiness checks can run Postgres and Redis checks concurrently
 * without one rejecting the other.
 */
export async function pingRedis(timeoutMs = 2_000): Promise<boolean> {
  const redis = getRedisClient();
  try {
    if (redis.status !== "ready" && redis.status !== "connecting") {
      await redis.connect();
    }
    const result = await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("redis ping timeout")), timeoutMs)
      ),
    ]);
    return result === "PONG";
  } catch {
    return false;
  }
}

/** Closes the Redis connection - called during graceful shutdown. */
export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => client?.disconnect());
    client = null;
  }
}

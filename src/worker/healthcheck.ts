import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

async function healthcheck(): Promise<void> {
  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    lazyConnect: true,
  });

  try {
    await redis.connect();
    const pong = await redis.ping();
    if (pong !== "PONG") {
      throw new Error(`Redis ping failed: ${pong}`);
    }

    const workerKeys = await redis.keys("bull:recaptel-*:id");
    if (workerKeys.length === 0) {
      console.warn("Warning: No BullMQ queues found");
    }

    await redis.quit();
    process.exit(0);
  } catch (err) {
    console.error("Healthcheck failed:", err instanceof Error ? err.message : err);
    await redis.quit().catch(() => {});
    process.exit(1);
  }
}

healthcheck();



import { Redis } from "ioredis";
import type { ConnectionOptions } from "bullmq";

export const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

function parseRedisUrl(url: string): { host: string; port: number; password?: string } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "localhost",
    port: parseInt(parsed.port || "6379", 10),
    password: parsed.password || undefined,
  };
}

export function getBullMQConnection(): ConnectionOptions {
  const { host, port, password } = parseRedisUrl(REDIS_URL);
  return {
    host,
    port,
    password,
    maxRetriesPerRequest: null,
  };
}

let redis: Redis | null = null;
let subscriber: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return redis;
}

export function getSubscriber(): Redis {
  if (!subscriber) {
    subscriber = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return subscriber;
}

export const REDIS_CHANNELS = {
  authCommand: (userId: string) => `telegram:auth:${userId}`,
  authState: (userId: string) => `telegram:state:${userId}`,
} as const;

export type AuthCommand =
  | { type: "CONNECT" }
  | { type: "PHONE"; phone: string }
  | { type: "CODE"; code: string }
  | { type: "PASSWORD"; password: string }
  | { type: "DISCONNECT" };

export type AuthStateUpdate =
  | { type: "STATE"; state: string }
  | { type: "ERROR"; message: string };

export async function publishAuthState(userId: string, update: AuthStateUpdate): Promise<void> {
  const redis = getRedis();
  await redis.publish(REDIS_CHANNELS.authState(userId), JSON.stringify(update));
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
  if (subscriber) {
    await subscriber.quit();
    subscriber = null;
  }
}


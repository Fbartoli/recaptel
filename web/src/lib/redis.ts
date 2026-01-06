import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

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

export async function publishAuthCommand(userId: string, command: AuthCommand): Promise<void> {
  const redis = getRedis();
  await redis.publish(REDIS_CHANNELS.authCommand(userId), JSON.stringify(command));
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


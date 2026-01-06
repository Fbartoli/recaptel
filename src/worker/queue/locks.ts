import { getRedis } from "../redis.js";

const DEFAULT_LOCK_TTL_MS = 10 * 60 * 1000; // 10 minutes

export type LockType = "ingest" | "digest";

function lockKey(type: LockType, userId: string): string {
  return `lock:${type}:${userId}`;
}

export async function acquireLock(
  type: LockType,
  userId: string,
  ttlMs: number = DEFAULT_LOCK_TTL_MS
): Promise<boolean> {
  const redis = getRedis();
  const key = lockKey(type, userId);
  const value = `${process.pid}:${Date.now()}`;

  const result = await redis.set(key, value, "PX", ttlMs, "NX");
  return result === "OK";
}

export async function releaseLock(type: LockType, userId: string): Promise<void> {
  const redis = getRedis();
  const key = lockKey(type, userId);
  await redis.del(key);
}

export async function extendLock(
  type: LockType,
  userId: string,
  ttlMs: number = DEFAULT_LOCK_TTL_MS
): Promise<boolean> {
  const redis = getRedis();
  const key = lockKey(type, userId);

  const exists = await redis.exists(key);
  if (!exists) {
    return false;
  }

  await redis.pexpire(key, ttlMs);
  return true;
}

export async function isLocked(type: LockType, userId: string): Promise<boolean> {
  const redis = getRedis();
  const key = lockKey(type, userId);
  const exists = await redis.exists(key);
  return exists === 1;
}

export async function withLock<T>(
  type: LockType,
  userId: string,
  fn: () => Promise<T>,
  ttlMs: number = DEFAULT_LOCK_TTL_MS
): Promise<{ acquired: boolean; result?: T; error?: Error }> {
  const acquired = await acquireLock(type, userId, ttlMs);
  
  if (!acquired) {
    return { acquired: false };
  }

  try {
    const result = await fn();
    return { acquired: true, result };
  } catch (err) {
    return { acquired: true, error: err instanceof Error ? err : new Error(String(err)) };
  } finally {
    await releaseLock(type, userId);
  }
}


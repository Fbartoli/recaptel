import { NextResponse } from "next/server";
import { getRedis } from "./redis";

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { windowMs: 60_000, maxRequests: 10 }
): Promise<{ success: boolean; remaining: number; resetAt: number }> {
  const redis = getRedis();
  const key = `ratelimit:${identifier}`;
  const now = Date.now();
  const windowSec = Math.ceil(config.windowMs / 1000);

  try {
    const multi = redis.multi();
    multi.incr(key);
    multi.pttl(key);
    const results = await multi.exec();

    if (!results) {
      return { success: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
    }

    const count = results[0]?.[1] as number;
    const ttl = results[1]?.[1] as number;

    if (ttl === -1 || ttl === -2) {
      await redis.expire(key, windowSec);
    }

    const resetAt = ttl > 0 ? now + ttl : now + config.windowMs;
    const remaining = Math.max(0, config.maxRequests - count);

    if (count > config.maxRequests) {
      return { success: false, remaining: 0, resetAt };
    }

    return { success: true, remaining, resetAt };
  } catch (err) {
    console.error("[RateLimit] Redis error, allowing request:", err);
    return { success: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
  }
}

export function rateLimitResponse(resetAt: number): NextResponse {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return NextResponse.json(
    { error: "Too many requests", retryAfter },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
      },
    }
  );
}

export function getRateLimitIdentifier(request: Request, userId?: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return userId ? `user:${userId}` : `ip:${ip}`;
}

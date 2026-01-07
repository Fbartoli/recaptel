import { db } from "@/db";
import { users } from "@/db/schema";
import { getRedis } from "@/lib/redis";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { status: "ok" | "error"; latencyMs?: number; error?: string }> = {};

  const dbStart = Date.now();
  try {
    await db.select({ count: sql<number>`1` }).from(users).limit(1);
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch (err) {
    checks.database = { status: "error", error: err instanceof Error ? err.message : String(err) };
  }

  const redisStart = Date.now();
  try {
    const redis = getRedis();
    await redis.ping();
    checks.redis = { status: "ok", latencyMs: Date.now() - redisStart };
  } catch (err) {
    checks.redis = { status: "error", error: err instanceof Error ? err.message : String(err) };
  }

  const allOk = Object.values(checks).every((c) => c.status === "ok");

  return NextResponse.json(
    {
      status: allOk ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allOk ? 200 : 503 }
  );
}



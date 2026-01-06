import { auth } from "@/auth";
import { db } from "@/db";
import { users, messages, digests } from "@/db/schema";
import { getRedis } from "@/lib/redis";
import { NextResponse } from "next/server";
import { sql, count } from "drizzle-orm";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim()).filter(Boolean);

export async function GET() {
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const userStats = await db
    .select({
      id: users.id,
      email: users.email,
      telegramAuthState: users.telegramAuthState,
      lastIngestAt: users.lastIngestAt,
      lastDigestAt: users.lastDigestAt,
      telegramConnectedAt: users.telegramConnectedAt,
    })
    .from(users);

  const messageCount = await db.select({ count: count() }).from(messages);
  const digestCount = await db.select({ count: count() }).from(digests);

  let queueStats: Record<string, unknown> = {};
  try {
    const redis = getRedis();
    // BullMQ uses lists for wait/active, sorted sets for failed/completed/delayed
    const ingestWait = await redis.llen("bull:recaptel-ingest:wait");
    const ingestActive = await redis.llen("bull:recaptel-ingest:active");
    const ingestFailed = await redis.zcard("bull:recaptel-ingest:failed");
    const ingestCompleted = await redis.zcard("bull:recaptel-ingest:completed");
    const ingestDelayed = await redis.zcard("bull:recaptel-ingest:delayed");
    
    const digestWait = await redis.llen("bull:recaptel-digest:wait");
    const digestActive = await redis.llen("bull:recaptel-digest:active");
    const digestFailed = await redis.zcard("bull:recaptel-digest:failed");
    const digestCompleted = await redis.zcard("bull:recaptel-digest:completed");
    const digestDelayed = await redis.zcard("bull:recaptel-digest:delayed");

    queueStats = {
      ingest: { wait: ingestWait, active: ingestActive, failed: ingestFailed, completed: ingestCompleted, delayed: ingestDelayed },
      digest: { wait: digestWait, active: digestActive, failed: digestFailed, completed: digestCompleted, delayed: digestDelayed },
    };
  } catch (err) {
    queueStats = { error: err instanceof Error ? err.message : String(err) };
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    users: userStats,
    totals: {
      users: userStats.length,
      usersReady: userStats.filter(u => u.telegramAuthState === "ready").length,
      messages: messageCount[0]?.count || 0,
      digests: digestCount[0]?.count || 0,
    },
    queues: queueStats,
  });
}


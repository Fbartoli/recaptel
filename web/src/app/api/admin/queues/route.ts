import { auth } from "@/auth";
import { getRedis } from "@/lib/redis";
import { NextResponse } from "next/server";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim()).filter(Boolean);

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const queue = searchParams.get("queue") || "recaptel-ingest";
  const status = searchParams.get("status") || "failed";

  try {
    const redis = getRedis();
    const key = `bull:${queue}:${status}`;
    
    // BullMQ uses lists for wait/active, sorted sets for failed/completed/delayed
    const isZSet = ["failed", "completed", "delayed"].includes(status);
    let jobs: string[];
    
    if (isZSet) {
      jobs = await redis.zrange(key, 0, 50);
    } else {
      jobs = await redis.lrange(key, 0, 50);
    }
    
    const jobDetails = await Promise.all(
      jobs.map(async (jobId) => {
        const jobKey = `bull:${queue}:${jobId}`;
        const data = await redis.hgetall(jobKey);
        return {
          id: jobId,
          ...data,
          data: data.data ? JSON.parse(data.data) : null,
          failedReason: data.failedReason || null,
          processedOn: data.processedOn ? new Date(parseInt(data.processedOn)).toISOString() : null,
          finishedOn: data.finishedOn ? new Date(parseInt(data.finishedOn)).toISOString() : null,
        };
      })
    );

    return NextResponse.json({
      queue,
      status,
      count: jobs.length,
      jobs: jobDetails,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: { action: string; queue: string; jobId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, queue, jobId } = body;

  try {
    const redis = getRedis();

    if (action === "retry" && jobId) {
      await redis.lrem(`bull:${queue}:failed`, 1, jobId);
      await redis.rpush(`bull:${queue}:wait`, jobId);
      return NextResponse.json({ success: true, message: `Job ${jobId} moved to wait queue` });
    }

    if (action === "clear-failed") {
      const count = await redis.del(`bull:${queue}:failed`);
      return NextResponse.json({ success: true, message: `Cleared failed jobs`, count });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}


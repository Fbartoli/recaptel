import { DateTime } from "luxon";
import type Database from "better-sqlite3";
import { ingestQueue, digestQueue, type IngestJobData, type DigestJobData } from "./queues.js";

interface ReadyUser {
  id: string;
  timezone: string;
  digestHourLocal: number;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  lastDigestAt: number | null;
}

export async function setupRepeatableJobs(): Promise<void> {
  await ingestQueue.upsertJobScheduler(
    "ingest-scheduler",
    { pattern: "*/10 * * * *" },
    {
      name: "scheduled-ingest",
      data: { userId: "__scheduler__" },
    }
  );

  await digestQueue.upsertJobScheduler(
    "digest-scheduler",
    { pattern: "* * * * *" },
    {
      name: "scheduled-digest-check",
      data: { userId: "__scheduler__", digestDate: "", timezone: "", telegramBotToken: "", telegramChatId: "" },
    }
  );

  console.log("[Queue] Repeatable jobs registered");
}

export async function enqueueIngestForAllUsers(db: Database.Database): Promise<number> {
  const users = getReadyUsers(db);
  let enqueued = 0;

  for (const user of users) {
    const jobId = `ingest-${user.id}`;
    
    const existing = await ingestQueue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === "active" || state === "waiting" || state === "delayed") {
        continue;
      }
    }

    await ingestQueue.add(
      "user-ingest",
      { userId: user.id },
      { jobId }
    );
    enqueued++;
  }

  return enqueued;
}

export async function enqueueDigestsForDueUsers(db: Database.Database): Promise<number> {
  const users = getReadyUsers(db);
  const now = DateTime.now();
  let enqueued = 0;

  for (const user of users) {
    if (!user.telegramBotToken || !user.telegramChatId) {
      continue;
    }

    const userNow = now.setZone(user.timezone || "UTC");
    const currentHour = userNow.hour;
    const currentMinute = userNow.minute;

    if (currentHour !== user.digestHourLocal || currentMinute !== 0) {
      continue;
    }

    const digestDate = userNow.minus({ days: 1 }).toFormat("yyyy-MM-dd");

    if (wasDigestSentToday(user.lastDigestAt, user.timezone)) {
      continue;
    }

    const jobId = `digest-${user.id}-${digestDate}`;
    
    const existing = await digestQueue.getJob(jobId);
    if (existing) {
      continue;
    }

    await digestQueue.add(
      "user-digest",
      {
        userId: user.id,
        digestDate,
        timezone: user.timezone || "UTC",
        telegramBotToken: user.telegramBotToken,
        telegramChatId: user.telegramChatId,
      },
      { jobId }
    );
    enqueued++;
  }

  return enqueued;
}

function getReadyUsers(db: Database.Database): ReadyUser[] {
  const stmt = db.prepare(`
    SELECT 
      id,
      timezone,
      digest_hour_local as digestHourLocal,
      telegram_bot_token as telegramBotToken,
      telegram_chat_id as telegramChatId,
      last_digest_at as lastDigestAt
    FROM users
    WHERE telegram_auth_state = 'ready'
  `);
  return stmt.all() as ReadyUser[];
}

function wasDigestSentToday(lastDigestAt: number | null, timezone: string): boolean {
  if (!lastDigestAt) return false;
  
  const lastDigest = DateTime.fromSeconds(lastDigestAt).setZone(timezone);
  const now = DateTime.now().setZone(timezone);
  
  return lastDigest.hasSame(now, "day");
}


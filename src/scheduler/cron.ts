import cron from "node-cron";
import type { Config } from "../config.js";
import { runIngest } from "../telegram/tdlib/ingest.js";
import { runDigest } from "../digest/buildPrompt.js";
import { sendDigest } from "../telegram/sendDigest.js";

const userLocks = new Map<string, boolean>();

function acquireLock(userId: string): boolean {
  if (userLocks.get(userId)) {
    return false;
  }
  userLocks.set(userId, true);
  return true;
}

function releaseLock(userId: string): void {
  userLocks.set(userId, false);
}

async function runIngestWithLock(config: Config, userId: string): Promise<void> {
  if (!acquireLock(userId)) {
    console.log(`[${new Date().toISOString()}] Skipping ingest for ${userId} - previous job still running`);
    return;
  }
  try {
    await runIngest(config, userId);
  } finally {
    releaseLock(userId);
  }
}

async function runDigestWithLock(config: Config, userId: string): Promise<void> {
  if (!acquireLock(userId)) {
    console.log(`[${new Date().toISOString()}] Skipping digest for ${userId} - previous job still running`);
    return;
  }
  try {
    const digestText = await runDigest(config, userId);
    await sendDigest(config, digestText);
    console.log("Digest sent successfully!");
  } finally {
    releaseLock(userId);
  }
}

export function startScheduler(config: Config, userId: string = "default"): void {
  const digestHour = config.digestHourLocal;

  console.log(`RecapTel scheduler started for user: ${userId}`);
  console.log(`Timezone: ${config.timezone}`);
  console.log(`Daily digest will be sent at ${digestHour}:00 local time`);
  console.log(`Ingest runs every 30 minutes\n`);

  cron.schedule("*/30 * * * *", async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled ingest...`);
    try {
      await runIngestWithLock(config, userId);
    } catch (err) {
      console.error("Ingest error:", err);
    }
  });

  cron.schedule(`0 ${digestHour} * * *`, async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled digest...`);
    try {
      await runDigestWithLock(config, userId);
    } catch (err) {
      console.error("Digest error:", err);
    }
  }, {
    timezone: config.timezone,
  });

  console.log("Running initial ingest...\n");
  runIngestWithLock(config, userId).catch((err) => console.error("Initial ingest error:", err));
}

import { Worker, type Job } from "bullmq";
import type Database from "better-sqlite3";
import { getBullMQConnection } from "../redis.js";
import { QUEUE_NAMES, type IngestJobData, type DigestJobData } from "./queues.js";
import { acquireLock, releaseLock } from "./locks.js";
import { enqueueIngestForAllUsers, enqueueDigestsForDueUsers } from "./enqueue.js";
import type { TdlibManager } from "../tdlibManager.js";
import { runIngestForUser, runDigestForUser } from "../jobs.js";

const connection = getBullMQConnection();

interface WorkerDeps {
  db: Database.Database;
  tdlibManager: TdlibManager;
  llmConfig: {
    llmBaseUrl: string;
    llmApiKey: string;
    llmModel: string;
  };
}

let deps: WorkerDeps | null = null;

export function setWorkerDeps(workerDeps: WorkerDeps): void {
  deps = workerDeps;
}

function getDeps(): WorkerDeps {
  if (!deps) {
    throw new Error("Worker dependencies not initialized. Call setWorkerDeps first.");
  }
  return deps;
}

async function processIngestJob(job: Job<IngestJobData>): Promise<void> {
  const { userId } = job.data;
  const { db, tdlibManager } = getDeps();

  if (userId === "__scheduler__") {
    const enqueued = await enqueueIngestForAllUsers(db);
    console.log(`[Ingest] Scheduler enqueued ${enqueued} user ingest jobs`);
    return;
  }

  console.log(`[Ingest] Starting job for user ${userId} (attempt ${job.attemptsMade + 1})`);

  const lockAcquired = await acquireLock("ingest", userId, 15 * 60 * 1000);
  if (!lockAcquired) {
    console.log(`[Ingest] Lock not acquired for ${userId}, skipping`);
    return;
  }

  try {
    if (!tdlibManager.isReady(userId)) {
      await tdlibManager.createClient(userId);
      await waitForReady(tdlibManager, userId, 10000);
    }

    if (!tdlibManager.isReady(userId)) {
      throw new Error(`TDLib client not ready for user ${userId}`);
    }

    await runIngestForUser(userId, db, tdlibManager);
    updateLastIngest(db, userId);
    console.log(`[Ingest] Completed for user ${userId}`);
  } finally {
    await releaseLock("ingest", userId);
  }
}

async function processDigestJob(job: Job<DigestJobData>): Promise<void> {
  const { userId, digestDate, timezone, telegramBotToken, telegramChatId } = job.data;
  const { db, llmConfig } = getDeps();

  if (userId === "__scheduler__") {
    const enqueued = await enqueueDigestsForDueUsers(db);
    if (enqueued > 0) {
      console.log(`[Digest] Scheduler enqueued ${enqueued} user digest jobs`);
    }
    return;
  }

  console.log(`[Digest] Starting job for user ${userId}, date ${digestDate} (attempt ${job.attemptsMade + 1})`);

  const lockAcquired = await acquireLock("digest", userId, 10 * 60 * 1000);
  if (!lockAcquired) {
    console.log(`[Digest] Lock not acquired for ${userId}, skipping`);
    return;
  }

  try {
    if (wasDigestAlreadySent(db, userId, digestDate)) {
      console.log(`[Digest] Already sent for ${userId} on ${digestDate}, skipping`);
      return;
    }

    await runDigestForUser(
      {
        id: userId,
        timezone,
        digestHourLocal: 0,
        telegramBotToken,
        telegramChatId,
      },
      db,
      llmConfig
    );

    updateLastDigest(db, userId);
    console.log(`[Digest] Completed for user ${userId}`);
  } finally {
    await releaseLock("digest", userId);
  }
}

async function waitForReady(tdlibManager: TdlibManager, userId: string, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (tdlibManager.isReady(userId)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

function updateLastIngest(db: Database.Database, userId: string): void {
  const stmt = db.prepare(`
    UPDATE users SET last_ingest_at = unixepoch(), updated_at = unixepoch()
    WHERE id = ?
  `);
  stmt.run(userId);
}

function updateLastDigest(db: Database.Database, userId: string): void {
  const stmt = db.prepare(`
    UPDATE users SET last_digest_at = unixepoch(), updated_at = unixepoch()
    WHERE id = ?
  `);
  stmt.run(userId);
}

function wasDigestAlreadySent(db: Database.Database, userId: string, digestDate: string): boolean {
  const stmt = db.prepare(`
    SELECT 1 FROM digests 
    WHERE user_id = ? AND digest_date = ? AND sent_at IS NOT NULL
    LIMIT 1
  `);
  const row = stmt.get(userId, digestDate);
  return !!row;
}

let ingestWorker: Worker<IngestJobData> | null = null;
let digestWorker: Worker<DigestJobData> | null = null;

function ts(): string {
  return new Date().toISOString();
}

function setupWorkerEvents<T>(worker: Worker<T>, queueName: string): void {
  worker.on("active", (job) => {
    if ((job.data as { userId?: string }).userId !== "__scheduler__") {
      console.log(`[${ts()}] [${queueName}] Job ${job.id} ACTIVE (attempt ${job.attemptsMade + 1})`);
    }
  });

  worker.on("completed", (job) => {
    if ((job.data as { userId?: string }).userId !== "__scheduler__") {
      const duration = job.finishedOn && job.processedOn
        ? `${job.finishedOn - job.processedOn}ms`
        : "unknown";
      console.log(`[${ts()}] [${queueName}] Job ${job.id} COMPLETED in ${duration}`);
    }
  });

  worker.on("failed", (job, err) => {
    const userId = (job?.data as { userId?: string })?.userId;
    const willRetry = job && job.attemptsMade < (job.opts.attempts ?? 1);
    console.error(
      `[${ts()}] [${queueName}] Job ${job?.id} FAILED (attempt ${job?.attemptsMade ?? "?"}/${job?.opts.attempts ?? "?"})`,
      willRetry ? "[will retry]" : "[no more retries]",
      `user=${userId}`,
      `error=${err.message}`
    );
  });

  worker.on("stalled", (jobId) => {
    console.warn(`[${ts()}] [${queueName}] Job ${jobId} STALLED (will be retried)`);
  });

  worker.on("error", (err) => {
    console.error(`[${ts()}] [${queueName}] Worker ERROR:`, err.message);
  });
}

export function startWorkers(concurrency: number = 3): void {
  ingestWorker = new Worker<IngestJobData>(
    QUEUE_NAMES.ingest,
    processIngestJob,
    {
      connection,
      concurrency,
      lockDuration: 5 * 60 * 1000,
      stalledInterval: 60000,
    }
  );
  setupWorkerEvents(ingestWorker, "Ingest");

  digestWorker = new Worker<DigestJobData>(
    QUEUE_NAMES.digest,
    processDigestJob,
    {
      connection,
      concurrency,
      lockDuration: 5 * 60 * 1000,
      stalledInterval: 60000,
    }
  );
  setupWorkerEvents(digestWorker, "Digest");

  console.log(`[${ts()}] [Workers] Started with concurrency ${concurrency}`);
}

export async function stopWorkers(): Promise<void> {
  if (ingestWorker) {
    await ingestWorker.close();
    ingestWorker = null;
  }
  if (digestWorker) {
    await digestWorker.close();
    digestWorker = null;
  }
  console.log(`[${ts()}] [Workers] Stopped`);
}

export async function getQueueMetrics(): Promise<{
  ingest: { waiting: number; active: number; completed: number; failed: number };
  digest: { waiting: number; active: number; completed: number; failed: number };
}> {
  const { ingestQueue, digestQueue } = await import("./queues.js");

  const [ingestCounts, digestCounts] = await Promise.all([
    ingestQueue.getJobCounts("waiting", "active", "completed", "failed"),
    digestQueue.getJobCounts("waiting", "active", "completed", "failed"),
  ]);

  return {
    ingest: {
      waiting: ingestCounts.waiting ?? 0,
      active: ingestCounts.active ?? 0,
      completed: ingestCounts.completed ?? 0,
      failed: ingestCounts.failed ?? 0,
    },
    digest: {
      waiting: digestCounts.waiting ?? 0,
      active: digestCounts.active ?? 0,
      completed: digestCounts.completed ?? 0,
      failed: digestCounts.failed ?? 0,
    },
  };
}

export async function logQueueMetrics(): Promise<void> {
  const metrics = await getQueueMetrics();
  console.log(`[${ts()}] [Metrics] Ingest: waiting=${metrics.ingest.waiting} active=${metrics.ingest.active} completed=${metrics.ingest.completed} failed=${metrics.ingest.failed}`);
  console.log(`[${ts()}] [Metrics] Digest: waiting=${metrics.digest.waiting} active=${metrics.digest.active} completed=${metrics.digest.completed} failed=${metrics.digest.failed}`);
}


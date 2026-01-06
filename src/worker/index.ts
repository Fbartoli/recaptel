import Database from "better-sqlite3";
import { TdlibManager } from "./tdlibManager.js";
import { RedisHandler } from "./redisHandler.js";
import { closeRedis } from "./redis.js";
import { closeQueues } from "./queue/queues.js";
import { setupRepeatableJobs } from "./queue/enqueue.js";
import { setWorkerDeps, startWorkers, stopWorkers } from "./queue/workers.js";

const WEB_DB_PATH = process.env.WEB_DB_PATH || "web/data/recaptel-web.db";
const TDLIB_DATA_DIR = process.env.TDLIB_DATA_DIR || "data/tdlib";
const TELEGRAM_API_ID = parseInt(process.env.TELEGRAM_API_ID || "0", 10);
const TELEGRAM_API_HASH = process.env.TELEGRAM_API_HASH || "";
const LLM_BASE_URL = process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1";
const LLM_API_KEY = process.env.LLM_API_KEY || "";
const LLM_MODEL = process.env.LLM_MODEL || "openrouter/auto";
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "3", 10);

async function main(): Promise<void> {
  console.log("=== RecapTel Worker (BullMQ) ===");
  console.log(`Web DB: ${WEB_DB_PATH}`);
  console.log(`TDLib data: ${TDLIB_DATA_DIR}`);
  console.log(`Concurrency: ${WORKER_CONCURRENCY}`);
  console.log();

  if (!TELEGRAM_API_ID || !TELEGRAM_API_HASH) {
    console.error("Missing TELEGRAM_API_ID or TELEGRAM_API_HASH");
    process.exit(1);
  }

  if (!LLM_API_KEY) {
    console.error("Missing LLM_API_KEY");
    process.exit(1);
  }

  const db = new Database(WEB_DB_PATH, { readonly: false });
  db.pragma("journal_mode = WAL");

  const tdlibManager = new TdlibManager({
    telegramApiId: TELEGRAM_API_ID,
    telegramApiHash: TELEGRAM_API_HASH,
    tdlibDataDir: TDLIB_DATA_DIR,
  });

  const redisHandler = new RedisHandler(tdlibManager, db);

  setWorkerDeps({
    db,
    tdlibManager,
    llmConfig: {
      llmBaseUrl: LLM_BASE_URL,
      llmApiKey: LLM_API_KEY,
      llmModel: LLM_MODEL,
    },
  });

  async function shutdown(): Promise<void> {
    console.log("\nShutting down...");
    await stopWorkers();
    await closeQueues();
    await redisHandler.stop();
    await tdlibManager.closeAll();
    await closeRedis();
    db.close();
    console.log("Shutdown complete");
    process.exit(0);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await redisHandler.start();
  await setupRepeatableJobs();
  startWorkers(WORKER_CONCURRENCY);

  console.log("Worker is running with BullMQ. Press Ctrl+C to stop.\n");
  console.log("Jobs:");
  console.log("  - Ingest: every 10 minutes (for all ready users)");
  console.log("  - Digest: every minute check (queues at user's local hour)\n");
}

main().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});

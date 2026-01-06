import { Queue } from "bullmq";
import { getBullMQConnection } from "../redis.js";

const connection = getBullMQConnection();

export interface IngestJobData {
  userId: string;
}

export interface DigestJobData {
  userId: string;
  digestDate: string;
  timezone: string;
  telegramBotToken: string;
  telegramChatId: string;
}

export const QUEUE_NAMES = {
  ingest: "recaptel-ingest",
  digest: "recaptel-digest",
} as const;

export const ingestQueue = new Queue<IngestJobData>(QUEUE_NAMES.ingest, {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 30000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export const digestQueue = new Queue<DigestJobData>(QUEUE_NAMES.digest, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 60000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export async function closeQueues(): Promise<void> {
  await ingestQueue.close();
  await digestQueue.close();
}


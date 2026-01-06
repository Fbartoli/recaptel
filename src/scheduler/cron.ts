import cron from "node-cron";
import type { Config } from "../config.js";
import { runIngest } from "../telegram/ingest.js";
import { runDigest } from "../digest/buildPrompt.js";
import { sendDigest } from "../telegram/sendDigest.js";

export function startScheduler(config: Config): void {
  const digestHour = config.digestHourLocal;

  console.log(`RecapTel scheduler started`);
  console.log(`Timezone: ${config.timezone}`);
  console.log(`Daily digest will be sent at ${digestHour}:00 local time`);
  console.log(`Ingest runs every 30 minutes\n`);

  cron.schedule("*/30 * * * *", async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled ingest...`);
    try {
      await runIngest(config);
    } catch (err) {
      console.error("Ingest error:", err);
    }
  });

  cron.schedule(`0 ${digestHour} * * *`, async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled digest...`);
    try {
      const digestText = await runDigest(config);
      await sendDigest(config, digestText);
      console.log("Digest sent successfully!");
    } catch (err) {
      console.error("Digest error:", err);
    }
  }, {
    timezone: config.timezone,
  });

  console.log("Running initial ingest...\n");
  runIngest(config).catch((err) => console.error("Initial ingest error:", err));
}


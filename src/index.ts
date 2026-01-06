#!/usr/bin/env node
import { Command } from "commander";
import { getConfig, getConfigSafe } from "./config.js";
import { runLogin } from "./telegram/gramjsClient.js";
import { runIngest } from "./telegram/ingest.js";
import { runDigest } from "./digest/buildPrompt.js";
import { sendTestMessage, sendDigest } from "./telegram/sendDigest.js";
import { startScheduler } from "./scheduler/cron.js";

const program = new Command();

program
  .name("recaptel")
  .description("Telegram daily digest app")
  .version("1.0.0");

program
  .command("login")
  .description("Interactively login to Telegram and save session")
  .action(async () => {
    const config = getConfig();
    await runLogin(config);
  });

program
  .command("ingest")
  .description("Fetch new messages from Telegram")
  .option("--dry-run", "Print discovered chats without storing")
  .action(async (opts) => {
    const config = getConfig();
    await runIngest(config, { dryRun: opts.dryRun });
  });

program
  .command("digest")
  .description("Generate daily digest from stored messages")
  .option("--dry-run", "Print digest without sending")
  .action(async (opts) => {
    const config = getConfig();
    const digestText = await runDigest(config);
    if (opts.dryRun) {
      console.log("\n--- DIGEST (dry run) ---\n");
      console.log(digestText);
    } else {
      await sendDigest(config, digestText);
      console.log("Digest sent!");
    }
  });

program
  .command("send-test")
  .description("Send a test message via bot to verify config")
  .action(async () => {
    const config = getConfig();
    await sendTestMessage(config);
    console.log("Test message sent!");
  });

program
  .command("run")
  .description("Run the scheduler (ingest + digest on schedule)")
  .action(async () => {
    const config = getConfig();
    startScheduler(config);
  });

program.parse();


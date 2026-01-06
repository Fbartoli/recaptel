#!/usr/bin/env node
import { Command } from "commander";
import { getConfig } from "./config.js";
import { runTdlibLogin, checkAuthStatus, logoutUser } from "./telegram/tdlib/auth.js";
import { runIngest } from "./telegram/tdlib/ingest.js";
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
  .description("Interactively login to Telegram via TDLib")
  .option("-u, --user <userId>", "User ID for multi-user mode", "default")
  .action(async (opts) => {
    const config = getConfig();
    await runTdlibLogin(config, opts.user);
  });

program
  .command("auth-status")
  .description("Check TDLib authorization status")
  .option("-u, --user <userId>", "User ID for multi-user mode", "default")
  .action(async (opts) => {
    const config = getConfig();
    const state = await checkAuthStatus(config, opts.user);
    console.log(`Auth state for user '${opts.user}': ${state}`);
  });

program
  .command("logout")
  .description("Logout from Telegram")
  .option("-u, --user <userId>", "User ID for multi-user mode", "default")
  .action(async (opts) => {
    const config = getConfig();
    await logoutUser(config, opts.user);
  });

program
  .command("ingest")
  .description("Fetch new messages from Telegram")
  .option("--dry-run", "Print discovered chats without storing")
  .option("-u, --user <userId>", "User ID for multi-user mode", "default")
  .action(async (opts) => {
    const config = getConfig();
    await runIngest(config, opts.user, { dryRun: opts.dryRun });
  });

program
  .command("digest")
  .description("Generate daily digest from stored messages")
  .option("--dry-run", "Print digest without sending")
  .option("-u, --user <userId>", "User ID for multi-user mode", "default")
  .action(async (opts) => {
    const config = getConfig();
    const digestText = await runDigest(config, opts.user);
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
  .option("-u, --user <userId>", "User ID for multi-user mode", "default")
  .action(async (opts) => {
    const config = getConfig();
    startScheduler(config, opts.user);
  });

program.parse();

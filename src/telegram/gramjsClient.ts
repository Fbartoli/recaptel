import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { createInterface } from "readline";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import type { Config } from "../config.js";

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

export function loadSession(config: Config): string {
  if (config.telegramSession) {
    return config.telegramSession;
  }
  if (existsSync(config.sessionPath)) {
    return readFileSync(config.sessionPath, "utf-8").trim();
  }
  return "";
}

export function saveSession(config: Config, sessionString: string): void {
  const dir = dirname(config.sessionPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(config.sessionPath, sessionString, "utf-8");
}

export async function createClient(config: Config): Promise<TelegramClient> {
  const sessionString = loadSession(config);
  const session = new StringSession(sessionString);

  const client = new TelegramClient(session, config.telegramApiId, config.telegramApiHash, {
    connectionRetries: 5,
  });

  return client;
}

export async function runLogin(config: Config): Promise<void> {
  console.log("Starting Telegram login...");
  console.log("You will need your phone number and will receive a code.");

  const client = await createClient(config);

  await client.start({
    phoneNumber: async () => prompt("Enter your phone number: "),
    password: async () => prompt("Enter your 2FA password (if enabled): "),
    phoneCode: async () => prompt("Enter the code you received: "),
    onError: (err) => console.error("Login error:", err),
  });

  const sessionString = client.session.save() as unknown as string;
  saveSession(config, sessionString);

  console.log("\nLogin successful!");
  console.log(`Session saved to: ${config.sessionPath}`);
  console.log("\nYou can also set TELEGRAM_SESSION env var to this value:");
  console.log(sessionString);

  await client.disconnect();
}

export async function getConnectedClient(config: Config): Promise<TelegramClient> {
  const client = await createClient(config);

  const sessionString = loadSession(config);
  if (!sessionString) {
    throw new Error("No session found. Run 'recaptel login' first.");
  }

  await client.connect();
  return client;
}


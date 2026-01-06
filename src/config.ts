import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const parseCommaSeparated = (val: string | undefined): string[] => {
  if (!val || val.trim() === "") return [];
  return val.split(",").map((s) => s.trim()).filter(Boolean);
};

const configSchema = z.object({
  telegramApiId: z.coerce.number().int().positive(),
  telegramApiHash: z.string().min(1),
  telegramSession: z.string().optional(),

  telegramBotToken: z.string().min(1),
  telegramDigestChatId: z.string().min(1),

  llmBaseUrl: z.string().url().default("https://api.openai.com/v1"),
  llmApiKey: z.string().min(1),
  llmModel: z.string().default("gpt-4o-mini"),

  timezone: z.string().default("UTC"),
  digestHourLocal: z.coerce.number().int().min(0).max(23).default(9),

  chatAllowlist: z.array(z.string()).default([]),
  chatBlocklist: z.array(z.string()).default([]),

  dbPath: z.string().default("data/recaptel.db"),
  sessionPath: z.string().default("data/session.txt"),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  const raw = {
    telegramApiId: process.env.TELEGRAM_API_ID,
    telegramApiHash: process.env.TELEGRAM_API_HASH,
    telegramSession: process.env.TELEGRAM_SESSION,

    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramDigestChatId: process.env.TELEGRAM_DIGEST_CHAT_ID,

    llmBaseUrl: process.env.LLM_BASE_URL,
    llmApiKey: process.env.LLM_API_KEY,
    llmModel: process.env.LLM_MODEL,

    timezone: process.env.TIMEZONE,
    digestHourLocal: process.env.DIGEST_HOUR_LOCAL,

    chatAllowlist: parseCommaSeparated(process.env.CHAT_ALLOWLIST),
    chatBlocklist: parseCommaSeparated(process.env.CHAT_BLOCKLIST),

    dbPath: process.env.DB_PATH,
    sessionPath: process.env.SESSION_PATH,
  };

  return configSchema.parse(raw);
}

let _config: Config | null = null;

export function getConfig(): Config {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

export function getConfigSafe(): Config | null {
  try {
    return getConfig();
  } catch {
    return null;
  }
}


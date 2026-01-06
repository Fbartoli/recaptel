import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

export const parseCommaSeparated = (val: string | undefined): string[] => {
  if (!val || val.trim() === "") return [];
  return val.split(",").map((s) => s.trim()).filter(Boolean);
};

const configSchema = z.object({
  telegramApiId: z.coerce.number().int().positive(),
  telegramApiHash: z.string().min(1),

  telegramBotToken: z.string().min(1),
  telegramDigestChatId: z.string().min(1),

  llmBaseUrl: z.string().url().default("https://openrouter.ai/api/v1"),
  llmApiKey: z.string().min(1),
  llmModel: z.string().default("openrouter/auto"),

  openrouterSiteUrl: z.string().url().optional(),
  openrouterAppName: z.string().optional(),

  timezone: z.string().default("UTC"),
  digestHourLocal: z.coerce.number().int().min(0).max(23).default(9),

  chatAllowlist: z.array(z.string()).default([]),
  chatBlocklist: z.array(z.string()).default([]),

  ingestDialogLimit: z.coerce.number().int().min(1).default(500),
  ingestMessagesPerChat: z.coerce.number().int().min(1).default(500),

  dbPath: z.string().default("data/recaptel.db"),
  tdlibDataDir: z.string().default("data/tdlib"),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  const raw = {
    telegramApiId: process.env.TELEGRAM_API_ID,
    telegramApiHash: process.env.TELEGRAM_API_HASH,

    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramDigestChatId: process.env.TELEGRAM_DIGEST_CHAT_ID,

    llmBaseUrl: process.env.LLM_BASE_URL,
    llmApiKey: process.env.LLM_API_KEY,
    llmModel: process.env.LLM_MODEL,

    openrouterSiteUrl: process.env.OPENROUTER_SITE_URL || undefined,
    openrouterAppName: process.env.OPENROUTER_APP_NAME || undefined,

    timezone: process.env.TIMEZONE,
    digestHourLocal: process.env.DIGEST_HOUR_LOCAL,

    chatAllowlist: parseCommaSeparated(process.env.CHAT_ALLOWLIST),
    chatBlocklist: parseCommaSeparated(process.env.CHAT_BLOCKLIST),

    ingestDialogLimit: process.env.INGEST_DIALOG_LIMIT,
    ingestMessagesPerChat: process.env.INGEST_MESSAGES_PER_CHAT,

    dbPath: process.env.DB_PATH,
    tdlibDataDir: process.env.TDLIB_DATA_DIR,
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



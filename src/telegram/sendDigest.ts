import type { Config } from "../config.js";
import { fetchWithRetry } from "../utils/fetchRetry.js";

async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  parseMode?: "Markdown" | "HTML"
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
  };
  if (parseMode) {
    body.parse_mode = parseMode;
  }

  const response = await fetchWithRetry(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    { timeoutMs: 30000, maxRetries: 3 }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Telegram API error: ${JSON.stringify(errorData)}`);
  }
}

export function splitMessage(text: string, maxLength: number = 4000): string[] {
  if (text.length <= maxLength) return [text];

  const parts: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      parts.push(remaining);
      break;
    }

    let splitIndex = remaining.lastIndexOf("\n\n", maxLength);
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = remaining.lastIndexOf("\n", maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = remaining.lastIndexOf(" ", maxLength);
    }
    if (splitIndex === -1) {
      splitIndex = maxLength;
    }

    parts.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).trimStart();
  }

  return parts;
}

async function sendWithFallback(botToken: string, chatId: string, text: string): Promise<void> {
  try {
    await sendTelegramMessage(botToken, chatId, text, "Markdown");
  } catch {
    try {
      await sendTelegramMessage(botToken, chatId, text, "HTML");
    } catch {
      await sendTelegramMessage(botToken, chatId, text);
    }
  }
}

export async function sendDigest(config: Config, digestText: string): Promise<void> {
  const parts = splitMessage(digestText);

  for (let i = 0; i < parts.length; i++) {
    const part = parts.length > 1 ? `(${i + 1}/${parts.length})\n\n${parts[i]}` : parts[i];

    await sendWithFallback(config.telegramBotToken, config.telegramDigestChatId, part);

    if (i < parts.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

export async function sendTestMessage(config: Config): Promise<void> {
  const testMessage = `🧪 *RecapTel Test*\n\nIf you see this, your bot configuration is working correctly!\n\n_Sent at: ${new Date().toISOString()}_`;

  await sendTelegramMessage(config.telegramBotToken, config.telegramDigestChatId, testMessage);
}



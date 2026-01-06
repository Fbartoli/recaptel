import type { Config } from "../config.js";

async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  parseMode: "Markdown" | "HTML" = "Markdown"
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Telegram API error: ${JSON.stringify(errorData)}`);
  }
}

function splitMessage(text: string, maxLength: number = 4000): string[] {
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

export async function sendDigest(config: Config, digestText: string): Promise<void> {
  const parts = splitMessage(digestText);

  for (let i = 0; i < parts.length; i++) {
    const part = parts.length > 1 ? `(${i + 1}/${parts.length})\n\n${parts[i]}` : parts[i];

    try {
      await sendTelegramMessage(config.telegramBotToken, config.telegramDigestChatId, part);
    } catch {
      await sendTelegramMessage(config.telegramBotToken, config.telegramDigestChatId, part, "HTML");
    }

    if (i < parts.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

export async function sendTestMessage(config: Config): Promise<void> {
  const testMessage = `🧪 *RecapTel Test*\n\nIf you see this, your bot configuration is working correctly!\n\n_Sent at: ${new Date().toISOString()}_`;

  await sendTelegramMessage(config.telegramBotToken, config.telegramDigestChatId, testMessage);
}


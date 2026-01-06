import { DateTime } from "luxon";
import type { Config } from "../config.js";
import { initDb } from "../db/schema.js";
import { getMessagesInRange, saveDigest } from "../db/queries.js";
import { chatCompletion } from "../llm/client.js";

export function getDigestTimeRange(config: Config): { start: number; end: number; dateStr: string } {
  const nowInZone = DateTime.now().setZone(config.timezone);
  const todayMidnight = nowInZone.startOf("day");
  const yesterdayMidnight = todayMidnight.minus({ days: 1 });

  const start = Math.floor(yesterdayMidnight.toSeconds());
  const end = Math.floor(todayMidnight.toSeconds());
  const dateStr = yesterdayMidnight.toFormat("yyyy-MM-dd");

  return { start, end, dateStr };
}

export interface GroupedMessages {
  [chatId: string]: {
    chatTitle: string;
    messages: {
      sender: string;
      text: string;
      time: string;
    }[];
  };
}

export function groupMessagesByChat(
  messages: Awaited<ReturnType<typeof getMessagesInRange>>,
  timezone: string = "UTC"
): GroupedMessages {
  const grouped: GroupedMessages = {};

  for (const msg of messages) {
    const chatId = msg.chat_id;
    const chatTitle = msg.chat_title || msg.chat_id;

    if (!grouped[chatId]) {
      grouped[chatId] = { chatTitle, messages: [] };
    }

    const time = DateTime.fromSeconds(msg.date, { zone: timezone }).toFormat("HH:mm");

    grouped[chatId].messages.push({
      sender: msg.sender_name || "Unknown",
      text: msg.text || (msg.has_media ? `[${msg.media_type || "media"}]` : "[empty]"),
      time,
    });
  }

  return grouped;
}

export function buildPromptContent(grouped: GroupedMessages, dateStr: string): string {
  let content = `Here are my Telegram messages from ${dateStr}. Please provide:\n`;
  content += `1. A brief summary of each conversation/chat\n`;
  content += `2. Any action items or follow-ups I should do\n`;
  content += `3. Important information I shouldn't miss\n\n`;
  content += `---\n\n`;

  for (const [, data] of Object.entries(grouped)) {
    content += `## ${data.chatTitle}\n`;
    for (const msg of data.messages) {
      const textPreview = msg.text.length > 500 ? msg.text.slice(0, 500) + "..." : msg.text;
      content += `[${msg.time}] ${msg.sender}: ${textPreview}\n`;
    }
    content += `\n`;
  }

  return content;
}

const SYSTEM_PROMPT = `You are a helpful assistant that creates daily digests of Telegram messages. 

Your task is to:
1. Summarize each conversation concisely
2. Identify any action items, questions directed at the user, or things requiring follow-up
3. Highlight important information (dates, deadlines, links, decisions)

Format your response as a clear, scannable digest with sections for:
- Summary (bullet points per chat)
- Action Items / Follow-ups (if any)
- Important Notes (if any)

Be concise but don't miss important details. Use markdown formatting.`;

export async function runDigest(config: Config, userId: string = "default"): Promise<string> {
  const db = initDb(config.dbPath);
  try {
    const { start, end, dateStr } = getDigestTimeRange(config);

    console.log(`Generating digest for ${dateStr} (user: ${userId})...`);
    console.log(`Time range: ${new Date(start * 1000).toISOString()} to ${new Date(end * 1000).toISOString()}`);

    const messages = getMessagesInRange(db, userId, start, end);

    if (messages.length === 0) {
      const noMessagesDigest = `# Daily Digest for ${dateStr}\n\nNo messages received during this period.`;
      saveDigest(db, {
        user_id: userId,
        digest_date: dateStr,
        content: noMessagesDigest,
        message_count: 0,
        sent_at: null,
      });
      return noMessagesDigest;
    }

    console.log(`Found ${messages.length} messages to summarize...`);

    const grouped = groupMessagesByChat(messages, config.timezone);
    const promptContent = buildPromptContent(grouped, dateStr);

    const digestContent = await chatCompletion(config, [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: promptContent },
    ]);

    const fullDigest = `# Daily Digest for ${dateStr}\n\n${digestContent}`;

    saveDigest(db, {
      user_id: userId,
      digest_date: dateStr,
      content: fullDigest,
      message_count: messages.length,
      sent_at: null,
    });

    return fullDigest;
  } finally {
    db.close();
  }
}

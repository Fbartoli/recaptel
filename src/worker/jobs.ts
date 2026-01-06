import type Database from "better-sqlite3";
import { DateTime } from "luxon";
import type { TdlibManager } from "./tdlibManager.js";
import { fetchWithRetry } from "../utils/fetchRetry.js";
import { escapeMarkdownV2 } from "../telegram/sendDigest.js";

interface UserSettings {
  id: string;
  timezone: string;
  digestHourLocal: number;
  telegramBotToken: string | null;
  telegramChatId: string | null;
}

interface SchedulerConfig {
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
}

export async function runIngestForUser(
  userId: string,
  db: Database.Database,
  tdlibManager: TdlibManager
): Promise<void> {
  console.log(`[Ingest] Starting for user ${userId}...`);

  const managed = tdlibManager.getClient(userId);
  if (!managed) {
    throw new Error(`No TDLib client for user ${userId}`);
  }

  const chatsResult = await managed.client.invoke({
    _: "getChats",
    chat_list: { _: "chatListMain" },
    limit: 100,
  });

  const chatIds = (chatsResult.chat_ids ?? []) as number[];
  let totalNewMessages = 0;

  for (const chatId of chatIds) {
    const chatIdStr = String(chatId);

    const chatInfo = await managed.client.invoke({
      _: "getChat",
      chat_id: chatId,
    });

    const title = chatInfo.title ?? "Unknown";
    const type = getChatType(chatInfo.type?._);

    upsertChat(db, userId, chatIdStr, title, type);

    const cursor = getCursor(db, userId, chatIdStr) ?? 0;
    let fromMessageId = 0;
    let newCount = 0;
    let maxMessageId = cursor;

    const messagesResult = await managed.client.invoke({
      _: "getChatHistory",
      chat_id: chatId,
      from_message_id: fromMessageId,
      offset: 0,
      limit: 100,
      only_local: false,
    });

    const messages = (messagesResult.messages ?? []) as any[];

    for (const msg of messages) {
      if (msg.id <= cursor) continue;

      const senderId = extractSenderId(msg.sender_id);
      const text = extractMessageText(msg.content);
      const { hasMedia, mediaType } = extractMediaType(msg.content);

      const inserted = insertMessage(db, {
        userId,
        chatId: chatIdStr,
        telegramMessageId: msg.id,
        senderId,
        senderName: senderId,
        text,
        hasMedia,
        mediaType,
        date: msg.date,
      });

      if (inserted) newCount++;
      if (msg.id > maxMessageId) maxMessageId = msg.id;
    }

    if (maxMessageId > cursor) {
      setCursor(db, userId, chatIdStr, maxMessageId);
    }

    if (newCount > 0) {
      console.log(`[Ingest] [${type}] ${title}: +${newCount} new messages`);
      totalNewMessages += newCount;
    }
  }

  console.log(`[Ingest] Complete for ${userId}. ${totalNewMessages} new messages.`);
}

export async function runDigestForUser(
  user: UserSettings,
  db: Database.Database,
  config: SchedulerConfig
): Promise<void> {
  const { start, end, dateStr } = getDigestTimeRange(user.timezone);

  console.log(`[Digest] Generating for ${user.id}, date ${dateStr}...`);

  const messages = getMessagesInRange(db, user.id, start, end);

  if (messages.length === 0) {
    console.log(`[Digest] No messages for ${user.id} on ${dateStr}`);
    return;
  }

  console.log(`[Digest] Found ${messages.length} messages to summarize...`);

  const grouped = groupMessagesByChat(messages, user.timezone);
  const promptContent = buildPromptContent(grouped, dateStr);

  const digestContent = await chatCompletion(config, promptContent);
  const fullDigest = `# Daily Digest for ${dateStr}\n\n${digestContent}`;

  saveDigest(db, user.id, dateStr, fullDigest, messages.length);

  if (user.telegramBotToken && user.telegramChatId) {
    await sendDigestToUser(user.telegramBotToken, user.telegramChatId, fullDigest);
  }
}

function getChatType(chatType: string): string {
  switch (chatType) {
    case "chatTypePrivate": return "user";
    case "chatTypeBasicGroup": return "group";
    case "chatTypeSupergroup": return "supergroup";
    case "chatTypeSecret": return "secret";
    default: return "unknown";
  }
}

function extractSenderId(sender: any): string | null {
  if (!sender) return null;
  if (sender._ === "messageSenderUser") return `user_${sender.user_id}`;
  if (sender._ === "messageSenderChat") return `chat_${sender.chat_id}`;
  return null;
}

function extractMessageText(content: any): string | null {
  if (!content) return null;
  if (content._ === "messageText") return content.text?.text ?? null;
  return null;
}

function extractMediaType(content: any): { hasMedia: boolean; mediaType: string | null } {
  if (!content) return { hasMedia: false, mediaType: null };
  switch (content._) {
    case "messagePhoto": return { hasMedia: true, mediaType: "photo" };
    case "messageVideo": return { hasMedia: true, mediaType: "video" };
    case "messageDocument": return { hasMedia: true, mediaType: "document" };
    case "messageAudio": return { hasMedia: true, mediaType: "audio" };
    case "messageVoiceNote": return { hasMedia: true, mediaType: "voice" };
    case "messageVideoNote": return { hasMedia: true, mediaType: "video_note" };
    case "messageSticker": return { hasMedia: true, mediaType: "sticker" };
    case "messageAnimation": return { hasMedia: true, mediaType: "animation" };
    case "messageText": return { hasMedia: false, mediaType: null };
    default: return { hasMedia: true, mediaType: "other" };
  }
}

function upsertChat(db: Database.Database, userId: string, telegramChatId: string, title: string, type: string): void {
  const stmt = db.prepare(`
    INSERT INTO chats (id, user_id, telegram_chat_id, title, type, updated_at)
    VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, unixepoch())
    ON CONFLICT(user_id, telegram_chat_id) DO UPDATE SET
      title = excluded.title,
      type = excluded.type,
      updated_at = unixepoch()
  `);
  stmt.run(userId, telegramChatId, title, type);
}

function getChatIdFromDb(db: Database.Database, userId: string, telegramChatId: string): string | null {
  const stmt = db.prepare("SELECT id FROM chats WHERE user_id = ? AND telegram_chat_id = ?");
  const row = stmt.get(userId, telegramChatId) as { id: string } | undefined;
  return row?.id ?? null;
}

function insertMessage(
  db: Database.Database,
  msg: {
    userId: string;
    chatId: string;
    telegramMessageId: number;
    senderId: string | null;
    senderName: string | null;
    text: string | null;
    hasMedia: boolean;
    mediaType: string | null;
    date: number;
  }
): boolean {
  const chatDbId = getChatIdFromDb(db, msg.userId, msg.chatId);
  if (!chatDbId) return false;

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO messages
    (id, user_id, chat_id, telegram_message_id, sender_id, sender_name, text, has_media, media_type, date, created_at)
    VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
  `);
  const result = stmt.run(
    msg.userId,
    chatDbId,
    msg.telegramMessageId,
    msg.senderId,
    msg.senderName,
    msg.text,
    msg.hasMedia ? 1 : 0,
    msg.mediaType,
    msg.date
  );
  return result.changes > 0;
}

function getCursor(db: Database.Database, userId: string, telegramChatId: string): number | null {
  const chatDbId = getChatIdFromDb(db, userId, telegramChatId);
  if (!chatDbId) return null;

  const stmt = db.prepare("SELECT last_message_id FROM cursors WHERE user_id = ? AND chat_id = ?");
  const row = stmt.get(userId, chatDbId) as { last_message_id: number } | undefined;
  return row?.last_message_id ?? null;
}

function setCursor(db: Database.Database, userId: string, telegramChatId: string, lastMessageId: number): void {
  const chatDbId = getChatIdFromDb(db, userId, telegramChatId);
  if (!chatDbId) return;

  const stmt = db.prepare(`
    INSERT INTO cursors (id, user_id, chat_id, last_message_id, updated_at)
    VALUES (lower(hex(randomblob(16))), ?, ?, ?, unixepoch())
    ON CONFLICT(user_id, chat_id) DO UPDATE SET
      last_message_id = excluded.last_message_id,
      updated_at = unixepoch()
  `);
  stmt.run(userId, chatDbId, lastMessageId);
}

function getDigestTimeRange(timezone: string): { start: number; end: number; dateStr: string } {
  const nowInZone = DateTime.now().setZone(timezone);
  const todayMidnight = nowInZone.startOf("day");
  const yesterdayMidnight = todayMidnight.minus({ days: 1 });

  return {
    start: Math.floor(yesterdayMidnight.toSeconds()),
    end: Math.floor(todayMidnight.toSeconds()),
    dateStr: yesterdayMidnight.toFormat("yyyy-MM-dd"),
  };
}

interface MessageRow {
  text: string | null;
  sender_name: string | null;
  has_media: number;
  media_type: string | null;
  date: number;
  chat_title: string | null;
  chat_id: string;
}

function getMessagesInRange(db: Database.Database, userId: string, start: number, end: number): MessageRow[] {
  const stmt = db.prepare(`
    SELECT m.text, m.sender_name, m.has_media, m.media_type, m.date, c.title as chat_title, c.id as chat_id
    FROM messages m
    JOIN chats c ON m.chat_id = c.id
    WHERE m.user_id = ? AND m.date >= ? AND m.date < ?
    ORDER BY m.date ASC
  `);
  return stmt.all(userId, start, end) as MessageRow[];
}

interface GroupedMessages {
  [chatId: string]: {
    chatTitle: string;
    messages: { sender: string; text: string; time: string }[];
  };
}

function groupMessagesByChat(messages: MessageRow[], timezone: string): GroupedMessages {
  const grouped: GroupedMessages = {};

  for (const msg of messages) {
    const chatId = msg.chat_id;
    const chatTitle = msg.chat_title || chatId;

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

function buildPromptContent(grouped: GroupedMessages, dateStr: string): string {
  let content = `Here are my Telegram messages from ${dateStr}. Please provide:\n`;
  content += `1. A brief summary of each conversation/chat\n`;
  content += `2. Any action items or follow-ups I should do\n`;
  content += `3. Important information I shouldn't miss\n\n---\n\n`;

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

async function chatCompletion(config: SchedulerConfig, userContent: string): Promise<string> {
  const url = `${config.llmBaseUrl}/chat/completions`;

  const response = await fetchWithRetry(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.llmApiKey}`,
      },
      body: JSON.stringify({
        model: config.llmModel,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    },
    { timeoutMs: 120000, maxRetries: 2 }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

function saveDigest(db: Database.Database, userId: string, dateStr: string, content: string, messageCount: number): void {
  const stmt = db.prepare(`
    INSERT INTO digests (id, user_id, digest_date, content, message_count, created_at, sent_at)
    VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, unixepoch(), unixepoch())
    ON CONFLICT(user_id, digest_date) DO UPDATE SET
      content = excluded.content,
      message_count = excluded.message_count,
      sent_at = unixepoch()
  `);
  stmt.run(userId, dateStr, content, messageCount);
}

async function sendDigestToUser(botToken: string, chatId: string, digestText: string): Promise<void> {
  const parts = splitMessage(digestText);

  for (let i = 0; i < parts.length; i++) {
    const part = parts.length > 1 ? `(${i + 1}/${parts.length})\n\n${parts[i]}` : parts[i];
    const escapedPart = escapeMarkdownV2(part);

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    try {
      const response = await fetchWithRetry(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: escapedPart,
            parse_mode: "MarkdownV2",
          }),
        },
        { timeoutMs: 30000, maxRetries: 3 }
      );

      if (!response.ok) {
        const response2 = await fetchWithRetry(
          url,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: part,
            }),
          },
          { timeoutMs: 30000, maxRetries: 3 }
        );

        if (!response2.ok) {
          throw new Error(`Telegram API error: ${response2.status}`);
        }
      }
    } catch (err) {
      console.error(`[Digest] Failed to send part ${i + 1}:`, err);
      throw err;
    }

    if (i < parts.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
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


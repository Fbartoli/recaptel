import type { Config } from "../../config.js";
import { initDb } from "../../db/schema.js";
import { upsertChat, insertMessage, getCursor, setCursor, upsertUser } from "../../db/queries.js";
import { getOrCreateClient, type TdlibClientWrapper } from "./client.js";

interface IngestOptions {
  dryRun?: boolean;
}

function shouldIncludeChat(chatId: string, config: Config): boolean {
  if (config.chatBlocklist.length > 0 && config.chatBlocklist.includes(chatId)) {
    return false;
  }
  if (config.chatAllowlist.length > 0) {
    return config.chatAllowlist.includes(chatId);
  }
  return true;
}

function getChatType(chatType: string): string {
  switch (chatType) {
    case "chatTypePrivate":
      return "user";
    case "chatTypeBasicGroup":
      return "group";
    case "chatTypeSupergroup":
      return "supergroup";
    case "chatTypeSecret":
      return "secret";
    default:
      return "unknown";
  }
}

async function fetchChats(wrapper: TdlibClientWrapper, limit: number): Promise<any[]> {
  const result = await wrapper.client.invoke({
    _: "getChats",
    chat_list: { _: "chatListMain" },
    limit,
  });
  return result.chat_ids ?? [];
}

async function getChatInfo(wrapper: TdlibClientWrapper, chatId: number): Promise<{ title: string; type: string }> {
  const chat = await wrapper.client.invoke({
    _: "getChat",
    chat_id: chatId,
  });
  return {
    title: chat.title ?? "Unknown",
    type: getChatType(chat.type?._),
  };
}

async function fetchMessages(
  wrapper: TdlibClientWrapper,
  chatId: number,
  fromMessageId: number,
  limit: number
): Promise<any[]> {
  const result = await wrapper.client.invoke({
    _: "getChatHistory",
    chat_id: chatId,
    from_message_id: fromMessageId,
    offset: 0,
    limit,
    only_local: false,
  });
  return result.messages ?? [];
}

function extractSenderName(sender: any): string | null {
  if (!sender) return null;
  if (sender._ === "messageSenderUser") {
    return `user_${sender.user_id}`;
  }
  if (sender._ === "messageSenderChat") {
    return `chat_${sender.chat_id}`;
  }
  return null;
}

function extractMessageText(content: any): string | null {
  if (!content) return null;
  if (content._ === "messageText") {
    return content.text?.text ?? null;
  }
  return null;
}

function extractMediaType(content: any): { hasMedia: boolean; mediaType: string | null } {
  if (!content) return { hasMedia: false, mediaType: null };
  switch (content._) {
    case "messagePhoto":
      return { hasMedia: true, mediaType: "photo" };
    case "messageVideo":
      return { hasMedia: true, mediaType: "video" };
    case "messageDocument":
      return { hasMedia: true, mediaType: "document" };
    case "messageAudio":
      return { hasMedia: true, mediaType: "audio" };
    case "messageVoiceNote":
      return { hasMedia: true, mediaType: "voice" };
    case "messageVideoNote":
      return { hasMedia: true, mediaType: "video_note" };
    case "messageSticker":
      return { hasMedia: true, mediaType: "sticker" };
    case "messageAnimation":
      return { hasMedia: true, mediaType: "animation" };
    case "messageText":
      return { hasMedia: false, mediaType: null };
    default:
      return { hasMedia: true, mediaType: "other" };
  }
}

async function waitForAuthReady(wrapper: TdlibClientWrapper, timeoutMs: number = 10000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await wrapper.getAuthState();
    if (state === "authorizationStateReady") return true;
    if (state === "authorizationStateWaitPhoneNumber") return false;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

export async function runIngest(config: Config, userId: string, options: IngestOptions = {}): Promise<void> {
  const { dryRun = false } = options;

  console.log(`Connecting to Telegram (TDLib) for user: ${userId}...`);
  const wrapper = await getOrCreateClient(config, userId);

  const isReady = await waitForAuthReady(wrapper);
  if (!isReady) {
    const authState = await wrapper.getAuthState();
    throw new Error(`User ${userId} is not logged in. Current state: ${authState}. Run 'recaptel login' first.`);
  }

  const db = dryRun ? null : initDb(config.dbPath);

  try {
    if (db) {
      upsertUser(db, { id: userId, phone: null, display_name: null });
    }

    console.log("Fetching chats...\n");

    const chatIds = await fetchChats(wrapper, config.ingestDialogLimit);

    let totalNewMessages = 0;

    for (const chatId of chatIds) {
      const chatIdStr = String(chatId);

      if (!shouldIncludeChat(chatIdStr, config)) {
        continue;
      }

      const { title, type } = await getChatInfo(wrapper, chatId);

      if (dryRun) {
        console.log(`[${type}] ${title} (${chatIdStr})`);
        continue;
      }

      upsertChat(db!, { user_id: userId, chat_id: chatIdStr, title, type });

      const cursor = getCursor(db!, userId, chatIdStr) ?? 0;

      let fromMessageId = 0;
      let newCount = 0;
      let maxMessageId = cursor;
      let fetchedTotal = 0;

      while (fetchedTotal < config.ingestMessagesPerChat) {
        const batchSize = Math.min(100, config.ingestMessagesPerChat - fetchedTotal);
        const messages = await fetchMessages(wrapper, chatId, fromMessageId, batchSize);

        if (messages.length === 0) break;

        let reachedCursor = false;
        for (const msg of messages) {
          if (msg.id <= cursor) {
            reachedCursor = true;
            continue;
          }

          const senderId = extractSenderName(msg.sender_id);
          const text = extractMessageText(msg.content);
          const { hasMedia, mediaType } = extractMediaType(msg.content);

          const inserted = insertMessage(db!, {
            user_id: userId,
            chat_id: chatIdStr,
            message_id: msg.id,
            sender_id: senderId,
            sender_name: senderId,
            text,
            has_media: hasMedia ? 1 : 0,
            media_type: mediaType,
            date: msg.date,
          });

          if (inserted) newCount++;
          if (msg.id > maxMessageId) maxMessageId = msg.id;
        }

        if (reachedCursor) break;

        fromMessageId = messages[messages.length - 1].id;
        fetchedTotal += messages.length;

        if (messages.length < batchSize) break;
      }

      if (maxMessageId > cursor) {
        setCursor(db!, userId, chatIdStr, maxMessageId);
      }

      if (newCount > 0) {
        console.log(`[${type}] ${title}: +${newCount} new messages`);
        totalNewMessages += newCount;
      }
    }

    if (dryRun) {
      console.log(`\nDry run complete. Found ${chatIds.length} chats.`);
    } else {
      console.log(`\nIngest complete. ${totalNewMessages} new messages stored.`);
    }
  } finally {
    if (db) {
      db.close();
    }
  }
}


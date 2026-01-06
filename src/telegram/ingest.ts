import { Api } from "telegram";
import type { TelegramClient } from "telegram";
import type { Dialog } from "telegram/tl/custom/dialog.js";
import type { Entity } from "telegram/define.js";
import type { Config } from "../config.js";
import { getConnectedClient } from "./gramjsClient.js";
import { initDb } from "../db/schema.js";
import { upsertChat, insertMessage, getCursor, setCursor } from "../db/queries.js";

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

function getChatId(dialog: Dialog): string {
  const entity = dialog.entity;
  if (!entity) return `unknown_${Date.now()}`;

  if (entity instanceof Api.User) return `user_${entity.id}`;
  if (entity instanceof Api.Chat) return `chat_${entity.id}`;
  if (entity instanceof Api.Channel) return `channel_${entity.id}`;
  return `unknown_${Date.now()}`;
}

function getChatInfo(entity: Entity | undefined): { title: string; type: string } {
  if (!entity) return { title: "Unknown", type: "unknown" };

  if (entity instanceof Api.User) {
    const name = [entity.firstName, entity.lastName].filter(Boolean).join(" ") || entity.username || "User";
    return { title: name, type: "user" };
  }
  if (entity instanceof Api.Chat) {
    return { title: entity.title, type: "group" };
  }
  if (entity instanceof Api.Channel) {
    return { title: entity.title, type: entity.megagroup ? "supergroup" : "channel" };
  }
  return { title: "Unknown", type: "unknown" };
}

async function fetchMessages(
  client: TelegramClient,
  entity: Entity,
  minId: number
): Promise<Api.Message[]> {
  const messages: Api.Message[] = [];
  const limit = 100;

  for await (const message of client.iterMessages(entity, { limit, minId })) {
    if (message instanceof Api.Message) {
      messages.push(message);
    }
  }

  return messages;
}

export async function runIngest(config: Config, options: IngestOptions = {}): Promise<void> {
  const { dryRun = false } = options;

  console.log("Connecting to Telegram...");
  const client = await getConnectedClient(config);

  const db = dryRun ? null : initDb(config.dbPath);

  console.log("Fetching dialogs...\n");

  const dialogs = await client.getDialogs({ limit: 100 });

  let totalNewMessages = 0;

  for (const dialog of dialogs) {
    const entity = dialog.entity;
    if (!entity) continue;

    const chatId = getChatId(dialog);

    if (!shouldIncludeChat(chatId, config)) {
      continue;
    }

    const { title, type } = getChatInfo(entity);

    if (dryRun) {
      console.log(`[${type}] ${title} (${chatId}) - unread: ${dialog.unreadCount}`);
      continue;
    }

    upsertChat(db!, { chat_id: chatId, title, type });

    const cursor = getCursor(db!, chatId) ?? 0;
    const messages = await fetchMessages(client, entity, cursor);

    let newCount = 0;
    let maxMessageId = cursor;

    for (const msg of messages) {
      const senderId = msg.senderId?.toString() ?? null;
      let senderName: string | null = null;

      if (msg.sender) {
        if (msg.sender instanceof Api.User) {
          senderName = [msg.sender.firstName, msg.sender.lastName].filter(Boolean).join(" ") || msg.sender.username || null;
        } else if ("title" in msg.sender) {
          senderName = (msg.sender as { title: string }).title;
        }
      }

      const hasMedia = msg.media ? 1 : 0;
      let mediaType: string | null = null;
      if (msg.media) {
        if (msg.media instanceof Api.MessageMediaPhoto) mediaType = "photo";
        else if (msg.media instanceof Api.MessageMediaDocument) mediaType = "document";
        else if (msg.media instanceof Api.MessageMediaWebPage) mediaType = "webpage";
        else mediaType = "other";
      }

      const inserted = insertMessage(db!, {
        chat_id: chatId,
        message_id: msg.id,
        sender_id: senderId,
        sender_name: senderName,
        text: msg.message ?? null,
        has_media: hasMedia,
        media_type: mediaType,
        date: msg.date,
      });

      if (inserted) newCount++;
      if (msg.id > maxMessageId) maxMessageId = msg.id;
    }

    if (maxMessageId > cursor) {
      setCursor(db!, chatId, maxMessageId);
    }

    if (newCount > 0) {
      console.log(`[${type}] ${title}: +${newCount} new messages`);
      totalNewMessages += newCount;
    }
  }

  await client.disconnect();

  if (dryRun) {
    console.log(`\nDry run complete. Found ${dialogs.length} dialogs.`);
  } else {
    console.log(`\nIngest complete. ${totalNewMessages} new messages stored.`);
  }
}

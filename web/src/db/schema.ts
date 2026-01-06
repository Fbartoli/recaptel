import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
import type { AdapterAccountType } from "next-auth/adapters";

// NextAuth required tables
export type TelegramAuthState = "disconnected" | "awaiting_phone" | "awaiting_code" | "awaiting_password" | "ready";

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: integer("email_verified", { mode: "timestamp" }),
  image: text("image"),
  timezone: text("timezone").default("UTC"),
  digestHourLocal: integer("digest_hour_local").default(9),
  telegramBotToken: text("telegram_bot_token"),
  telegramChatId: text("telegram_chat_id"),
  telegramConnectedAt: integer("telegram_connected_at", { mode: "timestamp" }),
  telegramAuthState: text("telegram_auth_state").$type<TelegramAuthState>().default("disconnected"),
  lastIngestAt: integer("last_ingest_at", { mode: "timestamp" }),
  lastDigestAt: integer("last_digest_at", { mode: "timestamp" }),
  subscriptionTier: text("subscription_tier").default("free"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const accounts = sqliteTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = sqliteTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp" }).notNull(),
  },
  (verificationToken) => [
    primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  ]
);

// RecapTel domain tables
export const chats = sqliteTable(
  "chats",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    telegramChatId: text("telegram_chat_id").notNull(),
    title: text("title"),
    type: text("type"),
    isAllowed: integer("is_allowed", { mode: "boolean" }).default(true),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (chat) => [
    uniqueIndex("chats_user_telegram_idx").on(chat.userId, chat.telegramChatId),
    index("chats_user_idx").on(chat.userId),
  ]
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    telegramMessageId: integer("telegram_message_id").notNull(),
    senderId: text("sender_id"),
    senderName: text("sender_name"),
    text: text("text"),
    hasMedia: integer("has_media", { mode: "boolean" }).default(false),
    mediaType: text("media_type"),
    date: integer("date", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (message) => [
    uniqueIndex("messages_user_chat_msg_idx").on(
      message.userId,
      message.chatId,
      message.telegramMessageId
    ),
    index("messages_user_date_idx").on(message.userId, message.date),
  ]
);

export const cursors = sqliteTable(
  "cursors",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    lastMessageId: integer("last_message_id").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  },
  (cursor) => [
    uniqueIndex("cursors_user_chat_idx").on(cursor.userId, cursor.chatId),
  ]
);

export const digests = sqliteTable(
  "digests",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    digestDate: text("digest_date").notNull(),
    content: text("content").notNull(),
    messageCount: integer("message_count"),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
    sentAt: integer("sent_at", { mode: "timestamp" }),
  },
  (digest) => [
    uniqueIndex("digests_user_date_idx").on(digest.userId, digest.digestDate),
    index("digests_user_idx").on(digest.userId),
  ]
);

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Chat = typeof chats.$inferSelect;
export type NewChat = typeof chats.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Digest = typeof digests.$inferSelect;
export type NewDigest = typeof digests.$inferInsert;

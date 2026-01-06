import type Database from "better-sqlite3";

export interface User {
  id: string;
  phone: string | null;
  display_name: string | null;
  created_at?: number;
  updated_at?: number;
}

export interface Chat {
  user_id: string;
  chat_id: string;
  title: string | null;
  type: string | null;
  updated_at: number | null;
}

export interface Message {
  id?: number;
  user_id: string;
  chat_id: string;
  message_id: number;
  sender_id: string | null;
  sender_name: string | null;
  text: string | null;
  has_media: number;
  media_type: string | null;
  date: number;
}

export interface Cursor {
  user_id: string;
  chat_id: string;
  last_message_id: number;
}

export interface Digest {
  id?: number;
  user_id: string;
  digest_date: string;
  content: string;
  message_count: number | null;
  created_at?: number;
  sent_at: number | null;
}

export function upsertUser(db: Database.Database, user: Omit<User, "created_at" | "updated_at">): void {
  const stmt = db.prepare(`
    INSERT INTO users (id, phone, display_name, created_at, updated_at)
    VALUES (?, ?, ?, unixepoch(), unixepoch())
    ON CONFLICT(id) DO UPDATE SET
      phone = COALESCE(excluded.phone, users.phone),
      display_name = COALESCE(excluded.display_name, users.display_name),
      updated_at = unixepoch()
  `);
  stmt.run(user.id, user.phone, user.display_name);
}

export function getUser(db: Database.Database, userId: string): User | null {
  const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
  return (stmt.get(userId) as User) ?? null;
}

export function upsertChat(db: Database.Database, chat: Omit<Chat, "updated_at">): void {
  const stmt = db.prepare(`
    INSERT INTO chats (user_id, chat_id, title, type, updated_at)
    VALUES (?, ?, ?, ?, unixepoch())
    ON CONFLICT(user_id, chat_id) DO UPDATE SET
      title = excluded.title,
      type = excluded.type,
      updated_at = unixepoch()
  `);
  stmt.run(chat.user_id, chat.chat_id, chat.title, chat.type);
}

export function insertMessage(db: Database.Database, msg: Omit<Message, "id">): boolean {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO messages
    (user_id, chat_id, message_id, sender_id, sender_name, text, has_media, media_type, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    msg.user_id,
    msg.chat_id,
    msg.message_id,
    msg.sender_id,
    msg.sender_name,
    msg.text,
    msg.has_media,
    msg.media_type,
    msg.date
  );
  return result.changes > 0;
}

export function getCursor(db: Database.Database, userId: string, chatId: string): number | null {
  const stmt = db.prepare("SELECT last_message_id FROM cursors WHERE user_id = ? AND chat_id = ?");
  const row = stmt.get(userId, chatId) as { last_message_id: number } | undefined;
  return row?.last_message_id ?? null;
}

export function setCursor(db: Database.Database, userId: string, chatId: string, lastMessageId: number): void {
  const stmt = db.prepare(`
    INSERT INTO cursors (user_id, chat_id, last_message_id, updated_at)
    VALUES (?, ?, ?, unixepoch())
    ON CONFLICT(user_id, chat_id) DO UPDATE SET
      last_message_id = excluded.last_message_id,
      updated_at = unixepoch()
  `);
  stmt.run(userId, chatId, lastMessageId);
}

export function getMessagesSince(db: Database.Database, userId: string, sinceTimestamp: number): (Message & { chat_title: string | null })[] {
  const stmt = db.prepare(`
    SELECT m.*, c.title as chat_title
    FROM messages m
    LEFT JOIN chats c ON m.user_id = c.user_id AND m.chat_id = c.chat_id
    WHERE m.user_id = ? AND m.date >= ?
    ORDER BY m.date ASC
  `);
  return stmt.all(userId, sinceTimestamp) as (Message & { chat_title: string | null })[];
}

export function getMessagesInRange(
  db: Database.Database,
  userId: string,
  startTimestamp: number,
  endTimestamp: number
): (Message & { chat_title: string | null })[] {
  const stmt = db.prepare(`
    SELECT m.*, c.title as chat_title
    FROM messages m
    LEFT JOIN chats c ON m.user_id = c.user_id AND m.chat_id = c.chat_id
    WHERE m.user_id = ? AND m.date >= ? AND m.date < ?
    ORDER BY m.date ASC
  `);
  return stmt.all(userId, startTimestamp, endTimestamp) as (Message & { chat_title: string | null })[];
}

export function saveDigest(db: Database.Database, digest: Omit<Digest, "id" | "created_at">): number {
  const stmt = db.prepare(`
    INSERT INTO digests (user_id, digest_date, content, message_count, sent_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, digest_date) DO UPDATE SET
      content = excluded.content,
      message_count = excluded.message_count,
      sent_at = excluded.sent_at
  `);
  const result = stmt.run(digest.user_id, digest.digest_date, digest.content, digest.message_count, digest.sent_at);
  return result.lastInsertRowid as number;
}

export function markDigestSent(db: Database.Database, digestId: number): void {
  const stmt = db.prepare("UPDATE digests SET sent_at = unixepoch() WHERE id = ?");
  stmt.run(digestId);
}

export function getLatestDigest(db: Database.Database, userId: string): Digest | null {
  const stmt = db.prepare("SELECT * FROM digests WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 1");
  return (stmt.get(userId) as Digest) ?? null;
}

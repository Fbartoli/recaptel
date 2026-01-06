import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";

export function initDb(dbPath: string): Database.Database {
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      chat_id TEXT PRIMARY KEY,
      title TEXT,
      type TEXT,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      message_id INTEGER NOT NULL,
      sender_id TEXT,
      sender_name TEXT,
      text TEXT,
      has_media INTEGER DEFAULT 0,
      media_type TEXT,
      date INTEGER NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      UNIQUE(chat_id, message_id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_date ON messages(date);
    CREATE INDEX IF NOT EXISTS idx_messages_chat_date ON messages(chat_id, date);

    CREATE TABLE IF NOT EXISTS cursors (
      chat_id TEXT PRIMARY KEY,
      last_message_id INTEGER NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS digests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      digest_date TEXT NOT NULL,
      content TEXT NOT NULL,
      message_count INTEGER,
      created_at INTEGER DEFAULT (unixepoch()),
      sent_at INTEGER
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_digests_date ON digests(digest_date);
  `);

  return db;
}


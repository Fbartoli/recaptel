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
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone TEXT,
      display_name TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS chats (
      user_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      title TEXT,
      type TEXT,
      updated_at INTEGER,
      PRIMARY KEY (user_id, chat_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      message_id INTEGER NOT NULL,
      sender_id TEXT,
      sender_name TEXT,
      text TEXT,
      has_media INTEGER DEFAULT 0,
      media_type TEXT,
      date INTEGER NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      UNIQUE(user_id, chat_id, message_id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_user_date ON messages(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_messages_user_chat_date ON messages(user_id, chat_id, date);

    CREATE TABLE IF NOT EXISTS cursors (
      user_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      last_message_id INTEGER NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (user_id, chat_id)
    );

    CREATE TABLE IF NOT EXISTS digests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      digest_date TEXT NOT NULL,
      content TEXT NOT NULL,
      message_count INTEGER,
      created_at INTEGER DEFAULT (unixepoch()),
      sent_at INTEGER
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_digests_user_date ON digests(user_id, digest_date);
  `);

  return db;
}

export function migrateToMultiUser(db: Database.Database): void {
  const hasUsersTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
    .get();

  if (hasUsersTable) {
    return;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone TEXT,
      display_name TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );

    INSERT OR IGNORE INTO users (id, display_name) VALUES ('default', 'Default User');
  `);

  const hasUserIdInChats = db
    .prepare("PRAGMA table_info(chats)")
    .all()
    .some((col) => (col as { name: string }).name === "user_id");

  if (!hasUserIdInChats) {
    db.exec(`
      ALTER TABLE chats ADD COLUMN user_id TEXT DEFAULT 'default';
      ALTER TABLE messages ADD COLUMN user_id TEXT DEFAULT 'default';
      ALTER TABLE cursors ADD COLUMN user_id TEXT DEFAULT 'default';
      ALTER TABLE digests ADD COLUMN user_id TEXT DEFAULT 'default';
    `);
  }
}

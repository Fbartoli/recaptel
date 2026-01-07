-- RecapTel Web Database Schema
-- This SQL matches the Drizzle schema in web/src/db/schema.ts
-- Use CREATE TABLE IF NOT EXISTS for idempotency

-- ============================================
-- NextAuth Tables
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT,
  email TEXT UNIQUE,
  email_verified INTEGER,
  image TEXT,
  timezone TEXT DEFAULT 'UTC',
  digest_hour_local INTEGER DEFAULT 9,
  telegram_bot_token TEXT,
  telegram_chat_id TEXT,
  telegram_connected_at INTEGER,
  telegram_auth_state TEXT DEFAULT 'disconnected',
  last_ingest_at INTEGER,
  last_digest_at INTEGER,
  subscription_tier TEXT DEFAULT 'free',
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS accounts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  PRIMARY KEY (provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  session_token TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires INTEGER NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- ============================================
-- RecapTel Domain Tables
-- ============================================

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  telegram_chat_id TEXT NOT NULL,
  title TEXT,
  type TEXT,
  is_allowed INTEGER DEFAULT 1,
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS chats_user_idx ON chats(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS chats_user_telegram_idx ON chats(user_id, telegram_chat_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  telegram_message_id INTEGER NOT NULL,
  sender_id TEXT,
  sender_name TEXT,
  text TEXT,
  has_media INTEGER DEFAULT 0,
  media_type TEXT,
  date INTEGER NOT NULL,
  created_at INTEGER
);

CREATE INDEX IF NOT EXISTS messages_user_date_idx ON messages(user_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS messages_user_chat_msg_idx ON messages(user_id, chat_id, telegram_message_id);

CREATE TABLE IF NOT EXISTS cursors (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  last_message_id INTEGER NOT NULL,
  updated_at INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS cursors_user_chat_idx ON cursors(user_id, chat_id);

CREATE TABLE IF NOT EXISTS digests (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  digest_date TEXT NOT NULL,
  content TEXT NOT NULL,
  message_count INTEGER,
  created_at INTEGER,
  sent_at INTEGER
);

CREATE INDEX IF NOT EXISTS digests_user_idx ON digests(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS digests_user_date_idx ON digests(user_id, digest_date);



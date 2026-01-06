import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { initDb } from "./schema.js";
import {
  upsertUser,
  getUser,
  upsertChat,
  insertMessage,
  getCursor,
  setCursor,
  getMessagesSince,
  getMessagesInRange,
  saveDigest,
  markDigestSent,
  getLatestDigest,
} from "./queries.js";

let db: Database.Database;
const TEST_USER = "test_user";

beforeEach(() => {
  db = initDb(":memory:");
  upsertUser(db, { id: TEST_USER, phone: null, display_name: "Test User" });
});

afterEach(() => {
  db.close();
});

describe("upsertUser", () => {
  it("inserts a new user", () => {
    upsertUser(db, { id: "user_1", phone: "+1234567890", display_name: "Alice" });

    const user = getUser(db, "user_1");
    expect(user).not.toBeNull();
    expect(user!.phone).toBe("+1234567890");
    expect(user!.display_name).toBe("Alice");
  });

  it("updates existing user", () => {
    upsertUser(db, { id: "user_1", phone: "+1111111111", display_name: "Old Name" });
    upsertUser(db, { id: "user_1", phone: "+2222222222", display_name: "New Name" });

    const user = getUser(db, "user_1");
    expect(user!.phone).toBe("+2222222222");
    expect(user!.display_name).toBe("New Name");
  });
});

describe("upsertChat", () => {
  it("inserts a new chat", () => {
    upsertChat(db, { user_id: TEST_USER, chat_id: "chat_1", title: "Test Chat", type: "group" });

    const row = db.prepare("SELECT * FROM chats WHERE user_id = ? AND chat_id = ?").get(TEST_USER, "chat_1") as {
      chat_id: string;
      title: string;
      type: string;
    };
    expect(row.title).toBe("Test Chat");
    expect(row.type).toBe("group");
  });

  it("updates existing chat", () => {
    upsertChat(db, { user_id: TEST_USER, chat_id: "chat_1", title: "Old Title", type: "group" });
    upsertChat(db, { user_id: TEST_USER, chat_id: "chat_1", title: "New Title", type: "supergroup" });

    const row = db.prepare("SELECT * FROM chats WHERE user_id = ? AND chat_id = ?").get(TEST_USER, "chat_1") as {
      title: string;
      type: string;
    };
    expect(row.title).toBe("New Title");
    expect(row.type).toBe("supergroup");
  });

  it("handles null title and type", () => {
    upsertChat(db, { user_id: TEST_USER, chat_id: "chat_1", title: null, type: null });

    const row = db.prepare("SELECT * FROM chats WHERE user_id = ? AND chat_id = ?").get(TEST_USER, "chat_1") as {
      title: string | null;
      type: string | null;
    };
    expect(row.title).toBeNull();
    expect(row.type).toBeNull();
  });
});

describe("insertMessage", () => {
  it("inserts a new message and returns true", () => {
    const result = insertMessage(db, {
      user_id: TEST_USER,
      chat_id: "chat_1",
      message_id: 1,
      sender_id: "user_1",
      sender_name: "Alice",
      text: "Hello",
      has_media: 0,
      media_type: null,
      date: 1700000000,
    });

    expect(result).toBe(true);

    const row = db
      .prepare("SELECT * FROM messages WHERE user_id = ? AND chat_id = ? AND message_id = ?")
      .get(TEST_USER, "chat_1", 1) as { text: string };
    expect(row.text).toBe("Hello");
  });

  it("returns false for duplicate message", () => {
    const msg = {
      user_id: TEST_USER,
      chat_id: "chat_1",
      message_id: 1,
      sender_id: "user_1",
      sender_name: "Alice",
      text: "Hello",
      has_media: 0,
      media_type: null,
      date: 1700000000,
    };

    insertMessage(db, msg);
    const result = insertMessage(db, msg);

    expect(result).toBe(false);
  });

  it("stores media information", () => {
    insertMessage(db, {
      user_id: TEST_USER,
      chat_id: "chat_1",
      message_id: 1,
      sender_id: "user_1",
      sender_name: "Alice",
      text: null,
      has_media: 1,
      media_type: "photo",
      date: 1700000000,
    });

    const row = db
      .prepare("SELECT * FROM messages WHERE user_id = ? AND chat_id = ? AND message_id = ?")
      .get(TEST_USER, "chat_1", 1) as { has_media: number; media_type: string };
    expect(row.has_media).toBe(1);
    expect(row.media_type).toBe("photo");
  });
});

describe("getCursor and setCursor", () => {
  it("returns null for non-existent cursor", () => {
    const result = getCursor(db, TEST_USER, "chat_1");
    expect(result).toBeNull();
  });

  it("sets and gets cursor", () => {
    setCursor(db, TEST_USER, "chat_1", 100);
    const result = getCursor(db, TEST_USER, "chat_1");
    expect(result).toBe(100);
  });

  it("updates existing cursor", () => {
    setCursor(db, TEST_USER, "chat_1", 100);
    setCursor(db, TEST_USER, "chat_1", 200);
    const result = getCursor(db, TEST_USER, "chat_1");
    expect(result).toBe(200);
  });

  it("maintains separate cursors per chat", () => {
    setCursor(db, TEST_USER, "chat_1", 100);
    setCursor(db, TEST_USER, "chat_2", 200);

    expect(getCursor(db, TEST_USER, "chat_1")).toBe(100);
    expect(getCursor(db, TEST_USER, "chat_2")).toBe(200);
  });

  it("maintains separate cursors per user", () => {
    upsertUser(db, { id: "user_2", phone: null, display_name: null });
    setCursor(db, TEST_USER, "chat_1", 100);
    setCursor(db, "user_2", "chat_1", 200);

    expect(getCursor(db, TEST_USER, "chat_1")).toBe(100);
    expect(getCursor(db, "user_2", "chat_1")).toBe(200);
  });
});

describe("getMessagesSince", () => {
  beforeEach(() => {
    upsertChat(db, { user_id: TEST_USER, chat_id: "chat_1", title: "Test Chat", type: "group" });

    insertMessage(db, {
      user_id: TEST_USER,
      chat_id: "chat_1",
      message_id: 1,
      sender_id: "user_1",
      sender_name: "Alice",
      text: "Old message",
      has_media: 0,
      media_type: null,
      date: 1700000000,
    });

    insertMessage(db, {
      user_id: TEST_USER,
      chat_id: "chat_1",
      message_id: 2,
      sender_id: "user_2",
      sender_name: "Bob",
      text: "New message",
      has_media: 0,
      media_type: null,
      date: 1700001000,
    });
  });

  it("returns messages since timestamp", () => {
    const messages = getMessagesSince(db, TEST_USER, 1700000500);
    expect(messages).toHaveLength(1);
    expect(messages[0].text).toBe("New message");
  });

  it("includes messages at exact timestamp", () => {
    const messages = getMessagesSince(db, TEST_USER, 1700000000);
    expect(messages).toHaveLength(2);
  });

  it("returns empty array when no messages after timestamp", () => {
    const messages = getMessagesSince(db, TEST_USER, 1700002000);
    expect(messages).toHaveLength(0);
  });

  it("includes chat_title in results", () => {
    const messages = getMessagesSince(db, TEST_USER, 1700000000);
    expect(messages[0].chat_title).toBe("Test Chat");
  });

  it("returns messages ordered by date ascending", () => {
    const messages = getMessagesSince(db, TEST_USER, 1700000000);
    expect(messages[0].date).toBeLessThan(messages[1].date);
  });
});

describe("getMessagesInRange", () => {
  beforeEach(() => {
    upsertChat(db, { user_id: TEST_USER, chat_id: "chat_1", title: "Test Chat", type: "group" });

    [1700000000, 1700001000, 1700002000].forEach((date, i) => {
      insertMessage(db, {
        user_id: TEST_USER,
        chat_id: "chat_1",
        message_id: i + 1,
        sender_id: "user_1",
        sender_name: "Alice",
        text: `Message ${i + 1}`,
        has_media: 0,
        media_type: null,
        date,
      });
    });
  });

  it("returns messages in range (inclusive start, exclusive end)", () => {
    const messages = getMessagesInRange(db, TEST_USER, 1700000000, 1700002000);
    expect(messages).toHaveLength(2);
    expect(messages[0].text).toBe("Message 1");
    expect(messages[1].text).toBe("Message 2");
  });

  it("returns empty array for range with no messages", () => {
    const messages = getMessagesInRange(db, TEST_USER, 1600000000, 1600001000);
    expect(messages).toHaveLength(0);
  });

  it("includes chat_title in results", () => {
    const messages = getMessagesInRange(db, TEST_USER, 1700000000, 1700003000);
    expect(messages[0].chat_title).toBe("Test Chat");
  });
});

describe("saveDigest", () => {
  it("saves a new digest", () => {
    const id = saveDigest(db, {
      user_id: TEST_USER,
      digest_date: "2024-01-15",
      content: "# Daily Digest\n\nContent here",
      message_count: 42,
      sent_at: null,
    });

    expect(id).toBeGreaterThan(0);

    const row = db.prepare("SELECT * FROM digests WHERE id = ?").get(id) as {
      user_id: string;
      digest_date: string;
      content: string;
      message_count: number;
    };
    expect(row.user_id).toBe(TEST_USER);
    expect(row.digest_date).toBe("2024-01-15");
    expect(row.content).toBe("# Daily Digest\n\nContent here");
    expect(row.message_count).toBe(42);
  });

  it("updates existing digest for same user and date", () => {
    saveDigest(db, {
      user_id: TEST_USER,
      digest_date: "2024-01-15",
      content: "Old content",
      message_count: 10,
      sent_at: null,
    });

    saveDigest(db, {
      user_id: TEST_USER,
      digest_date: "2024-01-15",
      content: "New content",
      message_count: 20,
      sent_at: null,
    });

    const rows = db.prepare("SELECT * FROM digests WHERE user_id = ? AND digest_date = ?").all(TEST_USER, "2024-01-15");
    expect(rows).toHaveLength(1);
    expect((rows[0] as { content: string }).content).toBe("New content");
  });
});

describe("markDigestSent", () => {
  it("updates sent_at timestamp", () => {
    const id = saveDigest(db, {
      user_id: TEST_USER,
      digest_date: "2024-01-15",
      content: "Digest",
      message_count: 10,
      sent_at: null,
    });

    markDigestSent(db, id);

    const row = db.prepare("SELECT sent_at FROM digests WHERE id = ?").get(id) as {
      sent_at: number | null;
    };
    expect(row.sent_at).not.toBeNull();
    expect(row.sent_at).toBeGreaterThan(0);
  });
});

describe("getLatestDigest", () => {
  it("returns null when no digests exist", () => {
    const result = getLatestDigest(db, TEST_USER);
    expect(result).toBeNull();
  });

  it("returns most recent digest by created_at", () => {
    db.prepare(
      "INSERT INTO digests (user_id, digest_date, content, message_count, created_at, sent_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(TEST_USER, "2024-01-14", "First", 10, 1700000000, null);

    db.prepare(
      "INSERT INTO digests (user_id, digest_date, content, message_count, created_at, sent_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(TEST_USER, "2024-01-15", "Second", 20, 1700000100, null);

    const result = getLatestDigest(db, TEST_USER);
    expect(result).not.toBeNull();
    expect(result!.digest_date).toBe("2024-01-15");
    expect(result!.content).toBe("Second");
  });

  it("returns digests only for the specified user", () => {
    upsertUser(db, { id: "other_user", phone: null, display_name: null });

    db.prepare(
      "INSERT INTO digests (user_id, digest_date, content, message_count, created_at, sent_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run("other_user", "2024-01-15", "Other User Digest", 10, 1700000200, null);

    db.prepare(
      "INSERT INTO digests (user_id, digest_date, content, message_count, created_at, sent_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(TEST_USER, "2024-01-14", "Test User Digest", 10, 1700000100, null);

    const result = getLatestDigest(db, TEST_USER);
    expect(result).not.toBeNull();
    expect(result!.content).toBe("Test User Digest");
  });
});

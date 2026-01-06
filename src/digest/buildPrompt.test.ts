import { describe, it, expect } from "vitest";
import {
  groupMessagesByChat,
  buildPromptContent,
  getDigestTimeRange,
  type GroupedMessages,
} from "./buildPrompt.js";
import type { Config } from "../config.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    telegramApiId: 12345,
    telegramApiHash: "abc123",
    telegramBotToken: "bot:token",
    telegramDigestChatId: "123456",
    llmBaseUrl: "https://api.openai.com/v1",
    llmApiKey: "sk-test",
    llmModel: "gpt-4o-mini",
    timezone: "UTC",
    digestHourLocal: 9,
    chatAllowlist: [],
    chatBlocklist: [],
    ingestDialogLimit: 500,
    ingestMessagesPerChat: 500,
    dbPath: "data/test.db",
    tdlibDataDir: "data/tdlib",
    ...overrides,
  };
}

describe("groupMessagesByChat", () => {
  it("groups messages by chat_id and stores chatTitle", () => {
    const messages = [
      {
        user_id: "default",
        chat_id: "chat_1",
        message_id: 1,
        sender_id: "user_1",
        sender_name: "Alice",
        text: "Hello",
        has_media: 0,
        media_type: null,
        date: 1700000000,
        chat_title: "Work Chat",
      },
      {
        user_id: "default",
        chat_id: "chat_1",
        message_id: 2,
        sender_id: "user_2",
        sender_name: "Bob",
        text: "Hi there",
        has_media: 0,
        media_type: null,
        date: 1700000060,
        chat_title: "Work Chat",
      },
      {
        user_id: "default",
        chat_id: "chat_2",
        message_id: 1,
        sender_id: "user_3",
        sender_name: "Charlie",
        text: "Check this out",
        has_media: 0,
        media_type: null,
        date: 1700000120,
        chat_title: "Friends",
      },
    ];

    const result = groupMessagesByChat(messages);

    expect(Object.keys(result)).toHaveLength(2);
    expect(result["chat_1"].messages).toHaveLength(2);
    expect(result["chat_2"].messages).toHaveLength(1);
    expect(result["chat_1"].chatTitle).toBe("Work Chat");
    expect(result["chat_2"].chatTitle).toBe("Friends");
  });

  it("does not collide chats with same title but different chat_id", () => {
    const messages = [
      {
        user_id: "default",
        chat_id: "chat_1",
        message_id: 1,
        sender_id: "user_1",
        sender_name: "Alice",
        text: "Hello from chat 1",
        has_media: 0,
        media_type: null,
        date: 1700000000,
        chat_title: "Same Title",
      },
      {
        user_id: "default",
        chat_id: "chat_2",
        message_id: 1,
        sender_id: "user_2",
        sender_name: "Bob",
        text: "Hello from chat 2",
        has_media: 0,
        media_type: null,
        date: 1700000060,
        chat_title: "Same Title",
      },
    ];

    const result = groupMessagesByChat(messages);

    expect(Object.keys(result)).toHaveLength(2);
    expect(result["chat_1"].messages).toHaveLength(1);
    expect(result["chat_2"].messages).toHaveLength(1);
    expect(result["chat_1"].messages[0].text).toBe("Hello from chat 1");
    expect(result["chat_2"].messages[0].text).toBe("Hello from chat 2");
  });

  it("uses chat_id as chatTitle when chat_title is null", () => {
    const messages = [
      {
        user_id: "default",
        chat_id: "chat_1",
        message_id: 1,
        sender_id: "user_1",
        sender_name: "Alice",
        text: "Hello",
        has_media: 0,
        media_type: null,
        date: 1700000000,
        chat_title: null,
      },
    ];

    const result = groupMessagesByChat(messages);

    expect(Object.keys(result)).toContain("chat_1");
    expect(result["chat_1"].chatTitle).toBe("chat_1");
  });

  it("uses Unknown for sender when sender_name is null", () => {
    const messages = [
      {
        user_id: "default",
        chat_id: "chat_1",
        message_id: 1,
        sender_id: "user_1",
        sender_name: null,
        text: "Hello",
        has_media: 0,
        media_type: null,
        date: 1700000000,
        chat_title: "Chat",
      },
    ];

    const result = groupMessagesByChat(messages);

    expect(result["chat_1"].messages[0].sender).toBe("Unknown");
  });

  it("shows media placeholder when text is null but has_media is true", () => {
    const messages = [
      {
        user_id: "default",
        chat_id: "chat_1",
        message_id: 1,
        sender_id: "user_1",
        sender_name: "Alice",
        text: null,
        has_media: 1,
        media_type: "photo",
        date: 1700000000,
        chat_title: "Chat",
      },
    ];

    const result = groupMessagesByChat(messages);

    expect(result["chat_1"].messages[0].text).toBe("[photo]");
  });

  it("shows [media] when media_type is null", () => {
    const messages = [
      {
        user_id: "default",
        chat_id: "chat_1",
        message_id: 1,
        sender_id: "user_1",
        sender_name: "Alice",
        text: null,
        has_media: 1,
        media_type: null,
        date: 1700000000,
        chat_title: "Chat",
      },
    ];

    const result = groupMessagesByChat(messages);

    expect(result["chat_1"].messages[0].text).toBe("[media]");
  });

  it("shows [empty] when no text and no media", () => {
    const messages = [
      {
        user_id: "default",
        chat_id: "chat_1",
        message_id: 1,
        sender_id: "user_1",
        sender_name: "Alice",
        text: null,
        has_media: 0,
        media_type: null,
        date: 1700000000,
        chat_title: "Chat",
      },
    ];

    const result = groupMessagesByChat(messages);

    expect(result["chat_1"].messages[0].text).toBe("[empty]");
  });

  it("returns empty object for empty message array", () => {
    const result = groupMessagesByChat([]);
    expect(result).toEqual({});
  });

  it("formats times using the provided timezone", () => {
    const messages = [
      {
        user_id: "default",
        chat_id: "chat_1",
        message_id: 1,
        sender_id: "user_1",
        sender_name: "Alice",
        text: "Hello",
        has_media: 0,
        media_type: null,
        date: 1700000000,
        chat_title: "Chat",
      },
    ];

    const resultUTC = groupMessagesByChat(messages, "UTC");
    const resultNY = groupMessagesByChat(messages, "America/New_York");

    expect(resultUTC["chat_1"].messages[0].time).toBe("22:13");
    expect(resultNY["chat_1"].messages[0].time).toBe("17:13");
  });
});

describe("buildPromptContent", () => {
  it("builds prompt with date and chat sections using chatTitle", () => {
    const grouped: GroupedMessages = {
      "chat_1": {
        chatTitle: "Work Chat",
        messages: [
          { sender: "Alice", text: "Hello", time: "09:00" },
          { sender: "Bob", text: "Hi there", time: "09:01" },
        ],
      },
    };

    const result = buildPromptContent(grouped, "2024-01-15");

    expect(result).toContain("2024-01-15");
    expect(result).toContain("## Work Chat");
    expect(result).toContain("[09:00] Alice: Hello");
    expect(result).toContain("[09:01] Bob: Hi there");
  });

  it("includes instructions in the prompt", () => {
    const grouped: GroupedMessages = {};
    const result = buildPromptContent(grouped, "2024-01-15");

    expect(result).toContain("summary of each conversation");
    expect(result).toContain("action items");
    expect(result).toContain("Important information");
  });

  it("truncates long messages to 500 characters", () => {
    const longText = "a".repeat(600);
    const grouped: GroupedMessages = {
      "chat_1": {
        chatTitle: "Chat",
        messages: [{ sender: "Alice", text: longText, time: "09:00" }],
      },
    };

    const result = buildPromptContent(grouped, "2024-01-15");

    expect(result).toContain("a".repeat(500) + "...");
    expect(result).not.toContain("a".repeat(501));
  });

  it("handles multiple chats", () => {
    const grouped: GroupedMessages = {
      "chat_1": {
        chatTitle: "Chat 1",
        messages: [{ sender: "Alice", text: "Hello", time: "09:00" }],
      },
      "chat_2": {
        chatTitle: "Chat 2",
        messages: [{ sender: "Bob", text: "World", time: "10:00" }],
      },
    };

    const result = buildPromptContent(grouped, "2024-01-15");

    expect(result).toContain("## Chat 1");
    expect(result).toContain("## Chat 2");
  });
});

describe("getDigestTimeRange", () => {
  it("returns a 24-hour range for UTC timezone", () => {
    const config = makeConfig({ timezone: "UTC" });
    const { start, end, dateStr } = getDigestTimeRange(config);

    expect(end - start).toBe(86400);

    const endDate = new Date(end * 1000);
    expect(endDate.getUTCHours()).toBe(0);
    expect(endDate.getUTCMinutes()).toBe(0);
  });

  it("returns date string in YYYY-MM-DD format", () => {
    const config = makeConfig({ timezone: "UTC" });
    const { dateStr } = getDigestTimeRange(config);

    expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("end timestamp is at midnight UTC for UTC timezone", () => {
    const config = makeConfig({ timezone: "UTC" });
    const { end } = getDigestTimeRange(config);

    const endDate = new Date(end * 1000);
    expect(endDate.getUTCHours()).toBe(0);
    expect(endDate.getUTCMinutes()).toBe(0);
    expect(endDate.getUTCSeconds()).toBe(0);
  });

  it("computes correct range for non-UTC timezone", () => {
    const config = makeConfig({ timezone: "America/New_York" });
    const { start, end } = getDigestTimeRange(config);

    const duration = end - start;
    expect(duration).toBeGreaterThanOrEqual(82800);
    expect(duration).toBeLessThanOrEqual(90000);

    const endDate = new Date(end * 1000);
    const endHourUTC = endDate.getUTCHours();
    expect([4, 5]).toContain(endHourUTC);
  });

  it("computes correct range for positive offset timezone", () => {
    const config = makeConfig({ timezone: "Asia/Tokyo" });
    const { start, end } = getDigestTimeRange(config);

    expect(end - start).toBe(86400);

    const endDate = new Date(end * 1000);
    expect(endDate.getUTCHours()).toBe(15);
  });

  it("dateStr corresponds to the digest day (yesterday in timezone)", () => {
    const config = makeConfig({ timezone: "UTC" });
    const { start, dateStr } = getDigestTimeRange(config);

    const startDate = new Date(start * 1000);
    const expectedYear = startDate.getUTCFullYear();
    const expectedMonth = String(startDate.getUTCMonth() + 1).padStart(2, "0");
    const expectedDay = String(startDate.getUTCDate()).padStart(2, "0");
    const expectedDateStr = `${expectedYear}-${expectedMonth}-${expectedDay}`;

    expect(dateStr).toBe(expectedDateStr);
  });
});

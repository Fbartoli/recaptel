import { describe, it, expect } from "vitest";
import { buildLlmHeaders } from "./client.js";
import type { Config } from "../config.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    telegramApiId: 12345,
    telegramApiHash: "abc123",
    telegramBotToken: "bot:token",
    telegramDigestChatId: "123456",
    llmBaseUrl: "https://openrouter.ai/api/v1",
    llmApiKey: "sk-or-test",
    llmModel: "openrouter/auto",
    timezone: "UTC",
    digestHourLocal: 9,
    chatAllowlist: [],
    chatBlocklist: [],
    ingestDialogLimit: 500,
    ingestMessagesPerChat: 500,
    dbPath: "data/test.db",
    tdlibDataDir: "data/tdlib",
    openrouterSiteUrl: undefined,
    openrouterAppName: undefined,
    ...overrides,
  };
}

describe("buildLlmHeaders", () => {
  it("includes Authorization and Content-Type by default", () => {
    const config = makeConfig();
    const headers = buildLlmHeaders(config);

    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Authorization"]).toBe("Bearer sk-or-test");
  });

  it("does not include OpenRouter headers when not configured", () => {
    const config = makeConfig();
    const headers = buildLlmHeaders(config);

    expect(headers["HTTP-Referer"]).toBeUndefined();
    expect(headers["X-Title"]).toBeUndefined();
  });

  it("includes HTTP-Referer when openrouterSiteUrl is set", () => {
    const config = makeConfig({ openrouterSiteUrl: "https://example.com" });
    const headers = buildLlmHeaders(config);

    expect(headers["HTTP-Referer"]).toBe("https://example.com");
  });

  it("includes X-Title when openrouterAppName is set", () => {
    const config = makeConfig({ openrouterAppName: "RecapTel" });
    const headers = buildLlmHeaders(config);

    expect(headers["X-Title"]).toBe("RecapTel");
  });

  it("includes both OpenRouter headers when both are set", () => {
    const config = makeConfig({
      openrouterSiteUrl: "https://my-app.com",
      openrouterAppName: "MyApp",
    });
    const headers = buildLlmHeaders(config);

    expect(headers["HTTP-Referer"]).toBe("https://my-app.com");
    expect(headers["X-Title"]).toBe("MyApp");
    expect(headers["Authorization"]).toBe("Bearer sk-or-test");
  });
});



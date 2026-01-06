import { describe, it, expect } from "vitest";
import { splitMessage, escapeMarkdownV2 } from "./sendDigest.js";

describe("escapeMarkdownV2", () => {
  it("escapes all MarkdownV2 special characters", () => {
    const input = "_*[]()~`>#+-=|{}.!\\";
    const expected = "\\_\\*\\[\\]\\(\\)\\~\\`\\>\\#\\+\\-\\=\\|\\{\\}\\.\\!\\\\";
    expect(escapeMarkdownV2(input)).toBe(expected);
  });

  it("leaves regular text unchanged", () => {
    const input = "Hello world";
    expect(escapeMarkdownV2(input)).toBe("Hello world");
  });

  it("escapes special chars embedded in text", () => {
    const input = "Check this: 2+2=4!";
    expect(escapeMarkdownV2(input)).toBe("Check this: 2\\+2\\=4\\!");
  });

  it("handles empty string", () => {
    expect(escapeMarkdownV2("")).toBe("");
  });

  it("escapes ISO date format correctly", () => {
    const input = "2024-01-15T10:30:00.000Z";
    expect(escapeMarkdownV2(input)).toBe("2024\\-01\\-15T10:30:00\\.000Z");
  });
});

describe("splitMessage", () => {
  it("returns single part for short message", () => {
    const text = "Hello world";
    expect(splitMessage(text)).toEqual(["Hello world"]);
  });

  it("returns single part when exactly at max length", () => {
    const text = "a".repeat(4000);
    expect(splitMessage(text, 4000)).toEqual([text]);
  });

  it("splits on double newline when possible", () => {
    const part1 = "First section content";
    const part2 = "Second section content";
    const text = part1 + "\n\n" + part2;
    const result = splitMessage(text, 30);
    expect(result[0]).toBe(part1);
    expect(result[1]).toBe(part2);
  });

  it("splits on single newline if no double newline found", () => {
    const part1 = "First line";
    const part2 = "Second line";
    const text = part1 + "\n" + part2;
    const result = splitMessage(text, 15);
    expect(result[0]).toBe(part1);
    expect(result[1]).toBe(part2);
  });

  it("splits on space if no newline found", () => {
    const text = "word1 word2 word3";
    const result = splitMessage(text, 10);
    expect(result[0]).toBe("word1");
    expect(result[1]).toBe("word2");
    expect(result[2]).toBe("word3");
  });

  it("hard splits when no good break point found", () => {
    const text = "abcdefghijklmnop";
    const result = splitMessage(text, 5);
    expect(result[0]).toBe("abcde");
    expect(result[1]).toBe("fghij");
    expect(result[2]).toBe("klmno");
    expect(result[3]).toBe("p");
  });

  it("handles multiple parts correctly", () => {
    const sections = ["Section 1", "Section 2", "Section 3"];
    const text = sections.join("\n\n");
    const result = splitMessage(text, 15);
    expect(result.length).toBe(3);
    expect(result).toEqual(sections);
  });

  it("trims leading whitespace from subsequent parts", () => {
    const text = "First\n\n   Second";
    const result = splitMessage(text, 10);
    expect(result[1]).toBe("Second");
  });

  it("respects custom max length", () => {
    const text = "a".repeat(100);
    const result = splitMessage(text, 30);
    expect(result.length).toBe(4);
    expect(result[0]).toBe("a".repeat(30));
    expect(result[1]).toBe("a".repeat(30));
    expect(result[2]).toBe("a".repeat(30));
    expect(result[3]).toBe("a".repeat(10));
  });
});


import { describe, it, expect } from "vitest";
import { parseCommaSeparated } from "./config.js";

describe("parseCommaSeparated", () => {
  it("returns empty array for undefined", () => {
    expect(parseCommaSeparated(undefined)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseCommaSeparated("")).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(parseCommaSeparated("   ")).toEqual([]);
  });

  it("parses single value", () => {
    expect(parseCommaSeparated("foo")).toEqual(["foo"]);
  });

  it("parses multiple values", () => {
    expect(parseCommaSeparated("foo,bar,baz")).toEqual(["foo", "bar", "baz"]);
  });

  it("trims whitespace around values", () => {
    expect(parseCommaSeparated("  foo , bar  ,  baz  ")).toEqual([
      "foo",
      "bar",
      "baz",
    ]);
  });

  it("filters out empty values from consecutive commas", () => {
    expect(parseCommaSeparated("foo,,bar")).toEqual(["foo", "bar"]);
  });

  it("handles trailing comma", () => {
    expect(parseCommaSeparated("foo,bar,")).toEqual(["foo", "bar"]);
  });

  it("handles leading comma", () => {
    expect(parseCommaSeparated(",foo,bar")).toEqual(["foo", "bar"]);
  });
});


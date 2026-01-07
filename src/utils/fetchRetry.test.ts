import { describe, it, expect } from "vitest";
import { isRetryableError, isRetryableStatus, computeDelay } from "./fetchRetry.js";

describe("isRetryableError", () => {
  it("returns true for timeout errors", () => {
    expect(isRetryableError(new Error("Request timeout"))).toBe(true);
    expect(isRetryableError(new Error("The operation was aborted"))).toBe(true);
  });

  it("returns true for connection errors", () => {
    expect(isRetryableError(new Error("ECONNRESET"))).toBe(true);
    expect(isRetryableError(new Error("ENOTFOUND"))).toBe(true);
  });

  it("returns true for network errors", () => {
    expect(isRetryableError(new Error("Network error"))).toBe(true);
    expect(isRetryableError(new Error("fetch failed"))).toBe(true);
  });

  it("returns false for non-retryable errors", () => {
    expect(isRetryableError(new Error("Invalid API key"))).toBe(false);
    expect(isRetryableError(new Error("Bad request"))).toBe(false);
    expect(isRetryableError(new Error("Not found"))).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isRetryableError("string error")).toBe(false);
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
    expect(isRetryableError(42)).toBe(false);
  });
});

describe("isRetryableStatus", () => {
  it("returns true for 429 Too Many Requests", () => {
    expect(isRetryableStatus(429)).toBe(true);
  });

  it("returns true for 5xx server errors", () => {
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(502)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(504)).toBe(true);
    expect(isRetryableStatus(599)).toBe(true);
  });

  it("returns false for 4xx client errors (except 429)", () => {
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(403)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
  });

  it("returns false for 2xx success codes", () => {
    expect(isRetryableStatus(200)).toBe(false);
    expect(isRetryableStatus(201)).toBe(false);
    expect(isRetryableStatus(204)).toBe(false);
  });

  it("returns false for 3xx redirect codes", () => {
    expect(isRetryableStatus(301)).toBe(false);
    expect(isRetryableStatus(302)).toBe(false);
    expect(isRetryableStatus(304)).toBe(false);
  });
});

describe("computeDelay", () => {
  it("computes exponential backoff delay", () => {
    expect(computeDelay(0, 1000, 2)).toBe(1000);
    expect(computeDelay(1, 1000, 2)).toBe(2000);
    expect(computeDelay(2, 1000, 2)).toBe(4000);
    expect(computeDelay(3, 1000, 2)).toBe(8000);
  });

  it("works with different base delays", () => {
    expect(computeDelay(0, 500, 2)).toBe(500);
    expect(computeDelay(1, 500, 2)).toBe(1000);
    expect(computeDelay(2, 500, 2)).toBe(2000);
  });

  it("works with different multipliers", () => {
    expect(computeDelay(0, 1000, 1.5)).toBe(1000);
    expect(computeDelay(1, 1000, 1.5)).toBe(1500);
    expect(computeDelay(2, 1000, 1.5)).toBe(2250);
  });

  it("returns base delay for attempt 0", () => {
    expect(computeDelay(0, 100, 10)).toBe(100);
    expect(computeDelay(0, 2000, 3)).toBe(2000);
  });
});



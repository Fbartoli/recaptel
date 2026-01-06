export interface RetryOptions {
  maxRetries?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
  retryMultiplier?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  timeoutMs: 30000,
  retryDelayMs: 1000,
  retryMultiplier: 2,
};

export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("timeout") || msg.includes("aborted")) return true;
    if (msg.includes("econnreset") || msg.includes("enotfound")) return true;
    if (msg.includes("network") || msg.includes("fetch failed")) return true;
  }
  return false;
}

export function isRetryableStatus(status: number): boolean {
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

export function computeDelay(attempt: number, baseDelay: number, multiplier: number): number {
  return baseDelay * Math.pow(multiplier, attempt);
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: RetryOptions = {}
): Promise<Response> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), opts.timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok && isRetryableStatus(response.status) && attempt < opts.maxRetries) {
        const delay = computeDelay(attempt, opts.retryDelayMs, opts.retryMultiplier);
        await sleep(delay);
        continue;
      }

      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err instanceof Error ? err : new Error(String(err));

      if (isRetryableError(err) && attempt < opts.maxRetries) {
        const delay = computeDelay(attempt, opts.retryDelayMs, opts.retryMultiplier);
        await sleep(delay);
        continue;
      }

      throw lastError;
    }
  }

  throw lastError ?? new Error("Fetch failed after retries");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


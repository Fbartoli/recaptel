import { readFileSync, existsSync } from "fs";

export function readSecret(name: string, envFallback?: string): string | undefined {
  const secretPath = `/run/secrets/${name}`;
  
  if (existsSync(secretPath)) {
    try {
      return readFileSync(secretPath, "utf8").trim();
    } catch {
      // Fall through to env
    }
  }
  
  return envFallback;
}

export function getLlmApiKey(): string | undefined {
  return readSecret("llm_api_key", process.env.LLM_API_KEY);
}

export function getTelegramApiHash(): string | undefined {
  return readSecret("telegram_api_hash", process.env.TELEGRAM_API_HASH);
}



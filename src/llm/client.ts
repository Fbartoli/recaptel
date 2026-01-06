import type { Config } from "../config.js";
import { fetchWithRetry } from "../utils/fetchRetry.js";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionResponse {
  id: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export function buildLlmHeaders(config: Config): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.llmApiKey}`,
  };

  if (config.openrouterSiteUrl) {
    headers["HTTP-Referer"] = config.openrouterSiteUrl;
  }
  if (config.openrouterAppName) {
    headers["X-Title"] = config.openrouterAppName;
  }

  return headers;
}

export async function chatCompletion(
  config: Config,
  messages: ChatMessage[],
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const { maxTokens = 2000, temperature = 0.7 } = options;

  const url = `${config.llmBaseUrl}/chat/completions`;

  const response = await fetchWithRetry(
    url,
    {
      method: "POST",
      headers: buildLlmHeaders(config),
      body: JSON.stringify({
        model: config.llmModel,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    },
    { timeoutMs: 120000, maxRetries: 2 }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  return data.choices[0]?.message?.content ?? "";
}



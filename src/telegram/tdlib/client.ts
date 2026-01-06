import { createClient, configure, type Client } from "tdl";
import { getTdjson } from "prebuilt-tdlib";
import { mkdirSync, existsSync } from "fs";
import { join } from "path";
import type { Config } from "../../config.js";

export type AuthorizationState =
  | "authorizationStateWaitTdlibParameters"
  | "authorizationStateWaitPhoneNumber"
  | "authorizationStateWaitCode"
  | "authorizationStateWaitPassword"
  | "authorizationStateReady"
  | "authorizationStateClosed"
  | "authorizationStateClosing"
  | "authorizationStateLoggingOut"
  | string;

export interface TdlibClientWrapper {
  client: Client;
  userId: string;
  getAuthState(): Promise<AuthorizationState>;
  sendPhoneNumber(phone: string): Promise<void>;
  sendCode(code: string): Promise<void>;
  sendPassword(password: string): Promise<void>;
  close(): Promise<void>;
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

const VALID_USER_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export function validateUserId(userId: string): void {
  if (!VALID_USER_ID_PATTERN.test(userId)) {
    throw new Error(
      `Invalid userId "${userId}": must be 1-64 alphanumeric characters, underscores, or hyphens`
    );
  }
}

export function getTdlibDataDir(tdlibDataDir: string, userId: string): string {
  validateUserId(userId);
  return join(tdlibDataDir, userId);
}

let configured = false;

export async function createTdlibClient(
  config: Config,
  userId: string
): Promise<TdlibClientWrapper> {
  const dataDir = getTdlibDataDir(config.tdlibDataDir, userId);
  ensureDir(dataDir);

  if (!configured) {
    configure({
      tdjson: getTdjson(),
      verbosityLevel: 1,
    });
    configured = true;
  }

  const client = createClient({
    apiId: config.telegramApiId,
    apiHash: config.telegramApiHash,
    databaseDirectory: join(dataDir, "db"),
    filesDirectory: join(dataDir, "files"),
    tdlibParameters: {
      use_message_database: true,
      use_secret_chats: false,
      system_language_code: "en",
      device_model: "RecapTel Server",
      application_version: "1.0.0",
    },
  });

  let currentAuthState: AuthorizationState = "authorizationStateWaitTdlibParameters";

  client.on("update", (update) => {
    if (update._ === "updateAuthorizationState") {
      currentAuthState = update.authorization_state._ as AuthorizationState;
    }
  });

  client.on("error", (err) => {
    console.error(`[TDLib ${userId}] Error:`, err);
  });

  return {
    client,
    userId,

    async getAuthState(): Promise<AuthorizationState> {
      return currentAuthState;
    },

    async sendPhoneNumber(phone: string): Promise<void> {
      await client.invoke({
        _: "setAuthenticationPhoneNumber",
        phone_number: phone,
        settings: {
          _: "phoneNumberAuthenticationSettings",
          allow_flash_call: false,
          allow_missed_call: false,
          is_current_phone_number: false,
          has_unknown_phone_number: false,
          allow_sms_retriever_api: false,
          authentication_tokens: [],
        },
      });
    },

    async sendCode(code: string): Promise<void> {
      await client.invoke({
        _: "checkAuthenticationCode",
        code,
      });
    },

    async sendPassword(password: string): Promise<void> {
      await client.invoke({
        _: "checkAuthenticationPassword",
        password,
      });
    },

    async close(): Promise<void> {
      await client.close();
    },
  };
}

const clientCache = new Map<string, TdlibClientWrapper>();

export async function getOrCreateClient(
  config: Config,
  userId: string
): Promise<TdlibClientWrapper> {
  if (clientCache.has(userId)) {
    return clientCache.get(userId)!;
  }
  const wrapper = await createTdlibClient(config, userId);
  clientCache.set(userId, wrapper);
  return wrapper;
}

export function removeClientFromCache(userId: string): void {
  clientCache.delete(userId);
}

import { createClient, configure, type Client } from "tdl";
import { getTdjson } from "prebuilt-tdlib";
import { mkdirSync, existsSync } from "fs";
import { join } from "path";
import { publishAuthState } from "./redis.js";

export type TelegramAuthState = 
  | "disconnected" 
  | "awaiting_phone" 
  | "awaiting_code" 
  | "awaiting_password" 
  | "ready";

export type TdLibAuthState =
  | "authorizationStateWaitTdlibParameters"
  | "authorizationStateWaitPhoneNumber"
  | "authorizationStateWaitCode"
  | "authorizationStateWaitPassword"
  | "authorizationStateReady"
  | "authorizationStateClosed"
  | "authorizationStateClosing"
  | "authorizationStateLoggingOut"
  | string;

export interface WorkerConfig {
  telegramApiId: number;
  telegramApiHash: string;
  tdlibDataDir: string;
}

export interface ManagedClient {
  client: Client;
  userId: string;
  authState: TdLibAuthState;
  onStateChange?: (state: TelegramAuthState) => void;
}

const VALID_USER_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

function validateUserId(userId: string): void {
  if (!VALID_USER_ID_PATTERN.test(userId)) {
    throw new Error(`Invalid userId "${userId}"`);
  }
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function mapTdLibStateToAppState(tdState: TdLibAuthState): TelegramAuthState {
  switch (tdState) {
    case "authorizationStateWaitPhoneNumber":
      return "awaiting_phone";
    case "authorizationStateWaitCode":
      return "awaiting_code";
    case "authorizationStateWaitPassword":
      return "awaiting_password";
    case "authorizationStateReady":
      return "ready";
    case "authorizationStateClosed":
    case "authorizationStateClosing":
    case "authorizationStateLoggingOut":
      return "disconnected";
    default:
      return "disconnected";
  }
}

let tdlConfigured = false;

export class TdlibManager {
  private clients = new Map<string, ManagedClient>();
  private config: WorkerConfig;

  constructor(config: WorkerConfig) {
    this.config = config;
    
    if (!tdlConfigured) {
      configure({
        tdjson: getTdjson(),
        verbosityLevel: 1,
      });
      tdlConfigured = true;
    }
  }

  async createClient(userId: string): Promise<ManagedClient> {
    validateUserId(userId);

    if (this.clients.has(userId)) {
      return this.clients.get(userId)!;
    }

    const dataDir = join(this.config.tdlibDataDir, userId);
    ensureDir(dataDir);

    const client = createClient({
      apiId: this.config.telegramApiId,
      apiHash: this.config.telegramApiHash,
      databaseDirectory: join(dataDir, "db"),
      filesDirectory: join(dataDir, "files"),
      tdlibParameters: {
        use_message_database: true,
        use_secret_chats: false,
        system_language_code: "en",
        device_model: "RecapTel Worker",
        application_version: "1.0.0",
      },
    });

    const managed: ManagedClient = {
      client,
      userId,
      authState: "authorizationStateWaitTdlibParameters",
    };

    client.on("update", async (update) => {
      if (update._ === "updateAuthorizationState") {
        const newState = update.authorization_state._ as TdLibAuthState;
        managed.authState = newState;
        
        const appState = mapTdLibStateToAppState(newState);
        console.log(`[TDLib ${userId}] Auth state: ${newState} -> ${appState}`);
        
        await publishAuthState(userId, { type: "STATE", state: appState });
        
        if (managed.onStateChange) {
          managed.onStateChange(appState);
        }
      }
    });

    client.on("error", async (err) => {
      console.error(`[TDLib ${userId}] Error:`, err);
      await publishAuthState(userId, { 
        type: "ERROR", 
        message: err instanceof Error ? err.message : String(err) 
      });
    });

    this.clients.set(userId, managed);
    return managed;
  }

  getClient(userId: string): ManagedClient | undefined {
    return this.clients.get(userId);
  }

  async sendPhoneNumber(userId: string, phone: string): Promise<void> {
    const managed = this.clients.get(userId);
    if (!managed) {
      throw new Error(`No client for user ${userId}`);
    }

    await managed.client.invoke({
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
  }

  async sendCode(userId: string, code: string): Promise<void> {
    const managed = this.clients.get(userId);
    if (!managed) {
      throw new Error(`No client for user ${userId}`);
    }

    await managed.client.invoke({
      _: "checkAuthenticationCode",
      code,
    });
  }

  async sendPassword(userId: string, password: string): Promise<void> {
    const managed = this.clients.get(userId);
    if (!managed) {
      throw new Error(`No client for user ${userId}`);
    }

    await managed.client.invoke({
      _: "checkAuthenticationPassword",
      password,
    });
  }

  async disconnect(userId: string): Promise<void> {
    const managed = this.clients.get(userId);
    if (!managed) {
      return;
    }

    try {
      await managed.client.invoke({ _: "logOut" });
      await managed.client.close();
    } catch (err) {
      console.error(`[TDLib ${userId}] Error during disconnect:`, err);
    }
    
    this.clients.delete(userId);
  }

  async closeClient(userId: string): Promise<void> {
    const managed = this.clients.get(userId);
    if (!managed) {
      return;
    }

    try {
      await managed.client.close();
    } catch (err) {
      console.error(`[TDLib ${userId}] Error during close:`, err);
    }
    
    this.clients.delete(userId);
  }

  async closeAll(): Promise<void> {
    for (const [userId] of this.clients) {
      await this.closeClient(userId);
    }
  }

  isReady(userId: string): boolean {
    const managed = this.clients.get(userId);
    return managed?.authState === "authorizationStateReady";
  }

  getReadyClients(): ManagedClient[] {
    return Array.from(this.clients.values()).filter(
      (c) => c.authState === "authorizationStateReady"
    );
  }
}


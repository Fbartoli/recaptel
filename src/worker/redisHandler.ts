import { getSubscriber, REDIS_CHANNELS, type AuthCommand, publishAuthState } from "./redis.js";
import type { TdlibManager } from "./tdlibManager.js";
import type Database from "better-sqlite3";

export class RedisHandler {
  private subscriber = getSubscriber();
  private tdlibManager: TdlibManager;
  private db: Database.Database;
  private subscribedUsers = new Set<string>();

  constructor(tdlibManager: TdlibManager, db: Database.Database) {
    this.tdlibManager = tdlibManager;
    this.db = db;
  }

  async subscribeToUser(userId: string): Promise<void> {
    if (this.subscribedUsers.has(userId)) {
      return;
    }

    const channel = REDIS_CHANNELS.authCommand(userId);
    await this.subscriber.subscribe(channel);
    this.subscribedUsers.add(userId);
    console.log(`[Redis] Subscribed to auth commands for user: ${userId}`);
  }

  async unsubscribeFromUser(userId: string): Promise<void> {
    if (!this.subscribedUsers.has(userId)) {
      return;
    }

    const channel = REDIS_CHANNELS.authCommand(userId);
    await this.subscriber.unsubscribe(channel);
    this.subscribedUsers.delete(userId);
    console.log(`[Redis] Unsubscribed from auth commands for user: ${userId}`);
  }

  async start(): Promise<void> {
    await this.subscriber.connect();

    this.subscriber.on("message", async (channel: string, message: string) => {
      const userIdMatch = channel.match(/telegram:auth:(.+)/);
      if (!userIdMatch) return;

      const userId = userIdMatch[1];
      
      let command: AuthCommand;
      try {
        command = JSON.parse(message);
      } catch {
        console.error(`[Redis] Invalid command message: ${message}`);
        return;
      }

      console.log(`[Redis] Received command for ${userId}: ${command.type}`);
      await this.handleCommand(userId, command);
    });

    await this.subscribeToActiveUsers();

    console.log("[Redis] Handler started");
  }

  private async subscribeToActiveUsers(): Promise<void> {
    const activeUsers = this.db
      .prepare(`
        SELECT id FROM users 
        WHERE telegram_auth_state IS NOT NULL 
          AND telegram_auth_state != 'disconnected'
      `)
      .all() as { id: string }[];

    for (const user of activeUsers) {
      await this.subscribeToUser(user.id);
    }
  }

  private async handleCommand(userId: string, command: AuthCommand): Promise<void> {
    try {
      switch (command.type) {
        case "CONNECT":
          await this.handleConnect(userId);
          break;
        case "PHONE":
          await this.handlePhone(userId, command.phone);
          break;
        case "CODE":
          await this.handleCode(userId, command.code);
          break;
        case "PASSWORD":
          await this.handlePassword(userId, command.password);
          break;
        case "DISCONNECT":
          await this.handleDisconnect(userId);
          break;
      }
    } catch (err) {
      console.error(`[Redis] Error handling command ${command.type} for ${userId}:`, err);
      await publishAuthState(userId, {
        type: "ERROR",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async handleConnect(userId: string): Promise<void> {
    await this.subscribeToUser(userId);
    
    const managed = await this.tdlibManager.createClient(userId);
    
    managed.onStateChange = (state) => {
      this.updateUserState(userId, state);
    };
  }

  private async ensureClient(userId: string): Promise<void> {
    if (!this.tdlibManager.getClient(userId)) {
      console.log(`[Redis] Creating TDLib client on-demand for ${userId}`);
      const managed = await this.tdlibManager.createClient(userId);
      managed.onStateChange = (state) => {
        this.updateUserState(userId, state);
      };
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  private async handlePhone(userId: string, phone: string): Promise<void> {
    await this.ensureClient(userId);
    await this.tdlibManager.sendPhoneNumber(userId, phone);
  }

  private async handleCode(userId: string, code: string): Promise<void> {
    await this.ensureClient(userId);
    await this.tdlibManager.sendCode(userId, code);
  }

  private async handlePassword(userId: string, password: string): Promise<void> {
    await this.ensureClient(userId);
    await this.tdlibManager.sendPassword(userId, password);
  }

  private async handleDisconnect(userId: string): Promise<void> {
    await this.tdlibManager.disconnect(userId);
    await this.unsubscribeFromUser(userId);
    this.updateUserState(userId, "disconnected");
  }

  private updateUserState(userId: string, state: string): void {
    const stmt = this.db.prepare(`
      UPDATE users 
      SET telegram_auth_state = ?,
          telegram_connected_at = CASE WHEN ? = 'ready' THEN unixepoch() ELSE telegram_connected_at END,
          updated_at = unixepoch()
      WHERE id = ?
    `);
    stmt.run(state, state, userId);
  }

  async stop(): Promise<void> {
    for (const userId of this.subscribedUsers) {
      await this.unsubscribeFromUser(userId);
    }
    await this.subscriber.quit();
    console.log("[Redis] Handler stopped");
  }
}


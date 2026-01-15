// storage.ts
import fs from "fs";
import path from "path";
import { GameSession } from "../types/type";

export class StorageManager {
  private storageDir: string;

  constructor(storageDir: string) {
    this.storageDir = storageDir;
    this.ensureStorageDirectory();
  }

  private ensureStorageDirectory(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
      console.log(`📁 Created storage directory: ${this.storageDir}`);
    }
  }

  saveSession(chatId: number, session: GameSession): void {
    try {
      const filePath = path.join(this.storageDir, `session_${chatId}.json`);
      session.updatedAt = new Date().toISOString();
      fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
      console.log(`💾 Saved session for chat ${chatId}`);
    } catch (error) {
      console.error(`Failed to save session for chat ${chatId}:`, error);
    }
  }

  loadSession(chatId: number): GameSession | null {
    try {
      const filePath = path.join(this.storageDir, `session_${chatId}.json`);
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, "utf-8");
        const session = JSON.parse(data) as GameSession;
        console.log(
          `📂 Loaded session for chat ${chatId} with ${session.players.length} players`
        );
        return session;
      }
    } catch (error) {
      console.error(`Failed to load session for chat ${chatId}:`, error);
    }
    return null;
  }

  loadAllSessions(): Map<number, GameSession> {
    const sessions = new Map<number, GameSession>();
    try {
      const files = fs.readdirSync(this.storageDir);
      files.forEach((file) => {
        if (file.startsWith("session_") && file.endsWith(".json")) {
          const chatId = parseInt(
            file.replace("session_", "").replace(".json", "")
          );
          const session = this.loadSession(chatId);
          if (session) {
            sessions.set(chatId, session);
          }
        }
      });
      console.log(`📚 Loaded ${sessions.size} sessions from disk`);
    } catch (error) {
      console.error("Failed to load sessions:", error);
    }
    return sessions;
  }

  deleteSession(chatId: number): void {
    try {
      const filePath = path.join(this.storageDir, `session_${chatId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Deleted session file for chat ${chatId}`);
      }
    } catch (error) {
      console.error(`Failed to delete session for chat ${chatId}:`, error);
    }
  }
}

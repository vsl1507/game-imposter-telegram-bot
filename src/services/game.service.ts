// gameManager.ts
import TelegramBot from "node-telegram-bot-api";
import { GameSession, Player } from "../types/type";
import { StorageManager } from "../storages/storages";
import {
  BASE_TOPICS,
  CATEGORIES,
  GLOBAL_CHAT_ID,
} from "../constants/constants";
import { OllamaService } from "./ollama.service";

export class GameManager {
  private sessions: Map<number, GameSession>;
  private storage: StorageManager;
  private bot: TelegramBot;
  private ollamaService: OllamaService;

  constructor(storage: StorageManager, bot: TelegramBot) {
    this.sessions = new Map();
    this.storage = storage;
    this.bot = bot;
    this.ollamaService = new OllamaService();
    this.loadAllSessions();
  }

  private loadAllSessions(): void {
    const loadedSessions = this.storage.loadAllSessions();

    // Migrate old sessions to new structure
    loadedSessions.forEach((session, chatId) => {
      if (!session.settings.minPlayers) {
        session.settings.minPlayers = 4;
      }
      if (!session.settings.voteTimeSeconds) {
        session.settings.voteTimeSeconds = 120;
      }
      if (session.settings.onlineMode === undefined) {
        session.settings.onlineMode = false;
      }
      if (!session.botMessageIds) {
        session.botMessageIds = [];
      }
      // Remove old properties if they exist
      if ("totalPlayers" in session.settings) {
        delete (session.settings as any).totalPlayers;
      }
      if ("totalImposters" in session.settings) {
        delete (session.settings as any).totalImposters;
      }
      this.storage.saveSession(chatId, session);
    });

    this.sessions = loadedSessions;
  }

  getEffectiveChatId(chatId: number, chatType: string): number {
    return chatType === "private" ? GLOBAL_CHAT_ID : chatId;
  }

  async isAdmin(
    chatId: number,
    userId: number,
    chatType: string
  ): Promise<boolean> {
    try {
      const effectiveChatId = this.getEffectiveChatId(chatId, chatType);
      const session = this.sessions.get(effectiveChatId);

      if (session?.promotedAdmins?.includes(userId)) {
        return true;
      }

      if (chatType === "private") {
        return false;
      }

      const member = await this.bot.getChatMember(chatId, userId);
      return member.status === "creator" || member.status === "administrator";
    } catch (error) {
      console.error("Error checking admin status:", error);
      return false;
    }
  }

  createSession(chatId: number, adminId?: number): GameSession {
    return {
      chatId,
      adminId,
      promotedAdmins: [],
      players: [],
      imposters: [],
      topic: "",
      started: false,
      rolesDistributed: false,
      botMessageIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: {
        minPlayers: 4,
        totalPlayers: 4,
        totalImposters: 1,
        voteTimeSeconds: 120,
        onlineMode: false,
      },
    };
  }

  getOrCreateSession(chatId: number, adminId?: number): GameSession {
    if (!this.sessions.has(chatId)) {
      const existingSession = this.storage.loadSession(chatId);
      if (existingSession) {
        if (!existingSession.promotedAdmins) {
          existingSession.promotedAdmins = [];
        }
        this.sessions.set(chatId, existingSession);
        return existingSession;
      }
      const newSession = this.createSession(chatId, adminId);
      this.sessions.set(chatId, newSession);
      this.storage.saveSession(chatId, newSession);
    }
    return this.sessions.get(chatId)!;
  }

  getSession(chatId: number): GameSession | undefined {
    return this.sessions.get(chatId);
  }

  async prepareGame(chatId: number): Promise<boolean> {
    const session = this.getOrCreateSession(chatId);
    const minPlayers = session.settings.minPlayers;

    if (session.players.length < minPlayers) return false;

    // Calculate imposters as 25% of total players (minimum 1)
    const totalPlayers = session.players.length;
    const imposterCount = Math.max(1, Math.floor(totalPlayers * 0.25));

    const playerIds = session.players.map((p) => p.userId);
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
    session.imposters = shuffled.slice(0, imposterCount);

    let finalTopic: string;
    let sourceInfo: string;

    // Try to use Ollama with CATEGORIES
    if (this.ollamaService.isEnabled()) {
      const category =
        CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
      console.log(
        `🤖 Trying to generate specific topic for category: ${category}`
      );

      const ollamaTopic = await this.ollamaService.generateSpecificTopic(
        category
      );

      if (ollamaTopic) {
        finalTopic = ollamaTopic;
        sourceInfo = `Ollama generated from category: ${category}`;
      } else {
        // Ollama failed, use BASE_TOPICS as fallback
        finalTopic =
          BASE_TOPICS[Math.floor(Math.random() * BASE_TOPICS.length)];
        sourceInfo = "Ollama failed, using BASE_TOPICS fallback";
      }
    } else {
      // Ollama disabled, use BASE_TOPICS directly
      finalTopic = BASE_TOPICS[Math.floor(Math.random() * BASE_TOPICS.length)];
      sourceInfo = "Ollama disabled, using BASE_TOPICS";
    }

    session.topic = finalTopic;
    session.started = true;

    this.storage.saveSession(chatId, session);

    console.log(`Game prepared in chat ${chatId}`);
    console.log(
      `Total players: ${totalPlayers}, Imposters: ${imposterCount} (25%)`
    );
    console.log(`Topic: ${finalTopic} (${sourceInfo})`);

    return true;
  }

  async distributeRoles(chatId: number, groupLink?: string): Promise<void> {
    const session = this.getOrCreateSession(chatId);
    if (!session.started || session.rolesDistributed) return;

    console.log(
      `📨 Distributing roles. Online mode: ${
        session.settings.onlineMode
      }, Group link: ${groupLink || "none"}`
    );

    for (const player of session.players) {
      try {
        let message = "";
        if (session.imposters.includes(player.userId)) {
          message = "❌ You're an imposter\n\n";
          message += "🎯 Your goal: Blend in without knowing the topic!";
        } else {
          message = `✅ You're not an imposter\n\n`;
          message += `🎯 Your topic: ${session.topic}\n\n`;
          message += `💡 Discuss the topic to find the imposters!`;
        }

        // Add group link if online mode is enabled and link is provided
        if (session.settings.onlineMode && groupLink) {
          message += `\n\n📱 Group Chat Link:\n${groupLink}`;
          console.log(
            `📱 Adding group link to message for player ${player.userId}`
          );
        }

        await this.bot.sendMessage(player.userId, message);
      } catch (error) {
        console.error(`Failed to send role to user ${player.userId}:`, error);
      }
    }

    session.rolesDistributed = true;
    this.storage.saveSession(chatId, session);
  }

  addPlayer(chatId: number, player: Player): void {
    const session = this.getOrCreateSession(chatId);
    session.players.push(player);
    this.storage.saveSession(chatId, session);
  }

  removePlayer(chatId: number, userId: number): boolean {
    const session = this.sessions.get(chatId);
    if (!session) return false;

    const index = session.players.findIndex((p) => p.userId === userId);
    if (index === -1) return false;

    session.players.splice(index, 1);
    this.storage.saveSession(chatId, session);
    return true;
  }

  promoteAdmin(chatId: number, userId: number): void {
    const session = this.getOrCreateSession(chatId);
    if (!session.promotedAdmins.includes(userId)) {
      session.promotedAdmins.push(userId);
      this.storage.saveSession(chatId, session);
    }
  }

  endGame(chatId: number): void {
    const session = this.sessions.get(chatId);
    if (!session) return;

    session.started = false;
    session.rolesDistributed = false;
    session.imposters = [];
    session.topic = "";
    session.votingSession = undefined;

    // Reset eliminated status for all players
    session.players.forEach((p) => (p.eliminated = false));

    this.storage.saveSession(chatId, session);
  }

  trackBotMessage(chatId: number, messageId: number): void {
    const session = this.sessions.get(chatId);
    if (!session) return;

    if (!session.botMessageIds) {
      session.botMessageIds = [];
    }

    session.botMessageIds.push(messageId);
    this.storage.saveSession(chatId, session);
  }

  async clearBotMessages(chatId: number): Promise<number> {
    const session = this.sessions.get(chatId);
    if (!session || !session.botMessageIds) return 0;

    let deletedCount = 0;
    const messageIds = [...session.botMessageIds];

    for (const messageId of messageIds) {
      try {
        await this.bot.deleteMessage(chatId, messageId);
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete message ${messageId}:`, error);
      }
    }

    // Clear the tracked messages
    session.botMessageIds = [];
    this.storage.saveSession(chatId, session);

    return deletedCount;
  }

  resetGame(chatId: number, adminId?: number): void {
    const oldSession = this.sessions.get(chatId);
    const newSession = this.createSession(chatId, adminId);

    if (oldSession) {
      newSession.settings = { ...oldSession.settings };
      newSession.promotedAdmins = [...oldSession.promotedAdmins];
    }

    this.sessions.set(chatId, newSession);
    this.storage.deleteSession(chatId);
    this.storage.saveSession(chatId, newSession);
  }

  updateSettings(
    chatId: number,
    settings: Partial<GameSession["settings"]>
  ): void {
    const session = this.getOrCreateSession(chatId);
    session.settings = { ...session.settings, ...settings };
    this.storage.saveSession(chatId, session);
  }

  getImposterCount(totalPlayers: number): number {
    return Math.max(1, Math.floor(totalPlayers * 0.25));
  }

  getActiveSessionsCount(): number {
    return this.sessions.size;
  }

  saveSession(chatId: number, session: GameSession): void {
    this.storage.saveSession(chatId, session);
  }
}

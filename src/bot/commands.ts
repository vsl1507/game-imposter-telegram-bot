// botCommands.ts
import TelegramBot, { Message } from "node-telegram-bot-api";
import { GameManager } from "../services/game.service";
import { Player } from "../types/type";

export class BotCommandHandler {
  private bot: TelegramBot;
  private gameManager: GameManager;
  private adminSecret: string;

  constructor(bot: TelegramBot, gameManager: GameManager, adminSecret: string) {
    this.bot = bot;
    this.gameManager = gameManager;
    this.adminSecret = adminSecret;
    this.setupBotCommands();
    this.registerCommands();
  }

  private async setupBotCommands(): Promise<void> {
    try {
      // Set up commands for all users (includes both player and admin commands)
      // Telegram will show all commands, and the bot will handle permissions
      await this.bot.setMyCommands([
        { command: "start", description: "Join the game lobby" },
        { command: "status", description: "View lobby/game status" },
        { command: "left", description: "Leave the lobby" },
        { command: "help", description: "Show help and commands" },
        { command: "distribute", description: "Start game (admin)" },
        { command: "vote", description: "Start voting (admin)" },
        { command: "message", description: "Send message to all (admin)" },
        { command: "settimevote", description: "Set vote time (admin)" },
        { command: "reveal", description: "View topic (admin)" },
        { command: "remove", description: "Remove player (admin)" },
        { command: "end", description: "End game (admin)" },
        { command: "reset", description: "Reset game (admin)" },
        { command: "online", description: "Toggle online mode (admin)" },
        { command: "setlinkgroup", description: "Set group link (admin)" },
      ]);

      console.log("✅ Bot commands set up successfully");
    } catch (error) {
      console.error("Failed to set up bot commands:", error);
    }
  }

  private registerCommands(): void {
    this.bot.onText(/\/password:(.+)/, this.handlePassword.bind(this));
    this.bot.onText(/\/start/, this.handleStart.bind(this));
    this.bot.onText(/\/left/, this.handleLeft.bind(this));
    this.bot.onText(/\/remove/, this.handleRemove.bind(this));
    this.bot.onText(/\/online (true|false)/, this.handleOnline.bind(this));
    this.bot.onText(/\/setlinkgroup/, this.handleSetLinkGroup.bind(this));
    this.bot.onText(/\/distribute/, this.handleDistribute.bind(this));
    this.bot.onText(/\/reveal/, this.handleReveal.bind(this));
    this.bot.onText(/\/voteimposter_(.+)/, this.handleVoteFor.bind(this));
    this.bot.onText(/\/vote$/, this.handleVote.bind(this));
    this.bot.onText(/\/settimevote (\d+)/, this.handleSetTimeVote.bind(this));
    this.bot.onText(/\/message (.+)/, this.handleMessage.bind(this));
    this.bot.onText(/\/end/, this.handleEnd.bind(this));
    this.bot.onText(/\/reset/, this.handleReset.bind(this));
    this.bot.onText(/\/status/, this.handleStatus.bind(this));
    this.bot.onText(/\/help/, this.handleHelp.bind(this));

    // Listen for poll answers
    this.bot.on("poll_answer", this.handlePollAnswer.bind(this));
  }

  // Helper method to send and track bot messages
  private async sendAndTrack(
    chatId: number,
    text: string,
    options?: any
  ): Promise<Message> {
    const sentMessage = await this.bot.sendMessage(chatId, text, options);
    const effectiveChatId = this.gameManager.getEffectiveChatId(
      chatId,
      sentMessage.chat.type
    );
    this.gameManager.trackBotMessage(effectiveChatId, sentMessage.message_id);
    return sentMessage;
  }

  private async handlePassword(
    msg: Message,
    match: RegExpExecArray | null
  ): Promise<void> {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    const userId = msg.from?.id;
    const username = msg.from?.username;
    const firstName = msg.from?.first_name;

    if (!userId) return;

    const effectiveChatId = this.gameManager.getEffectiveChatId(
      chatId,
      chatType
    );
    const providedPassword = match![1].trim();

    try {
      await this.bot.deleteMessage(chatId, msg.message_id);
    } catch (error) {
      console.error("Failed to delete password message:", error);
    }

    if (providedPassword !== this.adminSecret) {
      await this.bot.sendMessage(chatId, "❌ Incorrect password");
      return;
    }

    const alreadyAdmin = await this.gameManager.isAdmin(
      effectiveChatId,
      userId,
      chatType
    );
    if (alreadyAdmin) {
      await this.bot.sendMessage(chatId, "✅ You're already an admin");
      return;
    }

    this.gameManager.promoteAdmin(effectiveChatId, userId);

    const name = username ? `@${username}` : firstName || `User${userId}`;
    await this.bot.sendMessage(
      chatId,
      `🔑 ${name} has been promoted to admin!`
    );

    console.log(
      `🔑 User ${userId} (${name}) promoted to admin in chat ${effectiveChatId}`
    );
  }

  private async handleStart(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    const userId = msg.from?.id;
    const username = msg.from?.username;
    const firstName = msg.from?.first_name;

    if (!userId) return;

    const effectiveChatId = this.gameManager.getEffectiveChatId(
      chatId,
      chatType
    );
    const userIsAdmin = await this.gameManager.isAdmin(
      effectiveChatId,
      userId,
      chatType
    );
    const session = this.gameManager.getOrCreateSession(
      effectiveChatId,
      userIsAdmin ? userId : undefined
    );

    if (userIsAdmin && !session.adminId) {
      session.adminId = userId;
    }

    if (session.started) {
      await this.bot.sendMessage(
        chatId,
        "⏳ Game in progress. Please wait...",
        {
          reply_to_message_id: msg.message_id,
        }
      );
      return;
    }

    const existingPlayer = session.players.find((p) => p.userId === userId);

    if (!existingPlayer) {
      const newPlayer: Player = {
        userId,
        username,
        firstName,
        joinedAt: new Date().toISOString(),
      };
      this.gameManager.addPlayer(effectiveChatId, newPlayer);

      const playerName = username
        ? `@${username}`
        : firstName || `User${userId}`;
      const totalPlayers = session.players.length;
      const imposterCount = this.gameManager.getImposterCount(totalPlayers);
      const minPlayers = session.settings.minPlayers;

      // Create player list
      const playerList = session.players
        .map((p, i) => {
          const name = p.username
            ? `@${p.username}`
            : p.firstName || `User${p.userId}`;
          return `${i + 1}. ${name}`;
        })
        .join("\n");

      let message = `✅ ${playerName} joined the lobby!\n\n`;
      message += `👥 Players in lobby: ${totalPlayers}\n`;
      message += `🎭 Imposters will be: ${imposterCount} (25%)\n`;
      message += `📋 Minimum players to start: ${minPlayers}\n\n`;
      message += `Player List:\n${playerList}\n\n`;

      if (totalPlayers >= minPlayers) {
        message += `✅ Ready to start! Admin can use /distribute\n\n`;
      } else {
        message += `⏳ Waiting for ${
          minPlayers - totalPlayers
        } more player(s)\n\n`;
      }

      if (userIsAdmin) {
        message += `${this.getAdminMenu(session)}`;
      } else {
        message += `${this.getPlayerCommands()}`;
      }

      await this.bot.sendMessage(chatId, message);

      console.log(
        `➕ Player ${username || firstName} joined chat ${effectiveChatId}`
      );
    } else {
      const totalPlayers = session.players.length;

      if (userIsAdmin) {
        await this.bot.sendMessage(
          chatId,
          `✅ Already in lobby (${totalPlayers} players)\n\n${this.getAdminMenu(
            session
          )}`
        );
      } else {
        await this.bot.sendMessage(
          chatId,
          `✅ Already in lobby (${totalPlayers} players)\n\n${this.getPlayerCommands()}`
        );
      }
    }
  }

  private getAdminMenu(session: any): string {
    const totalPlayers = session.players.length;
    const imposterCount = this.gameManager.getImposterCount(totalPlayers);
    const voteTime = session.settings.voteTimeSeconds || 120;
    const onlineMode = session.settings.onlineMode ? "ON" : "OFF";

    return (
      `🎮 Admin Controls\n\n` +
      `Commands:\n` +
      `/distribute - Start game (${totalPlayers} players, ${imposterCount} imposters)\n` +
      `/vote - Start voting to eliminate a player\n` +
      `/settimevote <seconds> - Set vote time (current: ${voteTime}s)\n` +
      `/message <text> - Send message to all lobby members\n` +
      `/online true/false - Toggle online mode (current: ${onlineMode})\n` +
      `/setlinkgroup <link> - Set custom group link for online mode\n` +
      `/remove @username - Remove a player from lobby\n` +
      `/reveal - Show the base topic (admin only)\n` +
      `/end - End current game\n` +
      `/reset - Reset game\n` +
      `/status - View lobby status\n` +
      `/password:<password> - Promote to admin`
    );
  }

  private getPlayerCommands(): string {
    return (
      `📋 Player Commands:\n\n` +
      `/left - Leave the lobby\n` +
      `/status - View lobby status\n` +
      `/help - Show all commands`
    );
  }

  private async handleLeft(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    const userId = msg.from?.id;
    const username = msg.from?.username;
    const firstName = msg.from?.first_name;

    if (!userId) return;

    const effectiveChatId = this.gameManager.getEffectiveChatId(
      chatId,
      chatType
    );
    const session = this.gameManager.getSession(effectiveChatId);

    if (!session) {
      await this.bot.sendMessage(chatId, "❌ No active lobby");
      return;
    }

    if (session.rolesDistributed) {
      await this.bot.sendMessage(chatId, "❌ Cannot leave during active game");
      return;
    }

    const removed = this.gameManager.removePlayer(effectiveChatId, userId);

    if (!removed) {
      await this.bot.sendMessage(chatId, "❌ You're not in the lobby");
      return;
    }

    const name = username ? `@${username}` : firstName || `User${userId}`;
    const totalPlayers = session.players.length;
    const imposterCount = this.gameManager.getImposterCount(totalPlayers);

    // Create updated player list
    const playerList =
      session.players.length > 0
        ? session.players
            .map((p, i) => {
              const pName = p.username
                ? `@${p.username}`
                : p.firstName || `User${p.userId}`;
              return `${i + 1}. ${pName}`;
            })
            .join("\n")
        : "No players in lobby";

    let message = `👋 ${name} left the lobby\n\n`;
    message += `👥 Players remaining: ${totalPlayers}\n`;
    if (totalPlayers > 0) {
      message += `🎭 Imposters will be: ${imposterCount} (25%)\n\n`;
      message += `Player List:\n${playerList}`;
    }

    await this.bot.sendMessage(chatId, message);

    console.log(`👋 Player ${userId} (${name}) left chat ${effectiveChatId}`);

    // If online mode is enabled, remove player from the group
    if (session.settings.onlineMode && chatType !== "private") {
      try {
        await this.bot.banChatMember(chatId, userId);
        await this.bot.unbanChatMember(chatId, userId);
        console.log(`👋 Player ${userId} removed from group (online mode)`);
      } catch (error) {
        console.error(`Failed to remove player from group:`, error);
      }
    }
  }

  private async handleRemove(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    const userId = msg.from?.id;

    if (!userId) return;

    const effectiveChatId = this.gameManager.getEffectiveChatId(
      chatId,
      chatType
    );

    // Check if user is admin
    if (!(await this.gameManager.isAdmin(effectiveChatId, userId, chatType))) {
      await this.bot.sendMessage(chatId, "❌ Admin only command");
      return;
    }

    const session = this.gameManager.getSession(effectiveChatId);

    if (!session) {
      await this.bot.sendMessage(chatId, "❌ No active lobby");
      return;
    }

    if (session.rolesDistributed) {
      await this.bot.sendMessage(
        chatId,
        "❌ Cannot remove players during active game"
      );
      return;
    }

    // Extract username or user ID from the message
    const messageText = msg.text || "";
    const parts = messageText.split(/\s+/);

    if (parts.length < 2) {
      await this.bot.sendMessage(
        chatId,
        "❌ Usage: /remove @username or /remove <user_id>"
      );
      return;
    }

    const target = parts[1];
    let targetUserId: number | undefined;
    let targetPlayer: any;

    // Check if it's a mention (@username)
    if (target.startsWith("@")) {
      const targetUsername = target.substring(1);
      targetPlayer = session.players.find(
        (p) => p.username?.toLowerCase() === targetUsername.toLowerCase()
      );
      if (targetPlayer) {
        targetUserId = targetPlayer.userId;
      }
    } else {
      // Try to parse as user ID
      const parsedId = parseInt(target);
      if (!isNaN(parsedId)) {
        targetUserId = parsedId;
        targetPlayer = session.players.find((p) => p.userId === parsedId);
      }
    }

    if (!targetUserId || !targetPlayer) {
      await this.bot.sendMessage(
        chatId,
        "❌ Player not found in lobby. Use @username or user ID."
      );
      return;
    }

    const removed = this.gameManager.removePlayer(
      effectiveChatId,
      targetUserId
    );

    if (!removed) {
      await this.bot.sendMessage(chatId, "❌ Failed to remove player");
      return;
    }

    const name = targetPlayer.username
      ? `@${targetPlayer.username}`
      : targetPlayer.firstName || `User${targetUserId}`;
    const totalPlayers = session.players.length;
    const imposterCount = this.gameManager.getImposterCount(totalPlayers);

    // Create updated player list
    const playerList =
      session.players.length > 0
        ? session.players
            .map((p, i) => {
              const pName = p.username
                ? `@${p.username}`
                : p.firstName || `User${p.userId}`;
              return `${i + 1}. ${pName}`;
            })
            .join("\n")
        : "No players in lobby";

    let message = `🚫 ${name} was removed from the lobby by admin\n\n`;
    message += `👥 Players remaining: ${totalPlayers}\n`;
    if (totalPlayers > 0) {
      message += `🎭 Imposters will be: ${imposterCount} (25%)\n\n`;
      message += `Player List:\n${playerList}`;
    }

    await this.bot.sendMessage(chatId, message);

    console.log(
      `🚫 Player ${targetUserId} (${name}) removed by admin ${userId} from chat ${effectiveChatId}`
    );

    // If online mode is enabled, remove player from the group
    if (session.settings.onlineMode && chatType !== "private") {
      try {
        await this.bot.banChatMember(chatId, targetUserId);
        await this.bot.unbanChatMember(chatId, targetUserId);
        console.log(
          `🚫 Player ${targetUserId} removed from group (online mode)`
        );
      } catch (error) {
        console.error(`Failed to remove player from group:`, error);
      }
    }
  }

  private async handleOnline(
    msg: Message,
    match: RegExpExecArray | null
  ): Promise<void> {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    const userId = msg.from?.id;

    if (!userId) return;

    const effectiveChatId = this.gameManager.getEffectiveChatId(
      chatId,
      chatType
    );

    if (!(await this.gameManager.isAdmin(effectiveChatId, userId, chatType))) {
      await this.bot.sendMessage(chatId, "❌ Admin only command");
      return;
    }

    const onlineMode = match![1] === "true";
    const session = this.gameManager.getOrCreateSession(effectiveChatId);

    this.gameManager.updateSettings(effectiveChatId, { onlineMode });

    let message = `✅ Online mode ${onlineMode ? "enabled" : "disabled"}\n\n`;

    if (onlineMode) {
      message += `📱 Online Mode Features:\n`;
      message += `• Players receive roles and topic via DM\n`;
      message += `• Group chat link sent to all players\n`;
      message += `• Players removed from group when they /left\n`;
      message += `• Chat history cleared when game ends\n`;
    } else {
      message += `🏠 Offline Mode:\n`;
      message += `• Players receive roles via DM only\n`;
      message += `• No automatic group management\n`;
    }

    await this.bot.sendMessage(chatId, message);
  }

  private async handleSetLinkGroup(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    const userId = msg.from?.id;

    if (!userId) return;

    const effectiveChatId = this.gameManager.getEffectiveChatId(
      chatId,
      chatType
    );

    if (!(await this.gameManager.isAdmin(effectiveChatId, userId, chatType))) {
      await this.bot.sendMessage(chatId, "❌ Admin only command");
      return;
    }

    const messageText = msg.text || "";
    const parts = messageText.split(/\s+/);

    if (parts.length < 2) {
      const session = this.gameManager.getSession(effectiveChatId);
      if (session?.customGroupLink) {
        await this.bot.sendMessage(
          chatId,
          `📱 Current group link:\n${session.customGroupLink}\n\n` +
            `To update: /setlinkgroup <new_link>\n` +
            `To remove: /setlinkgroup clear`
        );
      } else {
        await this.bot.sendMessage(
          chatId,
          `❌ No group link set.\n\n` +
            `Usage: /setlinkgroup <group_link>\n` +
            `Example: /setlinkgroup https://t.me/+abc123`
        );
      }
      return;
    }

    const link = parts[1];
    const session = this.gameManager.getOrCreateSession(effectiveChatId);

    // Check if user wants to clear the link
    if (link.toLowerCase() === "clear") {
      session.customGroupLink = undefined;
      this.gameManager.saveSession(effectiveChatId, session);
      await this.bot.sendMessage(
        chatId,
        "✅ Group link cleared. Bot will auto-generate link when distributing roles."
      );
      return;
    }

    // Validate link format
    if (!link.startsWith("https://t.me/") && !link.startsWith("http://t.me/")) {
      await this.bot.sendMessage(
        chatId,
        "❌ Invalid link format. Must be a Telegram link (https://t.me/...)"
      );
      return;
    }

    session.customGroupLink = link;
    this.gameManager.saveSession(effectiveChatId, session);

    await this.bot.sendMessage(
      chatId,
      `✅ Group link set successfully!\n\n` +
        `📱 Link: ${link}\n\n` +
        `This link will be sent to players when you use /distribute in online mode.`
    );
  }

  private async handleSetPlayers(
    msg: Message,
    match: RegExpExecArray | null
  ): Promise<void> {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    const userId = msg.from?.id;

    if (!userId) return;

    const effectiveChatId = this.gameManager.getEffectiveChatId(
      chatId,
      chatType
    );

    if (!(await this.gameManager.isAdmin(effectiveChatId, userId, chatType))) {
      await this.bot.sendMessage(chatId, "❌ Admin only command");
      return;
    }

    const count = parseInt(match![1]);
    if (isNaN(count) || count < 1 || count > 50) {
      await this.bot.sendMessage(chatId, "❌ Invalid number. Use 1-50");
      return;
    }

    const session = this.gameManager.getOrCreateSession(effectiveChatId);
    if (session.started) {
      await this.bot.sendMessage(
        chatId,
        "❌ Cannot change settings during game"
      );
      return;
    }

    this.gameManager.updateSettings(effectiveChatId, { totalPlayers: count });
    await this.bot.sendMessage(chatId, `✅ Set total players to ${count}`);
  }

  private async handleSetImposters(
    msg: Message,
    match: RegExpExecArray | null
  ): Promise<void> {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    const userId = msg.from?.id;

    if (!userId) return;

    const effectiveChatId = this.gameManager.getEffectiveChatId(
      chatId,
      chatType
    );

    if (!(await this.gameManager.isAdmin(effectiveChatId, userId, chatType))) {
      await this.bot.sendMessage(chatId, "❌ Admin only command");
      return;
    }

    const count = parseInt(match![1]);
    const session = this.gameManager.getOrCreateSession(effectiveChatId);

    if (isNaN(count) || count < 1 || count >= session.settings.totalPlayers) {
      await this.bot.sendMessage(
        chatId,
        `❌ Invalid number. Use 1-${session.settings.totalPlayers - 1}`
      );
      return;
    }

    if (session.started) {
      await this.bot.sendMessage(
        chatId,
        "❌ Cannot change settings during game"
      );
      return;
    }

    this.gameManager.updateSettings(effectiveChatId, { totalImposters: count });
    await this.bot.sendMessage(chatId, `✅ Set imposters to ${count}`);
  }

  private async handleDistribute(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    const userId = msg.from?.id;

    if (!userId) return;

    const effectiveChatId = this.gameManager.getEffectiveChatId(
      chatId,
      chatType
    );

    if (!(await this.gameManager.isAdmin(effectiveChatId, userId, chatType))) {
      await this.bot.sendMessage(chatId, "❌ Admin only command");
      return;
    }

    const session = this.gameManager.getOrCreateSession(effectiveChatId);
    const minPlayers = session.settings.minPlayers;

    if (session.players.length < minPlayers) {
      await this.bot.sendMessage(
        chatId,
        `❌ Need at least ${minPlayers} players to start. Currently: ${session.players.length}`
      );
      return;
    }

    if (session.rolesDistributed) {
      await this.bot.sendMessage(
        chatId,
        "⚠️ Roles already distributed. Use /end first."
      );
      return;
    }

    const totalPlayers = session.players.length;
    const imposterCount = this.gameManager.getImposterCount(totalPlayers);

    const prepMsg = await this.sendAndTrack(
      chatId,
      `🎮 Preparing game...\n\n👥 Players: ${totalPlayers}\n🎭 Imposters: ${imposterCount}\n\n⏳ Please wait...`
    );

    const prepared = await this.gameManager.prepareGame(effectiveChatId);
    if (prepared) {
      // Get group link if online mode is enabled
      let groupLink = "";
      if (session.settings.onlineMode) {
        // Use custom link if set, otherwise auto-generate
        groupLink = session.customGroupLink || "";

        if (!groupLink && chatType !== "private") {
          try {
            const chat = await this.bot.getChat(chatId);
            if ("invite_link" in chat && chat.invite_link) {
              groupLink = chat.invite_link;
              console.log(`📱 Using existing invite link: ${groupLink}`);
            } else {
              // Try to create an invite link
              try {
                groupLink = await this.bot.exportChatInviteLink(chatId);
                console.log(`📱 Created new invite link: ${groupLink}`);
              } catch (error) {
                console.error("Failed to get/create invite link:", error);
                const warnMsg = await this.bot.sendMessage(
                  chatId,
                  "⚠️ Warning: Could not get group link. Make sure bot is admin with 'Invite Users' permission."
                );
                this.gameManager.trackBotMessage(
                  effectiveChatId,
                  warnMsg.message_id
                );
              }
            }
          } catch (error) {
            console.error("Failed to get chat info:", error);
          }
        }

        if (groupLink) {
          console.log(`📱 Will send group link to players: ${groupLink}`);
        } else {
          console.log("⚠️ No group link available to send");
        }
      }

      // Distribute roles with optional group link
      await this.gameManager.distributeRoles(effectiveChatId, groupLink);

      const gameStartMessage =
        `✅ Game started!\n\n` +
        `👥 Total Players: ${totalPlayers}\n` +
        `🎭 Imposters: ${imposterCount}\n\n` +
        `📨 Roles have been sent to all players privately.\n` +
        `🎯 Good luck finding the imposters!`;

      // Send to group
      await this.sendAndTrack(chatId, gameStartMessage);

      // Send to all players privately
      for (const player of session.players) {
        try {
          await this.bot.sendMessage(player.userId, gameStartMessage);
        } catch (error) {
          console.error(
            `Failed to send game start message to user ${player.userId}:`,
            error
          );
        }
      }
    } else {
      await this.sendAndTrack(chatId, "❌ Failed to prepare game");
    }
  }

  private async handleReveal(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    const userId = msg.from?.id;

    if (!userId) return;

    const effectiveChatId = this.gameManager.getEffectiveChatId(
      chatId,
      chatType
    );

    if (!(await this.gameManager.isAdmin(effectiveChatId, userId, chatType))) {
      await this.bot.sendMessage(chatId, "❌ Admin only command");
      return;
    }

    const session = this.gameManager.getSession(effectiveChatId);

    if (!session || !session.started) {
      await this.bot.sendMessage(chatId, "❌ No active game");
      return;
    }

    const revealMsg =
      `🔍 Game Info (Admin)\n\n` +
      `🎯 Topic: ${session.topic}\n` +
      `🎭 Imposters: ${session.imposters.length}`;

    await this.bot.sendMessage(userId, revealMsg);
    await this.bot.sendMessage(chatId, "✅ Topic sent to admin privately");
  }

  private async handleEnd(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    const userId = msg.from?.id;

    if (!userId) return;

    const effectiveChatId = this.gameManager.getEffectiveChatId(
      chatId,
      chatType
    );

    if (!(await this.gameManager.isAdmin(effectiveChatId, userId, chatType))) {
      await this.bot.sendMessage(chatId, "❌ Admin only command");
      return;
    }

    const session = this.gameManager.getSession(effectiveChatId);

    if (!session || !session.started) {
      await this.bot.sendMessage(chatId, "❌ No active game to end");
      return;
    }

    // Check if roles were actually distributed (game really started)
    if (!session.rolesDistributed) {
      await this.bot.sendMessage(
        chatId,
        "❌ Game was not started yet. Use /reset to clear the lobby."
      );
      return;
    }

    const totalPlayers = session.players.length;
    const imposterCount = this.gameManager.getImposterCount(totalPlayers);

    // Capture game data BEFORE endGame clears it
    const gameTopic = session.topic;
    const gameImposters = [...session.imposters];

    // Prepare game results to reveal to all players
    const imposterNames = gameImposters
      .map((userId) => {
        const player = session.players.find((p) => p.userId === userId);
        if (player) {
          return player.username
            ? `@${player.username}`
            : player.firstName || `User${userId}`;
        }
        return `User${userId}`;
      })
      .join(", ");

    const gameResults =
      `🏁 Game Ended - Results\n\n` +
      `🎯 Topic: ${gameTopic}\n` +
      `🎭 Imposters were: ${imposterNames}\n\n` +
      `👥 Total Players: ${totalPlayers}\n` +
      `🎭 Total Imposters: ${gameImposters.length}`;

    console.log(
      `📊 Game results: Topic="${gameTopic}", Imposters=${gameImposters.length}, Players=${totalPlayers}`
    );

    // Now end the game (this clears topic and imposters)
    this.gameManager.endGame(effectiveChatId);

    // Clear bot messages in online mode
    if (session.settings.onlineMode && chatType !== "private") {
      try {
        const clearMsg = await this.bot.sendMessage(
          chatId,
          "🧹 Clearing bot messages..."
        );

        const deletedCount = await this.gameManager.clearBotMessages(
          effectiveChatId
        );

        // Delete the clearing message itself after a short delay
        setTimeout(async () => {
          try {
            await this.bot.deleteMessage(chatId, clearMsg.message_id);
          } catch (error) {
            console.error("Failed to delete clearing message:", error);
          }
        }, 2000);

        console.log(
          `🧹 Cleared ${deletedCount} bot messages in chat ${chatId}`
        );
      } catch (error) {
        console.error("Failed to clear bot messages:", error);
      }
    }

    // Send game results to the group
    await this.sendAndTrack(chatId, gameResults);

    // Send game results to all players privately
    for (const player of session.players) {
      try {
        await this.bot.sendMessage(player.userId, gameResults);
      } catch (error) {
        console.error(
          `Failed to send game results to user ${player.userId}:`,
          error
        );
      }
    }

    await this.sendAndTrack(
      chatId,
      `👥 Players remain in lobby: ${totalPlayers}\n` +
        `🎭 Next game will have ${imposterCount} imposters\n\n` +
        `Use /distribute to start a new game or /reset to clear lobby.`
    );

    console.log(`🏁 Game ended in chat ${effectiveChatId}`);
  }

  private async handleReset(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    const userId = msg.from?.id;

    if (!userId) return;

    const effectiveChatId = this.gameManager.getEffectiveChatId(
      chatId,
      chatType
    );

    if (!(await this.gameManager.isAdmin(effectiveChatId, userId, chatType))) {
      await this.bot.sendMessage(chatId, "❌ Admin only command");
      return;
    }

    this.gameManager.resetGame(effectiveChatId, userId);
    await this.bot.sendMessage(
      chatId,
      "🔄 Game reset! Players can /start to join."
    );
  }

  private async handleStatus(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    const userId = msg.from?.id;

    const effectiveChatId = this.gameManager.getEffectiveChatId(
      chatId,
      chatType
    );
    const session = this.gameManager.getSession(effectiveChatId);

    if (!session) {
      await this.bot.sendMessage(
        chatId,
        "📭 Not in lobby\n\nUse /start to create or join a lobby!"
      );
      return;
    }

    const userIsAdmin = userId
      ? await this.gameManager.isAdmin(effectiveChatId, userId, chatType)
      : false;

    // Check if user is in the lobby
    const userInLobby = userId
      ? session.players.some((p) => p.userId === userId)
      : false;

    const totalPlayers = session.players.length;
    const imposterCount = this.gameManager.getImposterCount(totalPlayers);
    const minPlayers = session.settings.minPlayers;

    // Determine game state
    let gameState = "";
    let gameStateEmoji = "";

    if (!session.started && totalPlayers === 0) {
      gameState = "Not in lobby";
      gameStateEmoji = "📭";
    } else if (!session.started && totalPlayers > 0) {
      gameState = "In lobby";
      gameStateEmoji = "🏠";
    } else if (session.started && !session.rolesDistributed) {
      gameState = "Game prepared";
      gameStateEmoji = "⏳";
    } else if (session.rolesDistributed && session.votingSession?.active) {
      gameState = "In voting";
      gameStateEmoji = "🗳️";
    } else if (session.rolesDistributed) {
      gameState = "In game";
      gameStateEmoji = "🎮";
    } else {
      gameState = "Game ended";
      gameStateEmoji = "🏁";
    }

    // If user is not in lobby and not admin, show different message
    if (!userInLobby && !userIsAdmin && totalPlayers > 0) {
      let statusText = `📭 You are not in the lobby\n\n`;
      statusText += `${gameStateEmoji} Current State: ${gameState}\n`;
      statusText += `👥 Players in lobby: ${totalPlayers}\n\n`;

      if (!session.rolesDistributed) {
        statusText += `Use /start to join the lobby!`;
      } else {
        statusText += `Game is already in progress. Wait for the next round.`;
      }

      await this.bot.sendMessage(chatId, statusText);
      return;
    }

    if (userIsAdmin) {
      const playerList = session.players
        .map((p, i) => {
          const name = p.username
            ? `@${p.username}`
            : p.firstName || `User${p.userId}`;
          const status = p.eliminated ? "❌ Eliminated" : "✅ Active";
          return `${i + 1}. ${name} - ${status}`;
        })
        .join("\n");

      let statusText = `📊 Game Status\n\n`;
      statusText += `${gameStateEmoji} State: ${gameState}\n`;
      if (!userInLobby && totalPlayers > 0) {
        statusText += `⚠️ You are not in the lobby\n`;
      }
      statusText += `\n👥 Players: ${totalPlayers}\n`;
      statusText += `🎭 Imposters: ${imposterCount} (25%)\n`;
      statusText += `📋 Min Players: ${minPlayers}\n`;
      statusText += `⏱️ Vote Time: ${session.settings.voteTimeSeconds}s\n`;
      statusText += `📱 Online Mode: ${
        session.settings.onlineMode ? "✅ Enabled" : "❌ Disabled"
      }\n`;
      if (session.customGroupLink) {
        statusText += `🔗 Custom Group Link: Set\n`;
      }
      statusText += `🔑 Promoted Admins: ${session.promotedAdmins.length}\n\n`;

      if (session.players.length > 0) {
        statusText += `Player List:\n${playerList}\n\n`;
      }

      // Additional state info
      if (session.votingSession?.active) {
        const votes = session.votingSession.votes;
        let voteCount = 0;
        if (votes instanceof Map) {
          voteCount = votes.size;
        } else if (votes) {
          voteCount = Object.keys(votes).length;
        }
        statusText += `🗳️ Voting in progress\n`;
        statusText += `Votes cast: ${voteCount}/${totalPlayers}\n`;
      } else if (session.rolesDistributed) {
        const activePlayers = session.players.filter(
          (p) => !p.eliminated
        ).length;
        const activeImposters = session.players.filter(
          (p) => !p.eliminated && session.imposters.includes(p.userId)
        ).length;
        statusText += `🎮 Game in progress\n`;
        statusText += `Active: ${activePlayers} players, ${activeImposters} imposters`;
      } else if (session.started) {
        statusText += "⏳ Game prepared, ready to distribute";
      } else if (totalPlayers >= minPlayers) {
        statusText += "✅ Ready to start!";
      } else {
        statusText += `⏳ Waiting for ${
          minPlayers - totalPlayers
        } more player(s)`;
      }

      await this.bot.sendMessage(chatId, statusText);
    } else {
      // Create player list for regular players
      const playerList = session.players
        .map((p, i) => {
          const name = p.username
            ? `@${p.username}`
            : p.firstName || `User${p.userId}`;
          const status = p.eliminated ? "❌ Eliminated" : "✅ Active";
          return `${i + 1}. ${name}${
            session.rolesDistributed ? ` - ${status}` : ""
          }`;
        })
        .join("\n");

      let statusText = `📊 Lobby Status\n\n`;
      statusText += `${gameStateEmoji} State: ${gameState}\n\n`;
      statusText += `👥 Players: ${totalPlayers}\n`;
      statusText += `🎭 Imposters: ${imposterCount} (25%)\n\n`;

      if (session.players.length > 0) {
        statusText += `Player List:\n${playerList}\n\n`;
      }

      // State-specific info for players
      if (session.votingSession?.active) {
        statusText += `🗳️ Voting in progress\n`;
        statusText += `Cast your vote using /voteimposter commands`;
      } else if (session.rolesDistributed) {
        const activePlayers = session.players.filter(
          (p) => !p.eliminated
        ).length;
        statusText += `🎮 Game in progress\n`;
        statusText += `Active players: ${activePlayers}`;
      } else if (totalPlayers >= minPlayers) {
        statusText += `✅ Ready to start!\n`;
        statusText += `Waiting for admin to /distribute`;
      } else {
        statusText += `⏳ Need ${minPlayers - totalPlayers} more player(s)`;
      }

      await this.bot.sendMessage(chatId, statusText);
    }
  }

  private async handleSetTimeVote(
    msg: Message,
    match: RegExpExecArray | null
  ): Promise<void> {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    const userId = msg.from?.id;

    if (!userId) return;

    const effectiveChatId = this.gameManager.getEffectiveChatId(
      chatId,
      chatType
    );

    if (!(await this.gameManager.isAdmin(effectiveChatId, userId, chatType))) {
      await this.bot.sendMessage(chatId, "❌ Admin only command");
      return;
    }

    const seconds = parseInt(match![1]);
    if (isNaN(seconds) || seconds < 10 || seconds > 600) {
      await this.bot.sendMessage(
        chatId,
        "❌ Invalid time. Use 10-600 seconds (10s to 10min)"
      );
      return;
    }

    const session = this.gameManager.getOrCreateSession(effectiveChatId);
    this.gameManager.updateSettings(effectiveChatId, {
      voteTimeSeconds: seconds,
    });

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    let timeText = "";

    if (minutes > 0) {
      timeText = `${minutes}min`;
      if (remainingSeconds > 0) {
        timeText += ` ${remainingSeconds}s`;
      }
    } else {
      timeText = `${seconds}s`;
    }

    await this.bot.sendMessage(
      chatId,
      `✅ Vote time set to ${timeText} (${seconds} seconds)`
    );
  }

  private async handleMessage(
    msg: Message,
    match: RegExpExecArray | null
  ): Promise<void> {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    const userId = msg.from?.id;
    const username = msg.from?.username;
    const firstName = msg.from?.first_name;

    if (!userId) return;

    const effectiveChatId = this.gameManager.getEffectiveChatId(
      chatId,
      chatType
    );

    // Check if user is admin
    if (!(await this.gameManager.isAdmin(effectiveChatId, userId, chatType))) {
      await this.bot.sendMessage(chatId, "❌ Admin only command");
      return;
    }

    const session = this.gameManager.getSession(effectiveChatId);

    if (!session) {
      await this.bot.sendMessage(chatId, "❌ No active lobby");
      return;
    }

    if (session.players.length === 0) {
      await this.bot.sendMessage(chatId, "❌ No players in lobby to message");
      return;
    }

    const message = match![1].trim();
    if (!message) {
      await this.bot.sendMessage(
        chatId,
        "❌ Please provide a message. Usage: /message <your message>"
      );
      return;
    }

    const adminName = username ? `@${username}` : firstName || `Admin`;
    const broadcastMessage = `📢 Message from ${adminName}:\n\n${message}`;

    let successCount = 0;
    let failCount = 0;

    // Send message to all players in the lobby
    for (const player of session.players) {
      try {
        await this.bot.sendMessage(player.userId, broadcastMessage);
        successCount++;
      } catch (error) {
        console.error(
          `Failed to send message to user ${player.userId}:`,
          error
        );
        failCount++;
      }
    }

    // Send confirmation to admin
    let confirmationMsg = `✅ Message sent to ${successCount} player(s)`;
    if (failCount > 0) {
      confirmationMsg += ` (${failCount} failed)`;
    }

    await this.bot.sendMessage(chatId, confirmationMsg);

    console.log(
      `📢 Admin ${userId} (${adminName}) sent message to ${successCount} players in chat ${effectiveChatId}`
    );
  }

  private async handleHelp(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    const userId = msg.from?.id;

    if (!userId) return;

    const effectiveChatId = this.gameManager.getEffectiveChatId(
      chatId,
      chatType
    );

    const userIsAdmin = await this.gameManager.isAdmin(
      effectiveChatId,
      userId,
      chatType
    );

    let helpText = `🎮 Imposter Game Bot - Help\n\n`;

    // Player commands (available to everyone)
    helpText += `📋 Player Commands:\n\n`;
    helpText += `/start - Join the game lobby\n`;
    helpText += `/left - Leave the lobby (before game starts)\n`;
    helpText += `/status - View current lobby/game status\n`;
    helpText += `/help - Show this help message\n`;

    // Admin commands (only shown to admins)
    if (userIsAdmin) {
      helpText += `\n🔑 Admin Commands:\n\n`;
      helpText += `/distribute - Start the game and distribute roles\n`;
      helpText += `/vote - Start a voting session to eliminate a player\n`;
      helpText += `/settimevote <seconds> - Set voting time (10-600s)\n`;
      helpText += `/message <text> - Send message to all lobby members\n`;
      helpText += `/online true/false - Toggle online mode features\n`;
      helpText += `/setlinkgroup <link> - Set custom group link\n`;
      helpText += `/remove @username - Remove a player from the lobby\n`;
      helpText += `/reveal - View the game topic privately (admin only)\n`;
      helpText += `/end - End the current game (keeps players in lobby)\n`;
      helpText += `/reset - Reset the entire game (clears all players)\n`;
      helpText += `/password:<password> - Promote yourself to admin\n`;

      helpText += `\n📊 Game Info:\n`;
      helpText += `• Minimum players: 4\n`;
      helpText += `• Imposters: 25% of total players (minimum 1)\n`;
      helpText += `• Players receive roles privately via DM\n`;
      helpText += `• Innocents get the topic, imposters don't\n`;
      helpText += `• Vote to eliminate suspected imposters\n`;
      helpText += `• Innocents win if all imposters are eliminated\n`;
      helpText += `• Imposters win if they equal or outnumber innocents\n`;
    } else {
      helpText += `\n💡 Tip: Contact an admin to get promoted and access more commands!`;
    }

    await this.bot.sendMessage(chatId, helpText);
  }

  private async handleVote(msg: Message): Promise<void> {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    const userId = msg.from?.id;

    if (!userId) return;

    const effectiveChatId = this.gameManager.getEffectiveChatId(
      chatId,
      chatType
    );

    const session = this.gameManager.getSession(effectiveChatId);

    if (!session || !session.rolesDistributed) {
      await this.bot.sendMessage(chatId, "❌ No active game");
      return;
    }

    const userIsAdmin = await this.gameManager.isAdmin(
      effectiveChatId,
      userId,
      chatType
    );

    // Get active (non-eliminated) players
    const activePlayers = session.players.filter((p) => !p.eliminated);

    if (activePlayers.length === 0) {
      await this.bot.sendMessage(chatId, "❌ No players left to vote for");
      return;
    }

    // Admin starts voting session
    if (userIsAdmin) {
      // Check if voting is already active
      if (session.votingSession?.active) {
        await this.bot.sendMessage(chatId, "⚠️ Voting is already in progress!");
        return;
      }

      const voteTimeSeconds = session.settings.voteTimeSeconds || 120;
      const minutes = Math.floor(voteTimeSeconds / 60);
      const remainingSeconds = voteTimeSeconds % 60;
      let timeText = "";

      if (minutes > 0) {
        timeText = `${minutes} minute${minutes > 1 ? "s" : ""}`;
        if (remainingSeconds > 0) {
          timeText += ` ${remainingSeconds} second${
            remainingSeconds > 1 ? "s" : ""
          }`;
        }
      } else {
        timeText = `${voteTimeSeconds} second${voteTimeSeconds > 1 ? "s" : ""}`;
      }

      // Create voting list with clickable commands
      const voteList = activePlayers
        .map((p) => {
          const name = p.username
            ? `@${p.username}`
            : p.firstName || `User${p.userId}`;
          const voteCommand = p.username
            ? `/voteimposter_@${p.username}`
            : `/voteimposter_${p.userId}`;
          return `${voteCommand} - ${name}`;
        })
        .join("\n");

      const voteStartMessage =
        `🗳️ Voting Started!\n\n` +
        `⏱️ You have ${timeText} to vote!\n\n` +
        `Click on a command below to vote:\n${voteList}`;

      // Send to group
      await this.sendAndTrack(chatId, voteStartMessage);

      // Send to all players privately
      for (const player of session.players) {
        try {
          await this.bot.sendMessage(player.userId, voteStartMessage);
        } catch (error) {
          console.error(
            `Failed to send vote notification to user ${player.userId}:`,
            error
          );
        }
      }

      // Initialize voting session
      session.votingSession = {
        active: true,
        pollId: undefined,
        voteCounts: new Map(),
        votes: new Map(), // Track who voted for whom
      };

      this.gameManager.saveSession(effectiveChatId, session);

      // Auto-stop voting after configured time
      setTimeout(async () => {
        await this.processVoteResults(effectiveChatId, chatId);
      }, voteTimeSeconds * 1000);

      return;
    }

    // Non-admin tried to start voting
    await this.bot.sendMessage(
      chatId,
      "❌ Only admins can start voting sessions"
    );
  }

  private async handleVoteFor(
    msg: Message,
    match: RegExpExecArray | null
  ): Promise<void> {
    const chatId = msg.chat.id;
    const chatType = msg.chat.type;
    const userId = msg.from?.id;
    const username = msg.from?.username;
    const firstName = msg.from?.first_name;

    if (!userId) return;

    const effectiveChatId = this.gameManager.getEffectiveChatId(
      chatId,
      chatType
    );

    const session = this.gameManager.getSession(effectiveChatId);

    if (!session || !session.rolesDistributed) {
      await this.bot.sendMessage(chatId, "❌ No active game");
      return;
    }

    // Check if voting is active
    if (!session.votingSession?.active) {
      await this.bot.sendMessage(
        chatId,
        "❌ No voting session is active. Admin must start voting with /vote"
      );
      return;
    }

    // Check if user is a player in the game
    const voter = session.players.find((p) => p.userId === userId);
    if (!voter) {
      await this.bot.sendMessage(chatId, "❌ You're not in this game");
      return;
    }

    // Check if voter is eliminated
    if (voter.eliminated) {
      await this.bot.sendMessage(chatId, "❌ Eliminated players cannot vote");
      return;
    }

    // Get active players
    const activePlayers = session.players.filter((p) => !p.eliminated);

    // Parse the target from the command (e.g., /voteimposter_@username or /voteimposter_123456)
    const target = match![1];
    let targetPlayer: any;

    if (target.startsWith("@")) {
      const targetUsername = target.substring(1);
      targetPlayer = activePlayers.find(
        (p) => p.username?.toLowerCase() === targetUsername.toLowerCase()
      );
    } else {
      // Try to parse as user ID
      const parsedId = parseInt(target);
      if (!isNaN(parsedId)) {
        targetPlayer = activePlayers.find((p) => p.userId === parsedId);
      }
    }

    if (!targetPlayer) {
      await this.bot.sendMessage(
        chatId,
        "❌ Player not found or already eliminated"
      );
      return;
    }

    // Ensure votes is a Map (convert from plain object if needed)
    if (!session.votingSession.votes) {
      session.votingSession.votes = new Map();
    } else if (!(session.votingSession.votes instanceof Map)) {
      // Convert plain object to Map
      const votesObj = session.votingSession.votes as any;
      session.votingSession.votes = new Map(
        Object.entries(votesObj).map(([k, v]) => [parseInt(k), v as number])
      );
    }

    const voterName = voter.username
      ? `@${voter.username}`
      : voter.firstName || `User${voter.userId}`;
    const targetName = targetPlayer.username
      ? `@${targetPlayer.username}`
      : targetPlayer.firstName || `User${targetPlayer.userId}`;

    session.votingSession.votes.set(voter.userId, targetPlayer.userId);
    this.gameManager.saveSession(effectiveChatId, session);

    await this.bot.sendMessage(
      chatId,
      `✅ ${voterName} voted for ${targetName}`
    );
  }

  private async handlePollAnswer(pollAnswer: any): Promise<void> {
    // Note: This is no longer used with command-based voting
  }

  private async processVoteResults(
    effectiveChatId: number,
    chatId: number
  ): Promise<void> {
    try {
      const session = this.gameManager.getSession(effectiveChatId);
      if (!session || !session.votingSession?.active) return;

      session.votingSession.active = false;

      // Count votes
      const voteCounts = new Map<number, number>();
      let votes = session.votingSession.votes || new Map();

      // Ensure votes is a Map (convert from plain object if needed)
      if (!(votes instanceof Map)) {
        const votesObj = votes as any;
        votes = new Map(
          Object.entries(votesObj).map(([k, v]) => [parseInt(k), v as number])
        );
        session.votingSession.votes = votes;
      }

      votes.forEach((targetUserId) => {
        voteCounts.set(targetUserId, (voteCounts.get(targetUserId) || 0) + 1);
      });

      // Find player with most votes
      let maxVotes = 0;
      let eliminatedUserId: number | null = null;

      voteCounts.forEach((count, userId) => {
        if (count > maxVotes) {
          maxVotes = count;
          eliminatedUserId = userId;
        }
      });

      if (!eliminatedUserId || maxVotes === 0) {
        const noVoteMessage =
          "🗳️ Voting ended with no votes. No one was eliminated.";
        await this.sendAndTrack(chatId, noVoteMessage);

        // Send to all players
        for (const player of session.players) {
          try {
            await this.bot.sendMessage(player.userId, noVoteMessage);
          } catch (error) {
            console.error(
              `Failed to send vote results to user ${player.userId}:`,
              error
            );
          }
        }

        this.gameManager.saveSession(effectiveChatId, session);
        return;
      }

      // Get the eliminated player
      const eliminatedPlayer = session.players.find(
        (p) => p.userId === eliminatedUserId
      );
      if (!eliminatedPlayer) return;

      eliminatedPlayer.eliminated = true;

      const playerName = eliminatedPlayer.username
        ? `@${eliminatedPlayer.username}`
        : eliminatedPlayer.firstName || `User${eliminatedPlayer.userId}`;

      const wasImposter = session.imposters.includes(eliminatedPlayer.userId);

      // Send elimination message
      let message = `🗳️ Voting Results:\n\n`;
      message += `${playerName} received ${maxVotes} vote(s) and has been eliminated!\n\n`;

      if (wasImposter) {
        message += `� ${playerName} WAS an imposter! ✅\n\n`;
      } else {
        message += `😇 ${playerName} was NOT an imposter! ❌\n\n`;
      }

      // Check win conditions
      const remainingPlayers = session.players.filter((p) => !p.eliminated);
      const remainingImposters = remainingPlayers.filter((p) =>
        session.imposters.includes(p.userId)
      );
      const remainingInnocent = remainingPlayers.filter(
        (p) => !session.imposters.includes(p.userId)
      );

      if (remainingImposters.length === 0) {
        // Innocents win - show full game results
        const totalPlayers = session.players.length;
        const gameTopic = session.topic;
        const gameImposters = [...session.imposters];

        const imposterNames = gameImposters
          .map((userId) => {
            const player = session.players.find((p) => p.userId === userId);
            if (player) {
              return player.username
                ? `@${player.username}`
                : player.firstName || `User${userId}`;
            }
            return `User${userId}`;
          })
          .join(", ");

        message += `🎉 INNOCENTS WIN! All imposters have been eliminated!\n\n`;
        message += `🏁 Game Results:\n`;
        message += `🎯 Topic: ${gameTopic}\n`;
        message += `🎭 Imposters were: ${imposterNames}\n`;
        message += `👥 Total Players: ${totalPlayers}\n`;
        message += `🎭 Total Imposters: ${gameImposters.length}\n\n`;
        message += `Game Over! Use /reset to start a new game.`;

        session.rolesDistributed = false;
        session.started = false;
      } else if (remainingImposters.length >= remainingInnocent.length) {
        // Imposters win - show full game results
        const totalPlayers = session.players.length;
        const gameTopic = session.topic;
        const gameImposters = [...session.imposters];

        const imposterNames = gameImposters
          .map((userId) => {
            const player = session.players.find((p) => p.userId === userId);
            if (player) {
              return player.username
                ? `@${player.username}`
                : player.firstName || `User${userId}`;
            }
            return `User${userId}`;
          })
          .join(", ");

        message += `😈 IMPOSTERS WIN! Imposters equal or outnumber innocents!\n\n`;
        message += `🏁 Game Results:\n`;
        message += `🎯 Topic: ${gameTopic}\n`;
        message += `🎭 Imposters were: ${imposterNames}\n`;
        message += `👥 Total Players: ${totalPlayers}\n`;
        message += `🎭 Total Imposters: ${gameImposters.length}\n\n`;
        message += `Game Over! Use /reset to start a new game.`;

        session.rolesDistributed = false;
        session.started = false;
      } else {
        message += `📊 Remaining:\n`;
        message += `👥 ${remainingInnocent.length} innocent players\n`;
        message += `🎭 ${remainingImposters.length} imposter(s)\n\n`;
        message += `Admin can use /vote to continue voting.`;
      }

      // Send to group
      await this.sendAndTrack(chatId, message);

      // Send to all players privately
      for (const player of session.players) {
        try {
          await this.bot.sendMessage(player.userId, message);
        } catch (error) {
          console.error(
            `Failed to send vote results to user ${player.userId}:`,
            error
          );
        }
      }

      this.gameManager.saveSession(effectiveChatId, session);
    } catch (error) {
      console.error("Failed to process vote results:", error);
    }
  }

  private async processPollResults(
    effectiveChatId: number,
    chatId: number,
    messageId: number
  ): Promise<void> {
    // This method is deprecated - using command-based voting now
  }
}

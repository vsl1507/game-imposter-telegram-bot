// index.ts
import express from "express";
import dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";
import path from "path";
import { StorageManager } from "./storages/storages";
import { GameManager } from "./services/game.service";
import { BotCommandHandler } from "./bot/commands";
import { createApiRoutes } from "./routes/game.route";

dotenv.config();

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.BOT_GAME_TOKEN || "";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "your_secret_key";
const STORAGE_DIR = path.join(__dirname, "game_data");

// Initialize services
const bot = new TelegramBot(TOKEN, { polling: true });
const storage = new StorageManager(STORAGE_DIR);
const gameManager = new GameManager(storage, bot);

// Initialize bot commands
new BotCommandHandler(bot, gameManager, ADMIN_SECRET);

// Initialize Express app
const app = express();
app.use(express.json());

// Register API routes
app.use("/api", createApiRoutes(bot, gameManager, ADMIN_SECRET));

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Bot is active and listening for commands`);
  console.log(`💾 Storage directory: ${STORAGE_DIR}`);
  console.log(
    `🎮 Loaded ${gameManager.getActiveSessionsCount()} active game sessions`
  );
});

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down gracefully...");
  bot.stopPolling();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Shutting down gracefully...");
  bot.stopPolling();
  process.exit(0);
});

// apiRoutes.ts
import { Router, Request, Response } from "express";
import TelegramBot from "node-telegram-bot-api";
import { GameManager } from "../services/game.service";

export function createApiRoutes(
  bot: TelegramBot,
  gameManager: GameManager,
  adminSecret: string
): Router {
  const router = Router();

  router.post("/distribute", async (req: Request, res: Response) => {
    const { chatId, secret } = req.body;

    if (secret !== adminSecret) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!chatId) {
      return res.status(400).json({ error: "chatId is required" });
    }

    const session = gameManager.getOrCreateSession(chatId);

    if (session.players.length < session.settings.totalPlayers) {
      return res.status(400).json({
        error: "Not enough players",
        currentPlayers: session.players.length,
        requiredPlayers: session.settings.totalPlayers,
      });
    }

    if (session.rolesDistributed) {
      return res.status(400).json({ error: "Roles already distributed" });
    }

    try {
      await bot.sendMessage(chatId, "🎮 Admin API triggered game start!");
      const prepared = await gameManager.prepareGame(chatId);

      if (prepared) {
        await gameManager.distributeRoles(chatId);
        return res.json({
          success: true,
          message: "Roles distributed successfully",
          players: session.players.length,
          imposters: session.imposters.length,
        });
      } else {
        return res.status(500).json({ error: "Failed to prepare game" });
      }
    } catch (error) {
      console.error("API distribute error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  router.post("/reset", async (req: Request, res: Response) => {
    const { chatId, secret } = req.body;

    if (secret !== adminSecret) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!chatId) {
      return res.status(400).json({ error: "chatId is required" });
    }

    try {
      gameManager.resetGame(chatId);
      await bot.sendMessage(
        chatId,
        "🔄 Game reset via API! Players can /start to join."
      );

      return res.json({
        success: true,
        message: "Game reset successfully",
      });
    } catch (error) {
      console.error("API reset error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/status/:chatId", async (req: Request, res: Response) => {
    const { chatId } = req.params;
    const { secret } = req.query;

    if (secret !== adminSecret) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const session = gameManager.getSession(parseInt(chatId));

    if (!session) {
      return res.status(404).json({ error: "No active session found" });
    }

    return res.json({
      chatId: session.chatId,
      players: session.players.length,
      totalPlayers: session.settings.totalPlayers,
      imposters: session.settings.totalImposters,
      started: session.started,
      rolesDistributed: session.rolesDistributed,
      topic: session.topic,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
  });

  router.get("/health", (req: Request, res: Response) => {
    res.json({
      status: "ok",
      activeSessions: gameManager.getActiveSessionsCount(),
      uptime: process.uptime(),
    });
  });

  return router;
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookRoute = webhookRoute;
const express_1 = require("express");
function webhookRoute(bot) {
    const router = (0, express_1.Router)();
    router.post("/telegram", async (req, res) => {
        const message = req.body.message;
        if (!message)
            return res.sendStatus(200);
        const chatId = message.chat.id;
        const text = message.text;
        if (text === "/start") {
            await bot.sendMessage(chatId, `Hello Kon PaPa!`);
        }
        else {
            await bot.sendMessage(chatId, `You said: ${text}`);
        }
        res.sendStatus(200);
    });
    return router;
}

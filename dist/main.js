"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const { app, bot } = (0, app_1.createApp)();
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    if (WEBHOOK_URL) {
        await bot.setWebhook(`${WEBHOOK_URL}/webhook/telegram`);
        console.log("✅ Telegram webhook set");
    }
});

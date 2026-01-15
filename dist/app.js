"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const telegram_service_1 = require("./bot/telegram.service");
const webhook_route_1 = require("./routes/webhook.route");
dotenv_1.default.config();
function createApp() {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    const bot = new telegram_service_1.TelegramService(process.env.BOT_TOKEN);
    app.use("/webhook", (0, webhook_route_1.webhookRoute)(bot));
    return { app, bot };
}

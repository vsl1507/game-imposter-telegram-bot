"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramService = void 0;
const axios_1 = __importDefault(require("axios"));
class TelegramService {
    constructor(token) {
        this.token = token;
        this.apiUrl = `https://api.telegram.org/bot${token}`;
    }
    async sendMessage(chatId, text) {
        return axios_1.default.post(`${this.apiUrl}/sendMessage`, {
            chat_id: chatId,
            text,
        });
    }
    async setWebhook(url) {
        return axios_1.default.post(`${this.apiUrl}/setWebhook`, {
            url,
        });
    }
}
exports.TelegramService = TelegramService;

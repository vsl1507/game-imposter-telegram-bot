# 🎮 Imposter Game Bot

A Telegram bot for playing the Imposter game - a social deduction game where players try to identify the imposters among them.

## 📋 Game Overview

The Imposter Game is similar to games like Mafia or Among Us. Players are divided into two groups:

- **Innocents**: Receive a secret topic and must discuss it to find the imposters
- **Imposters**: Don't know the topic and must blend in without being discovered

### Win Conditions

- **Innocents win** if all imposters are eliminated through voting
- **Imposters win** if they equal or outnumber the innocent players

## ✨ Features

- 🎯 Automatic role distribution (25% imposters)
- 🤖 AI-powered specific topic generation (optional, via Ollama)
- 🗳️ Voting system with clickable commands
- 👥 Minimum 4 players to start
- 📱 Online/Offline mode support
- 💬 Admin broadcast messaging
- ⏱️ Configurable voting time
- 🔗 Custom group link support
- 📊 Real-time game status tracking
- 🎭 Automatic game results reveal

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A Telegram Bot Token (from [@BotFather](https://t.me/botfather))

### Installation

1. Clone the repository:

```bash
git clone <your-repo-url>
cd telegram-bot
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory:

```env
BOT_GAME_TOKEN=your_telegram_bot_token_here
ADMIN_SECRET=your_secret_password_for_admin_promotion
PORT=3000
```

4. Build the project:

```bash
npm run build
```

5. Start the bot:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## 🎮 How to Play

### For Players

1. **Join the lobby**: Send `/start` in the group or bot chat
2. **Wait for game**: Minimum 4 players needed
3. **Receive role**: Bot will DM you privately with your role
   - Innocents get the secret topic
   - Imposters don't receive the topic
4. **Discuss**: Talk about the topic (or pretend to know it!)
5. **Vote**: When admin starts voting, click on `/voteimposter_@username` commands
6. **Win**: Eliminate all imposters or survive as an imposter!

### For Admins

#### Setup Commands

- `/password:<your_secret>` - Promote yourself to admin
- `/online true/false` - Toggle online mode features
- `/setlinkgroup <link>` - Set custom group invite link
- `/settimevote <seconds>` - Set voting duration (10-600s)

#### Game Commands

- `/distribute` - Start the game and distribute roles
- `/vote` - Start a voting session
- `/message <text>` - Send message to all players
- `/reveal` - View the topic privately (admin only)
- `/end` - End game and show results
- `/reset` - Reset entire game and clear lobby

#### Management Commands

- `/remove @username` - Remove a player from lobby
- `/status` - View detailed game status

## 📱 Command Reference

### Player Commands

| Command   | Description                          |
| --------- | ------------------------------------ |
| `/start`  | Join the game lobby                  |
| `/left`   | Leave the lobby (before game starts) |
| `/status` | View current lobby/game status       |
| `/help`   | Show help message with all commands  |

### Admin Commands

| Command                   | Description                                 |
| ------------------------- | ------------------------------------------- |
| `/distribute`             | Start game and distribute roles             |
| `/vote`                   | Start voting session to eliminate a player  |
| `/voteimposter_@username` | Vote for a specific player (auto-generated) |
| `/message <text>`         | Broadcast message to all lobby members      |
| `/settimevote <seconds>`  | Set voting time (10-600 seconds)            |
| `/reveal`                 | View the game topic privately               |
| `/remove @username`       | Remove a player from the lobby              |
| `/end`                    | End current game (keeps players in lobby)   |
| `/reset`                  | Reset entire game (clears all players)      |
| `/online true/false`      | Toggle online mode features                 |
| `/setlinkgroup <link>`    | Set custom group link for online mode       |
| `/status`                 | View detailed lobby/game status             |

## 🎯 Game Modes

### Offline Mode (Default)

- Players receive roles via DM
- No automatic group management
- Simple and straightforward

### Online Mode

- Players receive roles and topic via DM
- Group chat link sent to all players
- Players removed from group when they leave
- Chat history can be cleared when game ends
- Better for organized gameplay

## 🔧 Configuration

### Environment Variables

```env
# Required
BOT_GAME_TOKEN=your_bot_token          # Get from @BotFather
ADMIN_SECRET=your_admin_password       # Secret for admin promotion

# Optional
PORT=3000                              # API server port (default: 3000)

# Ollama AI (Optional)
OLLAMA_ENABLED=true                    # Enable AI topic generation
OLLAMA_URL=http://localhost:11434      # Ollama server URL
OLLAMA_MODEL=llama3.2                  # Ollama model to use
```

### Ollama Integration (Optional)

The bot can use Ollama AI to generate more specific topics from base categories:

**Without Ollama (default):**

- Topic: "អាហារ" (food - generic)

**With Ollama enabled:**

- Category: "អាហារ" (food)
- Generated Topic: "សាច់អាំង" (grilled meat) or "សម្លកកូរ" (Khmer curry)

**Setup Ollama:**

1. Install Ollama from [ollama.ai](https://ollama.ai)
2. Pull a model: `ollama pull llama3.2`
3. Set environment variables:
   ```env
   OLLAMA_ENABLED=true
   OLLAMA_URL=http://localhost:11434
   OLLAMA_MODEL=llama3.2
   ```
4. Restart the bot

If Ollama fails or is disabled, the bot automatically falls back to using base categories.

### Game Settings

Default settings (can be changed via commands):

- **Minimum Players**: 4
- **Imposter Ratio**: 25% (minimum 1)
- **Vote Time**: 120 seconds (2 minutes)
- **Online Mode**: Disabled

## 📁 Project Structure

```
src/
├── bot/
│   └── commands.ts          # Bot command handlers
├── constants/
│   └── constants.ts         # Game constants and topics
├── game_data/
│   └── session_0.json       # Saved game sessions
├── routes/
│   └── game.route.ts        # API routes for game control
├── services/
│   └── game.service.ts      # Game logic and management
├── storages/
│   └── storages.ts          # Session storage manager
├── types/
│   └── type.ts              # TypeScript type definitions
└── games.ts                 # Main entry point
```

## 🛠️ API Endpoints

The bot also provides REST API endpoints for external control:

### POST `/api/distribute`

Start game and distribute roles

```json
{
  "chatId": 123456789,
  "secret": "your_admin_secret"
}
```

### POST `/api/reset`

Reset the game

```json
{
  "chatId": 123456789,
  "secret": "your_admin_secret"
}
```

### GET `/api/status/:chatId?secret=your_secret`

Get game status

### GET `/api/health`

Check bot health and active sessions

## 🎨 Customization

### Adding New Topics

Edit `src/constants/constants.ts`:

```typescript
export const BASE_TOPICS = [
  "Your Topic 1",
  "Your Topic 2",
  "Your Topic 3",
  // Add more topics...
];
```

### Changing Game Rules

Edit `src/services/game.service.ts`:

```typescript
// Change imposter ratio (currently 25%)
const imposterCount = Math.max(1, Math.floor(totalPlayers * 0.25));

// Change minimum players (currently 4)
minPlayers: 4;
```

## 🐛 Troubleshooting

### Bot doesn't respond

- Check if bot token is correct in `.env`
- Ensure bot is running (`npm start`)
- Verify bot has permission to read messages in group

### Players don't receive DMs

- Players must start a private chat with the bot first
- Use `/start` in private chat with the bot

### Voting commands don't work

- Make sure voting session is active (admin uses `/vote`)
- Check that player is not eliminated
- Verify player is in the game

### Admin commands not working

- Use `/password:<secret>` to promote yourself
- Or be a Telegram group administrator

## 📝 Development

### Build

```bash
npm run build
```

### Development mode with auto-reload

```bash
npm run dev
```

### Type checking

```bash
npx tsc --noEmit
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- Built with [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)
- Inspired by social deduction games like Mafia and Among Us

## 📞 Support

If you encounter any issues or have questions:

1. Check the troubleshooting section
2. Review the command reference
3. Open an issue on GitHub

---

Made with ❤️ for Telegram game enthusiasts

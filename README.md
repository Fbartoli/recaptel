# RecapTel

Telegram daily digest app — reads your messages and delivers a daily summary via LLM.

## Features

- Connects to your Telegram **user account** via official TDLib to read all your chats
- Incrementally ingests messages with per-chat cursors (no duplicates)
- Generates a daily digest using an LLM (OpenRouter/Claude by default, OpenAI-compatible)
- Delivers the digest to you via Telegram bot message
- Configurable chat allow/block lists for privacy control
- Multi-user support for SaaS deployments
- Runs on a schedule (every 30min ingest, daily digest)

## Prerequisites

- Node.js 20+
- A Telegram account
- Telegram API credentials (see below)
- A Telegram bot (for sending digests)
- An LLM API key (OpenRouter recommended, or any OpenAI-compatible provider)

## Getting Telegram Credentials

### 1. API ID and Hash (for reading messages)

1. Go to https://my.telegram.org
2. Log in with your phone number
3. Click "API development tools"
4. Create a new application (any name/description)
5. Copy the `api_id` and `api_hash`

### 2. Bot Token (for sending digests)

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the prompts
3. Copy the bot token
4. **Important**: Start a conversation with your bot (send it any message)
5. Get your chat ID by messaging [@userinfobot](https://t.me/userinfobot)

## Setup

```bash
# Clone/download the project
cd recaptel

# Install dependencies
npm install

# Copy environment template and fill in your values
cp .env.example .env
# Edit .env with your credentials
```

### Environment Variables

Create a `.env` file with:

```bash
# Telegram API credentials (from my.telegram.org)
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=your_api_hash_here

# Telegram Bot for sending digests
TELEGRAM_BOT_TOKEN=PASTE_BOT_TOKEN_HERE
TELEGRAM_DIGEST_CHAT_ID=PASTE_CHAT_ID_HERE

# LLM API (OpenRouter by default, works with Claude and many models)
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=PASTE_OPENROUTER_API_KEY_HERE
LLM_MODEL=openrouter/auto

# Optional OpenRouter headers (for attribution/analytics)
# OPENROUTER_SITE_URL=https://your-site.com
# OPENROUTER_APP_NAME=RecapTel

# Timezone and digest schedule
TIMEZONE=UTC
DIGEST_HOUR_LOCAL=9

# Optional: comma-separated chat IDs to include (empty = all)
CHAT_ALLOWLIST=

# Optional: comma-separated chat IDs to exclude
CHAT_BLOCKLIST=

# Optional: ingest limits (tune for large accounts)
INGEST_DIALOG_LIMIT=500
INGEST_MESSAGES_PER_CHAT=500

# Optional: storage paths (defaults shown)
DB_PATH=data/recaptel.db
TDLIB_DATA_DIR=data/tdlib
```

## LLM Provider: OpenRouter

RecapTel uses [OpenRouter](https://openrouter.ai) by default, which provides access to Claude, GPT-4, and many other models through a single API.

1. Create an account at https://openrouter.ai
2. Get your API key from https://openrouter.ai/keys
3. Set `LLM_API_KEY` in your `.env` to your OpenRouter key

The default model `openrouter/auto` lets OpenRouter pick the best model for each request. You can also specify a model directly:

- `anthropic/claude-3.5-sonnet` — Claude 3.5 Sonnet (recommended)
- `anthropic/claude-3.5-haiku` — Claude 3.5 Haiku (faster/cheaper)
- `openai/gpt-4o-mini` — GPT-4o Mini
- See all models at https://openrouter.ai/models

### Using other providers

RecapTel works with any OpenAI-compatible API. To use OpenAI directly:

```bash
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini
```

## First Run — Login

Before the app can read messages, you need to authenticate with Telegram via TDLib:

```bash
npm run login
```

This will:
1. Ask for your phone number (with country code)
2. Send you a code on Telegram
3. Ask for the code (and 2FA password if enabled)
4. Save TDLib session data to `data/tdlib/default/`

### Multi-user mode

For multi-user deployments, specify a user ID:

```bash
npm run login -- -u user123
npm run ingest -- -u user123
npm run digest -- -u user123
```

Each user gets their own TDLib data directory under `data/tdlib/<userId>/`.

## Commands

```bash
# Login to Telegram (first time setup)
npm run login
npm run login -- -u <userId>    # multi-user

# Check auth status
npx tsx src/index.ts auth-status
npx tsx src/index.ts auth-status -u <userId>

# Logout
npx tsx src/index.ts logout
npx tsx src/index.ts logout -u <userId>

# Fetch new messages from all chats
npm run ingest
npm run ingest -- -u <userId>   # multi-user

# Fetch messages without storing (see what would be ingested)
npm run ingest -- --dry-run

# Generate and send daily digest
npm run digest
npm run digest -- -u <userId>   # multi-user

# Generate digest without sending
npm run digest -- --dry-run

# Send a test message to verify bot config
npm run send-test

# Run the scheduler (continuous operation)
npm start
npm run dev  # with tsx for development
```

## Running as a Service

### Using systemd (Linux)

Create `/etc/systemd/system/recaptel.service`:

```ini
[Unit]
Description=RecapTel Telegram Digest
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/recaptel
ExecStart=/usr/bin/node dist/index.js run
Restart=on-failure
EnvironmentFile=/path/to/recaptel/.env

[Install]
WantedBy=multi-user.target
```

Then:

```bash
npm run build
sudo systemctl enable recaptel
sudo systemctl start recaptel
```

### Using cron

If you prefer cron instead of the built-in scheduler:

```bash
# Ingest every 30 minutes
*/30 * * * * cd /path/to/recaptel && node dist/index.js ingest >> /var/log/recaptel.log 2>&1

# Send digest at 9am
0 9 * * * cd /path/to/recaptel && node dist/index.js digest >> /var/log/recaptel.log 2>&1
```

### Using Docker

```bash
docker build -t recaptel .
docker run -d --name recaptel \
  --env-file .env \
  -v ./data:/app/data \
  recaptel
```

The Docker image includes prebuilt TDLib binaries. The `/app/data` volume persists:
- SQLite database (`recaptel.db`)
- TDLib session data (`tdlib/<userId>/`)

## Privacy & Security

- Messages are stored locally in SQLite (`data/recaptel.db`)
- Only message metadata + text is stored (no media files)
- TDLib session data is stored per-user in `data/tdlib/<userId>/`
- Use `CHAT_BLOCKLIST` to exclude sensitive chats
- Keep your `.env` and `data/` directory secure
- TDLib session files grant access to the user's Telegram account

## Troubleshooting

### "User is not logged in"

Run `npm run login` first (or `npm run login -- -u <userId>` for multi-user).

### Bot can't send messages

1. Make sure you've started a conversation with your bot
2. Verify `TELEGRAM_DIGEST_CHAT_ID` is your user ID (not the bot's ID)
3. Run `npm run send-test` to debug

### Rate limits / Flood waits

TDLib handles flood waits automatically. If you have many chats, initial ingest may be slow. Consider reducing `INGEST_DIALOG_LIMIT` and `INGEST_MESSAGES_PER_CHAT` for the first run.

## License

MIT

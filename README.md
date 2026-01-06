# RecapTel

Telegram daily digest app — reads your messages and delivers a daily summary via LLM.

## Features

- Connects to your Telegram **user account** (not just a bot) to read all your chats
- Incrementally ingests messages with per-chat cursors (no duplicates)
- Generates a daily digest using an LLM (OpenAI-compatible API)
- Delivers the digest to you via Telegram bot message
- Configurable chat allow/block lists for privacy control
- Runs on a schedule (every 30min ingest, daily digest)

## Prerequisites

- Node.js 18+
- A Telegram account
- Telegram API credentials (see below)
- A Telegram bot (for sending digests)
- An LLM API key (OpenAI or compatible)

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
# Telegram user account (GramJS / MTProto)
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=abcdef1234567890abcdef1234567890

# GramJS session string (generated after first login)
TELEGRAM_SESSION=

# Telegram Bot for sending digests
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_DIGEST_CHAT_ID=123456789

# LLM API (OpenAI-compatible)
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini

# Timezone and digest schedule
TIMEZONE=UTC
DIGEST_HOUR_LOCAL=9

# Optional: comma-separated chat IDs to include (empty = all)
CHAT_ALLOWLIST=

# Optional: comma-separated chat IDs to exclude
CHAT_BLOCKLIST=
```

## First Run — Login

Before the app can read messages, you need to authenticate with Telegram:

```bash
npm run login
```

This will:
1. Ask for your phone number
2. Send you a code on Telegram
3. Ask for the code (and 2FA password if enabled)
4. Save the session to `data/session.txt`

After login, you can also copy the session string to `TELEGRAM_SESSION` in `.env` for portability.

## Commands

```bash
# Login to Telegram (first time setup)
npm run login

# Fetch new messages from all chats
npm run ingest

# Fetch messages without storing (see what would be ingested)
npm run ingest -- --dry-run

# Generate and send daily digest
npm run digest

# Generate digest without sending
npm run digest -- --dry-run

# Send a test message to verify bot config
npm run send-test

# Run the scheduler (continuous operation)
npm start
# or
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

## Privacy & Security

- Messages are stored locally in SQLite (`data/recaptel.db`)
- Only message metadata + text is stored (no media files)
- Use `CHAT_BLOCKLIST` to exclude sensitive chats
- Keep your `.env` and `data/` directory secure
- The session file grants full access to your Telegram account

## Troubleshooting

### "No session found"

Run `npm run login` first.

### Bot can't send messages

1. Make sure you've started a conversation with your bot
2. Verify `TELEGRAM_DIGEST_CHAT_ID` is your user ID (not the bot's ID)
3. Run `npm run send-test` to debug

### Rate limits

Telegram has rate limits. The ingest process is designed to be gentle, but if you have many chats, initial ingest may be slow.

## License

MIT


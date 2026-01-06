# RecapTel Web

Next.js frontend for RecapTel — the Telegram daily digest SaaS.

## Quick Start

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Generate AUTH_SECRET
echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env

# Create database directory
mkdir -p data

# Push schema to SQLite
npm run db:push

# Start dev server
npm run dev
```

Open http://localhost:3000

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | No | SQLite file path (default: `data/recaptel-web.db`) |
| `AUTH_SECRET` | Yes | Random secret for session encryption |
| `AUTH_RESEND_KEY` | Yes | Resend API key for magic link emails |
| `AUTH_EMAIL_FROM` | No | Sender address (default: `onboarding@resend.dev` for testing) |
| `AUTH_URL` | No | Base URL (default: `http://localhost:3000`) |

## Email Setup

### Development (no domain verification needed)
By default, emails are sent from `onboarding@resend.dev` (Resend's test sender).
You only need a Resend API key — no domain verification required.

### Production
1. Add and verify your domain at https://resend.com/domains
2. Set `AUTH_EMAIL_FROM=RecapTel <noreply@yourdomain.com>` in your `.env`

## Database

Uses SQLite by default for simplicity. The database file is stored at `data/recaptel-web.db`.

```bash
# View/edit data
npm run db:studio

# Generate migrations after schema changes
npm run db:generate

# Apply migrations
npm run db:migrate

# Push schema directly (dev)
npm run db:push
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Push schema to database |
| `npm run db:studio` | Open Drizzle Studio |

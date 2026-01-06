#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== RecapTel Database Setup ==="
echo ""

cd "$PROJECT_DIR"

# Check if containers are running
if ! docker compose ps --status running | grep -q "recaptel-web"; then
  echo "Error: Web container is not running."
  echo "Please run 'docker compose up -d' first."
  exit 1
fi

# Wait for web to be healthy
echo "Waiting for web container to be healthy..."
timeout 60 bash -c 'until docker compose ps web 2>/dev/null | grep -q "healthy"; do sleep 2; done' || {
  echo "Warning: Web container health check timed out, continuing anyway..."
}

# Method 1: Use Drizzle if web/node_modules exists (host-based)
if [ -d "web/node_modules" ] && [ -f "web/node_modules/.bin/drizzle-kit" ]; then
  echo "Found Drizzle in web/node_modules, using db:push..."
  cd web
  npm run db:push
  echo ""
  echo "Database schema applied via Drizzle!"
  exit 0
fi

# Method 2: Use bundled SQL file via container
echo "Drizzle not available on host, using SQL fallback..."

if [ ! -f "sql/init-web.sql" ]; then
  echo "Error: sql/init-web.sql not found!"
  exit 1
fi

# Create data directory if needed
docker compose exec -T web sh -c "mkdir -p /app/data"

# Apply SQL schema using Node.js (since sqlite3 binary isn't available)
docker compose exec -T web node -e "
const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = '/app/data/recaptel-web.db';
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Read and execute SQL from stdin
let sql = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { sql += chunk; });
process.stdin.on('end', () => {
  try {
    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      if (stmt.trim()) {
        try {
          db.exec(stmt);
        } catch (e) {
          // Ignore 'already exists' errors for idempotency
          if (!e.message.includes('already exists')) {
            console.error('SQL Error:', e.message);
          }
        }
      }
    }
    console.log('Schema applied successfully!');
    db.close();
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
});
" < sql/init-web.sql

echo ""
echo "Database schema applied via SQL!"
echo ""
echo "You can now login at http://localhost:3000/login"


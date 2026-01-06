import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const patterns = [
  { name: "OpenAI-style API key", re: /\bsk-[A-Za-z0-9]{10,}\b/g },
  { name: "Telegram bot token", re: /\b\d{6,}:[A-Za-z0-9_-]{20,}\b/g },
];

const suspiciousEnvAssignments = [
  "TELEGRAM_API_HASH",
  "TELEGRAM_SESSION",
  "TELEGRAM_BOT_TOKEN",
  "LLM_API_KEY",
];

function run(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function listFilesToScan() {
  const staged = run("git diff --cached --name-only");
  const stagedFiles = staged ? staged.split("\n").filter(Boolean) : [];
  if (stagedFiles.length > 0) return stagedFiles;

  const tracked = run("git ls-files");
  return tracked.split("\n").filter(Boolean);
}

function isTextFile(path) {
  // crude but practical: skip common binaries
  return !/\.(png|jpe?g|gif|webp|pdf|zip|gz|tar|sqlite|db)$/i.test(path);
}

function isAllowedPlaceholder(line) {
  return (
    line.includes("PASTE_BOT_TOKEN_HERE") ||
    line.includes("PASTE_CHAT_ID_HERE") ||
    line.includes("PASTE_LLM_API_KEY_HERE") ||
    line.includes("your_api_hash_here")
  );
}

function scanContent(path, content) {
  const findings = [];

  for (const p of patterns) {
    const matches = content.match(p.re);
    if (matches?.length) {
      findings.push({ path, kind: p.name, count: matches.length });
    }
  }

  const isEnvLike = path === ".env" || path.startsWith(".env.");
  if (isEnvLike) {
    for (const key of suspiciousEnvAssignments) {
      const re = new RegExp(`^\\s*${key}\\s*=\\s*(.+)\\s*$`, "m");
      const m = content.match(re);
      if (m) {
        const value = m[1]?.trim();
        if (value && value !== '""' && value !== "''" && !isAllowedPlaceholder(m[0])) {
          findings.push({ path, kind: `Non-empty ${key}`, count: 1 });
        }
      }
    }
  }

  return findings;
}

function main() {
  const files = listFilesToScan().filter(isTextFile);

  const findings = [];
  for (const file of files) {
    if (file === ".env" || file.startsWith("data/")) continue;
    let content = "";
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    findings.push(...scanContent(file, content));
  }

  if (findings.length > 0) {
    console.error("Potential secrets detected:");
    for (const f of findings) {
      console.error(`- ${f.kind}: ${f.path} (${f.count})`);
    }
    process.exit(1);
  }
}

main();



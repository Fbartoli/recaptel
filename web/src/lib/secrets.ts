import { readFileSync, existsSync } from "fs";

export function readSecret(name: string, envFallback?: string): string | undefined {
  const secretPath = `/run/secrets/${name}`;
  
  if (existsSync(secretPath)) {
    try {
      return readFileSync(secretPath, "utf8").trim();
    } catch {
      // Fall through to env
    }
  }
  
  return envFallback;
}

export function getAuthSecret(): string {
  const secret = readSecret("auth_secret", process.env.AUTH_SECRET);
  if (!secret) {
    throw new Error("AUTH_SECRET is required (via Docker secret or environment variable)");
  }
  return secret;
}

export function getResendKey(): string | undefined {
  return readSecret("auth_resend_key", process.env.AUTH_RESEND_KEY);
}


import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(`telegram:status:${session.user.id}`, { windowMs: 60_000, maxRequests: 60 });
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit.resetAt);
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const stateMessages: Record<string, string> = {
    disconnected: "Not connected to Telegram",
    awaiting_phone: "Enter your phone number with country code",
    awaiting_code: "Enter the verification code from Telegram",
    awaiting_password: "Enter your 2FA password",
    ready: "Connected to Telegram",
  };

  return NextResponse.json({
    state: user.telegramAuthState || "disconnected",
    message: stateMessages[user.telegramAuthState || "disconnected"] || "Unknown state",
    telegramConnectedAt: user.telegramConnectedAt,
    lastIngestAt: user.lastIngestAt,
    lastDigestAt: user.lastDigestAt,
  });
}


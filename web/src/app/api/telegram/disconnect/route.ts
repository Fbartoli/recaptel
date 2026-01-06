import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { publishAuthCommand } from "@/lib/redis";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(`telegram:disconnect:${session.user.id}`, { windowMs: 60_000, maxRequests: 5 });
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit.resetAt);
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.telegramAuthState === "disconnected") {
    return NextResponse.json({ error: "Not connected" }, { status: 400 });
  }

  await publishAuthCommand(session.user.id, { type: "DISCONNECT" });

  await db
    .update(users)
    .set({
      telegramAuthState: "disconnected",
      telegramConnectedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ 
    success: true, 
    message: "Disconnected from Telegram" 
  });
}


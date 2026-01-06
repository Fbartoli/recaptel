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

  const rateLimit = checkRateLimit(`telegram:connect:${session.user.id}`, { windowMs: 60_000, maxRequests: 5 });
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit.resetAt);
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.telegramAuthState === "ready") {
    return NextResponse.json({ error: "Already connected" }, { status: 400 });
  }

  await db
    .update(users)
    .set({
      telegramAuthState: "awaiting_phone",
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  await publishAuthCommand(session.user.id, { type: "CONNECT" });

  return NextResponse.json({ 
    success: true, 
    state: "awaiting_phone",
    message: "Enter your phone number with country code" 
  });
}


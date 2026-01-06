import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { publishAuthCommand } from "@/lib/redis";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const phoneSchema = z.object({
  phone: z.string().min(5).max(20),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(`telegram:phone:${session.user.id}`, { windowMs: 60_000, maxRequests: 5 });
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit.resetAt);
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.telegramAuthState !== "awaiting_phone") {
    return NextResponse.json({ 
      error: "Invalid state", 
      currentState: user.telegramAuthState 
    }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = phoneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid phone number", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await publishAuthCommand(session.user.id, { 
    type: "PHONE", 
    phone: parsed.data.phone 
  });

  return NextResponse.json({ 
    success: true, 
    message: "Phone number submitted. Check your Telegram for the verification code." 
  });
}

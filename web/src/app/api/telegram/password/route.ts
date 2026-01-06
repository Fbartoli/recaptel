import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { publishAuthCommand } from "@/lib/redis";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

const passwordSchema = z.object({
  password: z.string().min(1).max(100),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(`telegram:password:${session.user.id}`, { windowMs: 60_000, maxRequests: 3 });
  if (!rateLimit.success) {
    return rateLimitResponse(rateLimit.resetAt);
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.telegramAuthState !== "awaiting_password") {
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

  const parsed = passwordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid password", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await publishAuthCommand(session.user.id, { 
    type: "PASSWORD", 
    password: parsed.data.password 
  });

  return NextResponse.json({ 
    success: true, 
    message: "Password submitted." 
  });
}


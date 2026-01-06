import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const settingsSchema = z.object({
  timezone: z.string().min(1).max(100),
  digestHourLocal: z.number().int().min(0).max(23),
  telegramBotToken: z.string().max(100).optional().transform((v) => v?.trim() || null),
  telegramChatId: z.string().max(50).optional().transform((v) => v?.trim() || null),
});

export async function PUT(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { timezone, digestHourLocal, telegramBotToken, telegramChatId } = parsed.data;

  await db
    .update(users)
    .set({
      timezone,
      digestHourLocal,
      telegramBotToken,
      telegramChatId,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ success: true });
}

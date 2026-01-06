import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400">Configure your digest preferences</p>
      </div>

      <SettingsForm
        initialData={{
          timezone: user.timezone ?? "UTC",
          digestHourLocal: user.digestHourLocal ?? 9,
          telegramBotToken: user.telegramBotToken ?? "",
          telegramChatId: user.telegramChatId ?? "",
        }}
      />
    </div>
  );
}


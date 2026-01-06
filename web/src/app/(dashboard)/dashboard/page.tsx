import { auth } from "@/auth";
import { db } from "@/db";
import { digests, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, MessageSquare, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  const recentDigests = await db.query.digests.findMany({
    where: eq(digests.userId, session.user.id),
    orderBy: [desc(digests.createdAt)],
    limit: 5,
  });

  const isConnected = !!user?.telegramConnectedAt;

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full border-slate-800 bg-slate-900/50">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-violet-400" />
            </div>
            <CardTitle className="text-xl text-white">Connect Telegram</CardTitle>
            <CardDescription className="text-slate-400">
              Link your Telegram account to start receiving daily digests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/connect">
              <Button className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500">
                Connect Now
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (recentDigests.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400">Your daily Telegram digests</p>
        </div>

        <Card className="border-slate-800 bg-slate-900/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
              <Clock className="w-8 h-8 text-violet-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No digests yet</h3>
            <p className="text-slate-400 text-center max-w-sm">
              Your first digest will be generated at your scheduled time. 
              Check your settings to configure when you receive digests.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400">Your daily Telegram digests</p>
      </div>

      <div className="grid gap-4">
        {recentDigests.map((digest) => (
          <Card key={digest.id} className="border-slate-800 bg-slate-900/50 hover:bg-slate-900/70 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  <CardTitle className="text-base text-white">
                    {digest.digestDate}
                  </CardTitle>
                </div>
                {digest.messageCount && (
                  <span className="text-sm text-slate-500">
                    {digest.messageCount} messages
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-slate-400 text-sm line-clamp-3">
                {digest.content.slice(0, 200)}...
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}


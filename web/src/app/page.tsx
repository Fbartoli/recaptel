import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles, MessageSquare, Zap, Shield } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-transparent to-transparent" />
      
      <nav className="relative z-10 flex items-center justify-between p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">RecapTel</span>
        </div>
        <Link href="/login">
          <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
            Sign In
          </Button>
        </Link>
      </nav>

      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-20 pb-32">
        <div className="text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm">
            <Zap className="w-4 h-4" />
            Powered by AI
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight">
            Your Telegram,
            <br />
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              Summarized Daily
            </span>
          </h1>
          
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            RecapTel reads your Telegram messages and delivers a concise daily digest. 
            Never miss important updates again.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link href="/login">
              <Button size="lg" className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-medium shadow-lg shadow-violet-500/25 px-8">
                Get Started Free
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-24">
          <FeatureCard
            icon={<MessageSquare className="w-6 h-6" />}
            title="All Your Chats"
            description="Connect your Telegram account and we'll read messages from all your chats and groups."
          />
          <FeatureCard
            icon={<Sparkles className="w-6 h-6" />}
            title="AI Summaries"
            description="Advanced AI distills hundreds of messages into a clear, actionable daily digest."
          />
          <FeatureCard
            icon={<Shield className="w-6 h-6" />}
            title="Privacy First"
            description="Your messages are processed securely. Configure which chats to include or exclude."
          />
        </div>
      </main>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm">
      <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400">{description}</p>
    </div>
  );
}

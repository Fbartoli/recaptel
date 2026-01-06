"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, Bot, Save } from "lucide-react";

interface SettingsFormProps {
  initialData: {
    timezone: string;
    digestHourLocal: number;
    telegramBotToken: string;
    telegramChatId: string;
  };
}

const timezones = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Australia/Sydney",
];

const hours = Array.from({ length: 24 }, (_, i) => i);

export function SettingsForm({ initialData }: SettingsFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState(initialData);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        router.refresh();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-white">Digest Schedule</CardTitle>
              <CardDescription className="text-slate-400">
                When should we send your daily digest?
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="timezone" className="text-slate-300">
                Timezone
              </Label>
              <Select
                value={formData.timezone}
                onValueChange={(value) =>
                  setFormData({ ...formData, timezone: value })
                }
              >
                <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  {timezones.map((tz) => (
                    <SelectItem
                      key={tz}
                      value={tz}
                      className="text-slate-300 focus:bg-slate-800 focus:text-white"
                    >
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="digestHour" className="text-slate-300">
                Digest Time
              </Label>
              <Select
                value={formData.digestHourLocal.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, digestHourLocal: parseInt(value) })
                }
              >
                <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  {hours.map((hour) => (
                    <SelectItem
                      key={hour}
                      value={hour.toString()}
                      className="text-slate-300 focus:bg-slate-800 focus:text-white"
                    >
                      {hour.toString().padStart(2, "0")}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Bot className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-white">Delivery Bot</CardTitle>
              <CardDescription className="text-slate-400">
                Configure the Telegram bot that sends your digests
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="botToken" className="text-slate-300">
              Bot Token
            </Label>
            <Input
              id="botToken"
              type="password"
              placeholder="123456:ABC-DEF..."
              value={formData.telegramBotToken}
              onChange={(e) =>
                setFormData({ ...formData, telegramBotToken: e.target.value })
              }
              className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
            />
            <p className="text-xs text-slate-500">
              Get this from @BotFather on Telegram
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="chatId" className="text-slate-300">
              Chat ID
            </Label>
            <Input
              id="chatId"
              placeholder="Your Telegram user ID"
              value={formData.telegramChatId}
              onChange={(e) =>
                setFormData({ ...formData, telegramChatId: e.target.value })
              }
              className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
            />
            <p className="text-xs text-slate-500">
              Get this from @userinfobot on Telegram
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving...
            </span>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </form>
  );
}


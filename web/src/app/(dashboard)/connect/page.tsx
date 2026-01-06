"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquare, Phone, KeyRound, Lock, CheckCircle2, Loader2, XCircle } from "lucide-react";

type AuthState = "disconnected" | "awaiting_phone" | "awaiting_code" | "awaiting_password" | "ready";

interface StatusResponse {
  state: AuthState;
  message: string;
  telegramConnectedAt?: string;
  lastIngestAt?: string;
  lastDigestAt?: string;
}

export default function ConnectPage() {
  const [state, setState] = useState<AuthState>("disconnected");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/telegram/status");
      if (res.ok) {
        const data: StatusResponse = await res.json();
        setState(data.state);
        setMessage(data.message);
      }
    } catch {
      console.error("Failed to fetch status");
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/telegram/connect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start connection");
      } else {
        await fetchStatus();
      }
    } catch {
      setError("Failed to connect");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/telegram/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit phone");
      }
    } catch {
      setError("Failed to submit phone");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/telegram/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit code");
      }
    } catch {
      setError("Failed to submit code");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/telegram/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit password");
      }
    } catch {
      setError("Failed to submit password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/telegram/disconnect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to disconnect");
      } else {
        setState("disconnected");
        setPhone("");
        setCode("");
        setPassword("");
      }
    } catch {
      setError("Failed to disconnect");
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    switch (state) {
      case "disconnected":
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-violet-500/10 flex items-center justify-center">
              <MessageSquare className="w-10 h-10 text-violet-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-white">Connect Your Telegram</h3>
              <p className="text-slate-400 text-sm mt-1">
                Link your Telegram account to start receiving daily digests
              </p>
            </div>
            <Button
              onClick={handleConnect}
              disabled={isLoading}
              className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Phone className="w-4 h-4 mr-2" />
              )}
              Start Connection
            </Button>
          </div>
        );

      case "awaiting_phone":
        return (
          <form onSubmit={handlePhone} className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Phone className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h3 className="font-medium text-white">Enter Phone Number</h3>
                <p className="text-slate-400 text-sm">Include country code (e.g., +1234567890)</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-slate-300">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-slate-800/50 border-slate-700 text-white disabled:opacity-50"
                disabled={isLoading}
                required
              />
            </div>
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-violet-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending verification code to Telegram...</span>
              </div>
            )}
            <Button
              type="submit"
              disabled={isLoading || !phone}
              className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Code"}
            </Button>
          </form>
        );

      case "awaiting_code":
        return (
          <form onSubmit={handleCode} className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <KeyRound className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h3 className="font-medium text-white">Enter Verification Code</h3>
                <p className="text-slate-400 text-sm">Check your Telegram app for the code</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="code" className="text-slate-300">Verification Code</Label>
              <Input
                id="code"
                type="text"
                placeholder="12345"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="bg-slate-800/50 border-slate-700 text-white text-center text-2xl tracking-widest disabled:opacity-50"
                maxLength={10}
                disabled={isLoading}
                required
              />
            </div>
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-violet-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying code...</span>
              </div>
            )}
            <Button
              type="submit"
              disabled={isLoading || !code}
              className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify Code"}
            </Button>
          </form>
        );

      case "awaiting_password":
        return (
          <form onSubmit={handlePassword} className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Lock className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h3 className="font-medium text-white">Two-Factor Authentication</h3>
                <p className="text-slate-400 text-sm">Enter your 2FA password</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">2FA Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-800/50 border-slate-700 text-white disabled:opacity-50"
                disabled={isLoading}
                required
              />
            </div>
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-violet-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating...</span>
              </div>
            )}
            <Button
              type="submit"
              disabled={isLoading || !password}
              className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Password"}
            </Button>
          </form>
        );

      case "ready":
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-white">Connected!</h3>
              <p className="text-slate-400 text-sm mt-1">
                Your Telegram account is linked. Digests will be sent automatically.
              </p>
            </div>
            <Button
              onClick={handleDisconnect}
              disabled={isLoading}
              variant="outline"
              className="border-red-500/50 text-red-400 hover:bg-red-500/10"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Disconnect"}
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Connect Telegram</h1>
        <p className="text-slate-400">Link your Telegram account to receive digests</p>
      </div>

      <Card className="max-w-md border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-white">
            {state === "ready" ? "Telegram Connected" : "Link Telegram"}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
}

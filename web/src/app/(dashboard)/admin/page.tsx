"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Users, MessageSquare, FileText, Activity } from "lucide-react";

interface UserStat {
  id: string;
  email: string;
  telegramAuthState: string | null;
  lastIngestAt: Date | null;
  lastDigestAt: Date | null;
  telegramConnectedAt: Date | null;
}

interface QueueStats {
  wait: number;
  active: number;
  failed: number;
  completed: number;
}

interface AdminStatus {
  timestamp: string;
  users: UserStat[];
  totals: {
    users: number;
    usersReady: number;
    messages: number;
    digests: number;
  };
  queues: {
    ingest?: QueueStats;
    digest?: QueueStats;
    error?: string;
  };
}

export default function AdminPage() {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/status");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch status");
      }
      setStatus(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (d: Date | string | null) => {
    if (!d) return "Never";
    return new Date(d).toLocaleString();
  };

  if (error) {
    return (
      <div className="p-6">
        <Card className="bg-red-500/10 border-red-500/20">
          <CardHeader>
            <CardTitle className="text-red-400">Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-300">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-slate-400">System monitoring and queue status</p>
        </div>
        <Button
          onClick={fetchStatus}
          disabled={loading}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {status && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-300">Total Users</CardTitle>
                <Users className="w-4 h-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{status.totals.users}</div>
                <p className="text-xs text-slate-400">{status.totals.usersReady} connected</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-300">Messages</CardTitle>
                <MessageSquare className="w-4 h-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{status.totals.messages.toLocaleString()}</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-300">Digests</CardTitle>
                <FileText className="w-4 h-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{status.totals.digests}</div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-300">Queue Health</CardTitle>
                <Activity className="w-4 h-4 text-slate-400" />
              </CardHeader>
              <CardContent>
                {status.queues.error ? (
                  <div className="text-red-400 text-sm">{status.queues.error}</div>
                ) : (
                  <div className="text-sm">
                    <span className="text-green-400">{(status.queues.ingest?.completed || 0) + (status.queues.digest?.completed || 0)}</span>
                    <span className="text-slate-400"> completed</span>
                    {((status.queues.ingest?.failed || 0) + (status.queues.digest?.failed || 0)) > 0 && (
                      <>
                        <span className="text-slate-400"> / </span>
                        <span className="text-red-400">{(status.queues.ingest?.failed || 0) + (status.queues.digest?.failed || 0)}</span>
                        <span className="text-slate-400"> failed</span>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Ingest Queue</CardTitle>
              </CardHeader>
              <CardContent>
                {status.queues.ingest ? (
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-xl font-bold text-yellow-400">{status.queues.ingest.wait}</div>
                      <div className="text-xs text-slate-400">Waiting</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-blue-400">{status.queues.ingest.active}</div>
                      <div className="text-xs text-slate-400">Active</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-green-400">{status.queues.ingest.completed}</div>
                      <div className="text-xs text-slate-400">Done</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-red-400">{status.queues.ingest.failed}</div>
                      <div className="text-xs text-slate-400">Failed</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400">No data</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Digest Queue</CardTitle>
              </CardHeader>
              <CardContent>
                {status.queues.digest ? (
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-xl font-bold text-yellow-400">{status.queues.digest.wait}</div>
                      <div className="text-xs text-slate-400">Waiting</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-blue-400">{status.queues.digest.active}</div>
                      <div className="text-xs text-slate-400">Active</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-green-400">{status.queues.digest.completed}</div>
                      <div className="text-xs text-slate-400">Done</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-red-400">{status.queues.digest.failed}</div>
                      <div className="text-xs text-slate-400">Failed</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400">No data</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Users</CardTitle>
              <CardDescription>All registered users and their status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {status.users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                    <div>
                      <div className="font-medium text-white">{user.email}</div>
                      <div className="text-sm text-slate-400">
                        Last ingest: {formatDate(user.lastIngestAt)} | Last digest: {formatDate(user.lastDigestAt)}
                      </div>
                    </div>
                    <Badge
                      variant={user.telegramAuthState === "ready" ? "default" : "secondary"}
                      className={user.telegramAuthState === "ready" ? "bg-green-500/20 text-green-400" : ""}
                    >
                      {user.telegramAuthState || "disconnected"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-slate-500 text-center">
            Last updated: {formatDate(status.timestamp)}
          </p>
        </>
      )}
    </div>
  );
}


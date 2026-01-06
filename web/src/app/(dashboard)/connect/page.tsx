import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Smartphone } from "lucide-react";

export default function ConnectPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Connect Telegram</h1>
        <p className="text-slate-400">Link your Telegram account to receive digests</p>
      </div>

      <Card className="max-w-lg border-slate-800 bg-slate-900/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-white">Scan QR Code</CardTitle>
              <CardDescription className="text-slate-400">
                Use the Telegram app to scan
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="aspect-square max-w-xs mx-auto bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700">
            <div className="text-center space-y-4">
              <Smartphone className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-slate-500 text-sm">
                QR code login coming soon
              </p>
            </div>
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-sm font-medium text-white">How to connect:</h3>
            <ol className="text-sm text-slate-400 space-y-1">
              <li>1. Open Telegram on your phone</li>
              <li>2. Go to Settings → Devices</li>
              <li>3. Tap &quot;Link Desktop Device&quot;</li>
              <li>4. Scan the QR code above</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


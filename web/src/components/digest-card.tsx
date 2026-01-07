"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";

interface DigestCardProps {
  id: string;
  digestDate: string;
  content: string;
  messageCount: number | null;
}

export function DigestCard({ digestDate, content, messageCount }: DigestCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="border-slate-800 bg-slate-900/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <CardTitle className="text-base text-white">{digestDate}</CardTitle>
          </div>
          <div className="flex items-center gap-3">
            {messageCount && (
              <span className="text-sm text-slate-500">{messageCount} messages</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="text-slate-400 hover:text-white hover:bg-slate-800"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  Expand
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {expanded ? (
          <div className="prose prose-invert prose-sm max-w-none prose-headings:text-violet-300 prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2 prose-p:text-slate-300 prose-p:my-2 prose-ul:text-slate-300 prose-li:text-slate-300 prose-strong:text-white prose-a:text-violet-400 prose-a:no-underline hover:prose-a:underline">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <div className="text-slate-400 text-sm">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <span className="font-semibold text-violet-300">{children} </span>,
                h2: ({ children }) => <span className="font-semibold text-violet-300">{children} </span>,
                h3: ({ children }) => <span className="font-semibold text-violet-300">{children} </span>,
                p: ({ children }) => <span>{children} </span>,
                ul: ({ children }) => <span>{children}</span>,
                li: ({ children }) => <span>• {children} </span>,
                strong: ({ children }) => <strong className="text-white">{children}</strong>,
                a: ({ children }) => <span className="text-violet-400">{children}</span>,
              }}
            >
              {content.slice(0, 400)}
            </ReactMarkdown>
            {content.length > 400 && <span className="text-slate-500">...</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}



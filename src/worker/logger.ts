type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  userId?: string;
  jobId?: string;
  queue?: string;
  duration?: number;
  [key: string]: unknown;
}

const LOG_JSON = process.env.LOG_FORMAT === "json";

function formatMessage(level: LogLevel, component: string, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  
  if (LOG_JSON) {
    return JSON.stringify({
      timestamp,
      level,
      component,
      message,
      ...context,
    });
  }

  const contextStr = context
    ? Object.entries(context)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
        .join(" ")
    : "";

  return `[${timestamp}] [${level.toUpperCase()}] [${component}] ${message}${contextStr ? " " + contextStr : ""}`;
}

function createLogger(component: string) {
  return {
    debug: (message: string, context?: LogContext) => {
      if (process.env.LOG_LEVEL === "debug") {
        console.log(formatMessage("debug", component, message, context));
      }
    },
    info: (message: string, context?: LogContext) => {
      console.log(formatMessage("info", component, message, context));
    },
    warn: (message: string, context?: LogContext) => {
      console.warn(formatMessage("warn", component, message, context));
    },
    error: (message: string, context?: LogContext) => {
      console.error(formatMessage("error", component, message, context));
    },
  };
}

export const logger = {
  worker: createLogger("Worker"),
  ingest: createLogger("Ingest"),
  digest: createLogger("Digest"),
  redis: createLogger("Redis"),
  tdlib: createLogger("TDLib"),
  queue: createLogger("Queue"),
};

export type Logger = ReturnType<typeof createLogger>;



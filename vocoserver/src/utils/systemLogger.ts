import SystemLog from "../models/SystemLog";
import { LogLevel } from "../models/SystemLog";

const LOG_PREFIX = {
  error: "❌",
  warning: "⚠️",
  info: "ℹ️",
  security: "🔐",
  performance: "⚡",
  webhook: "🔥",
};

function fmtTimestamp(): string {
  return new Date().toISOString();
}

export const logSystem = async (
  level: LogLevel,
  message: string,
  options?: {
    source?: string;
    details?: string;
    method?: string;
    path?: string;
    statusCode?: number;
    durationMs?: number;
    ip?: string;
    userAgent?: string;
    stack?: string;
  }
) => {
  const prefix = LOG_PREFIX[level] || "•";
  const source = options?.source || "server";

  // Always write to console in structured format
  const consoleMsg = `[${fmtTimestamp()}] [${level.toUpperCase()}] [${source}] ${message}`;
  if (level === "error") {
    console.error(consoleMsg, options?.details || "", options?.stack || "");
  } else if (level === "warning") {
    console.warn(consoleMsg, options?.details || "");
  } else {
    console.log(consoleMsg, options?.details || "");
  }

  // Write to MongoDB (non-blocking, fire-and-forget)
  try {
    await SystemLog.create({
      level,
      message,
      source,
      details: options?.details || null,
      method: options?.method || null,
      path: options?.path || null,
      statusCode: options?.statusCode || null,
      durationMs: options?.durationMs || null,
      ip: options?.ip || null,
      userAgent: options?.userAgent || null,
      stack: options?.stack || null,
    });
  } catch {
    // Silently ignore DB logging errors
  }
};

export const logger = {
  error: (message: string, opts?: Parameters<typeof logSystem>[2]) =>
    logSystem("error", message, opts),
  warning: (message: string, opts?: Parameters<typeof logSystem>[2]) =>
    logSystem("warning", message, opts),
  info: (message: string, opts?: Parameters<typeof logSystem>[2]) =>
    logSystem("info", message, opts),
  security: (message: string, opts?: Parameters<typeof logSystem>[2]) =>
    logSystem("security", message, opts),
  performance: (message: string, opts?: Parameters<typeof logSystem>[2]) =>
    logSystem("performance", message, opts),
  webhook: (message: string, opts?: Parameters<typeof logSystem>[2]) =>
    logSystem("webhook", message, opts),
};

/**
 * Patch console.log/error/warn to add structured formatting.
 * Call once at server startup to get immediate benefit across all existing code.
 */
export function patchConsole(): void {
  const origLog = console.log;
  const origError = console.error;
  const origWarn = console.warn;

  console.log = (...args: any[]) => {
    const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
    origLog(`[${fmtTimestamp()}] [INFO] ${msg}`);
  };

  console.error = (...args: any[]) => {
    const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
    origError(`[${fmtTimestamp()}] [ERROR] ${msg}`);
  };

  console.warn = (...args: any[]) => {
    const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
    origWarn(`[${fmtTimestamp()}] [WARN] ${msg}`);
  };
}

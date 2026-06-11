/**
 * Logger structuré — remplace les console.log dispersés.
 * En production, les logs sont en JSON pour les outils de monitoring.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

function formatLog(level: LogLevel, message: string, meta?: Record<string, any>): string {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  return JSON.stringify(entry);
}

export const logger = {
  debug(message: string, meta?: Record<string, any>) {
    if (process.env.NODE_ENV !== "production") {
      console.debug(formatLog("debug", message, meta));
    }
  },

  info(message: string, meta?: Record<string, any>) {
    console.log(formatLog("info", message, meta));
  },

  warn(message: string, meta?: Record<string, any>) {
    console.warn(formatLog("warn", message, meta));
  },

  error(message: string, meta?: Record<string, any>) {
    console.error(formatLog("error", message, meta));
  },
};

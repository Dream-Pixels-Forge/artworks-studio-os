/**
 * Structured logger.
 *
 * A thin wrapper around console with leveled output. In production this
 * writes to the OS log; in development it formats for a terminal. Kept
 * dependency-free for the foundation phase.
 */
import { config } from "./config.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const THRESHOLD: LogLevel = config.isDev ? "debug" : "info";

function log(level: LogLevel, scope: string, message: string, data?: unknown): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[THRESHOLD]) return;

  const prefix = `[${level.toUpperCase()}] ${scope}:`;
  const payload = data === undefined ? message : `${message} ${format(data)}`;

  const stream = level === "error" || level === "warn" ? console.error : console.log;
  stream(prefix, payload);
}

function format(data: unknown): string {
  try {
    return typeof data === "string" ? data : JSON.stringify(data);
  } catch {
    return String(data);
  }
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, data?: unknown) => log("debug", scope, message, data),
    info: (message: string, data?: unknown) => log("info", scope, message, data),
    warn: (message: string, data?: unknown) => log("warn", scope, message, data),
    error: (message: string, data?: unknown) => log("error", scope, message, data),
  };
}

export type Logger = ReturnType<typeof createLogger>;

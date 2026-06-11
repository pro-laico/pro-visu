import { createConsola } from "consola";
import type { ConsolaInstance } from "consola";
import type { LogLevel } from "@/config/schema";

/** Map our friendly log levels onto consola's numeric levels. */
const LEVEL_MAP: Record<LogLevel, number> = {
  silent: Number.NEGATIVE_INFINITY,
  error: 0,
  warn: 1,
  info: 3,
  debug: 4,
};

export type Logger = ConsolaInstance;

export function createLogger(level: LogLevel = "info"): Logger {
  return createConsola({ level: LEVEL_MAP[level] });
}

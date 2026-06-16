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

/** A destination for tagged log entries (the live job tracker implements this). */
export interface LogSink {
  /** Consume a tagged log line. Return true if handled (suppress normal printing). */
  route(tag: string, type: string, message: string): boolean;
}

/**
 * A logger that diverts entries to a sink: *tagged* entries (e.g.
 * `logger.withTag("home-reel").info(…)`) feed each asset's progress into the live dashboard, while
 * untagged entries are committed above it — so the live renderer owns the terminal and stray logs
 * never corrupt its output. Anything the sink declines (e.g. after teardown) prints normally.
 */
export function createReportingLogger(level: LogLevel, sink: LogSink): Logger {
  const passthrough = createConsola({ level: LEVEL_MAP[level] });
  return createConsola({
    level: LEVEL_MAP[level],
    reporters: [
      {
        log(logObj) {
          const tag = typeof logObj.tag === "string" ? logObj.tag : "";
          const args = (logObj.args ?? []) as unknown[];
          const message = args.map((a) => (typeof a === "string" ? a : String(a))).join(" ");
          if (sink.route(tag, logObj.type, message)) return;
          const fn = (passthrough as unknown as Record<string, unknown>)[logObj.type];
          const emit =
            typeof fn === "function"
              ? (fn as (...a: unknown[]) => void)
              : (passthrough.log as unknown as (...a: unknown[]) => void);
          emit.call(passthrough, ...args);
        },
      },
    ],
  });
}

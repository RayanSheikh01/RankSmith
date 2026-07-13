export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LogRecord {
  ts: string;
  level: LogLevel;
  msg: string;
  context: Record<string, unknown>;
}

export type LogSink = (record: LogRecord) => void;

export const consoleSink: LogSink = (record) => {
  const line = JSON.stringify(record);
  if (record.level === "error" || record.level === "warn") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
};

export interface LoggerOptions {
  level?: LogLevel;
  context?: Record<string, unknown>;
  sink?: LogSink;
}

/**
 * Structured JSON logger. Carries a bound context (e.g. `{ runId }`) that is
 * merged into every record, and can spawn `child` loggers with extra context.
 */
export class Logger {
  private readonly level: LogLevel;
  private readonly context: Record<string, unknown>;
  private readonly sink: LogSink;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? "info";
    this.context = options.context ?? {};
    this.sink = options.sink ?? consoleSink;
  }

  child(context: Record<string, unknown>): Logger {
    return new Logger({
      level: this.level,
      context: { ...this.context, ...context },
      sink: this.sink,
    });
  }

  private emit(level: LogLevel, msg: string, context?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.level]) return;
    this.sink({
      ts: new Date().toISOString(),
      level,
      msg,
      context: { ...this.context, ...(context ?? {}) },
    });
  }

  debug(msg: string, context?: Record<string, unknown>): void {
    this.emit("debug", msg, context);
  }

  info(msg: string, context?: Record<string, unknown>): void {
    this.emit("info", msg, context);
  }

  warn(msg: string, context?: Record<string, unknown>): void {
    this.emit("warn", msg, context);
  }

  error(msg: string, context?: Record<string, unknown>): void {
    this.emit("error", msg, context);
  }
}

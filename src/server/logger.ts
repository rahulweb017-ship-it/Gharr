import { env, isProduction } from "@/server/env";

/**
 * Minimal structured logger.
 *
 * Production emits one JSON object per line, which is what every log aggregator
 * expects. Development emits a short coloured line, because a wall of JSON while
 * building a checkout flow helps nobody.
 *
 * This is deliberately not pino: the whole surface we need is five levels and a
 * bound child logger, and avoiding the dependency keeps the server bundle small
 * and edge-runtime friendly.
 */

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const COLOURS: Record<Level, string> = {
  debug: "\x1b[90m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
};
const RESET = "\x1b[0m";

const threshold = LEVEL_ORDER[env.LOG_LEVEL];

type Bindings = Record<string, unknown>;

function serialiseError(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

function write(level: Level, bindings: Bindings, arg1: unknown, arg2?: string) {
  if (LEVEL_ORDER[level] < threshold) return;

  const [context, message] =
    typeof arg1 === "string"
      ? [{}, arg1]
      : [arg1 as Bindings, arg2 ?? ""];

  const payload: Bindings = { ...bindings, ...context };
  if ("err" in payload) payload.err = serialiseError(payload.err);

  if (isProduction) {
    process.stdout.write(
      JSON.stringify({
        level,
        time: new Date().toISOString(),
        msg: message,
        ...payload,
      }) + "\n",
    );
    return;
  }

  const time = new Date().toISOString().slice(11, 19);
  const extras = Object.keys(payload).length
    ? ` ${JSON.stringify(payload)}`
    : "";
  process.stdout.write(
    `${COLOURS[level]}${level.toUpperCase().padEnd(5)}${RESET} ${time} ${message}${extras}\n`,
  );
}

export interface Logger {
  debug(context: Bindings, message: string): void;
  debug(message: string): void;
  info(context: Bindings, message: string): void;
  info(message: string): void;
  warn(context: Bindings, message: string): void;
  warn(message: string): void;
  error(context: Bindings, message: string): void;
  error(message: string): void;
  /** Returns a logger that stamps every line with the given fields. */
  child(bindings: Bindings): Logger;
}

function createLogger(bindings: Bindings = {}): Logger {
  return {
    debug: (a: unknown, b?: string) => write("debug", bindings, a, b),
    info: (a: unknown, b?: string) => write("info", bindings, a, b),
    warn: (a: unknown, b?: string) => write("warn", bindings, a, b),
    error: (a: unknown, b?: string) => write("error", bindings, a, b),
    child: (extra: Bindings) => createLogger({ ...bindings, ...extra }),
  } as Logger;
}

export const logger = createLogger();

/**
 * Highlighted banner used by the console SMS provider. An OTP buried in query
 * logs is a genuine daily annoyance while building the auth flow.
 */
export function banner(lines: string[]): void {
  const width = Math.max(...lines.map((l) => l.length)) + 2;
  const top = `\n\x1b[32m┌${"─".repeat(width)}┐`;
  const body = lines
    .map((l) => `│ ${l.padEnd(width - 2)} │`)
    .join("\n");
  const bottom = `└${"─".repeat(width)}┘${RESET}\n`;
  process.stdout.write(`${top}\n${body}\n${bottom}`);
}

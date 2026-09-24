/**
 * A small structured logger.
 *
 * Production emits one JSON object per line so a log shipper can index fields
 * without parsing prose; development prints a readable line instead. Reads
 * `LOG_LEVEL` directly rather than through `env.ts`, because env validation
 * itself needs to log.
 */

type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function threshold(): number {
  const configured = process.env.LOG_LEVEL as Level | undefined;
  if (configured && configured in ORDER) return ORDER[configured];
  return process.env.NODE_ENV === "production" ? ORDER.info : ORDER.debug;
}

function serialize(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

type Fields = Record<string, unknown>;

function write(level: Level, message: string, fields?: Fields): void {
  if (ORDER[level] < threshold()) return;

  const sink =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.log;

  const normalized: Fields = {};
  for (const [key, value] of Object.entries(fields ?? {})) {
    normalized[key] = serialize(value);
  }

  if (process.env.NODE_ENV === "production") {
    sink(
      JSON.stringify({
        level,
        time: new Date().toISOString(),
        msg: message,
        ...normalized,
      }),
    );
    return;
  }

  const suffix = Object.keys(normalized).length > 0 ? normalized : "";
  sink(`[${level}] ${message}`, suffix);
}

export const logger = {
  debug: (message: string, fields?: Fields) => write("debug", message, fields),
  info: (message: string, fields?: Fields) => write("info", message, fields),
  warn: (message: string, fields?: Fields) => write("warn", message, fields),
  error: (message: string, fields?: Fields) => write("error", message, fields),
};

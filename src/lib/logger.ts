/**
 * Structured logging.
 *
 * One line of JSON per event so it is greppable in Vercel logs and parseable by
 * a log drain later. Values are filtered through a redactor because AI request
 * metadata sits uncomfortably close to secrets.
 */

type Level = "debug" | "info" | "warn" | "error";

const SENSITIVE_KEY = /(key|token|secret|password|authorization|cookie)/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[deep]";
  if (value == null) return value;
  if (typeof value === "string") return value.length > 600 ? `${value.slice(0, 600)}…` : value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : redact(item, depth + 1);
  }
  return out;
}

function emit(level: Level, event: string, data?: Record<string, unknown>) {
  const line = JSON.stringify({
    t: new Date().toISOString(),
    level,
    event,
    ...(data ? (redact(data) as Record<string, unknown>) : {}),
  });

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (event: string, data?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== "production") emit("debug", event, data);
  },
  info: (event: string, data?: Record<string, unknown>) => emit("info", event, data),
  warn: (event: string, data?: Record<string, unknown>) => emit("warn", event, data),
  error: (event: string, data?: Record<string, unknown>) => emit("error", event, data),
};

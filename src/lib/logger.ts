// Purpose: one JSON line per event on stdout, OpenTelemetry style fields. The only file allowed to write output.
// Rules: standards/logging.md. level = severity_text, msg = body (OTel Logs Data Model).
// Source: https://opentelemetry.io/docs/specs/otel/logs/data-model/
// Node runtime only. Edge has no process.stdout. Never pass a whole request, user or database row.
import { env } from '@/lib/env';

export type Level = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type Fields = Record<string, unknown>;

const SEVERITY: Record<Level, number> = { trace: 1, debug: 5, info: 9, warn: 13, error: 17, fatal: 21 };
// Design.md Logging: redact secrets and all personal data (names, emails, phones, desks, client IP). Log the user id only.
const REDACT =
  /passw(or)?d|passphrase|secret|token|authorization|cookie|session|api[-_]?key|connection|card|email|phone|desk|company|client[-_]?ip|(^|_)ip$|name$|^query$|visitor/i;
const MAX_STRING = 1000;

function clean(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return value.replace(/[\r\n]+/g, ' ').slice(0, MAX_STRING);
  if (value instanceof Error) {
    return { 'error.type': value.name, 'error.message': clean(value.message), 'exception.stacktrace': clean(value.stack) };
  }
  if (Array.isArray(value)) return depth > 4 ? '[TRUNCATED]' : value.slice(0, 50).map((v) => clean(v, depth + 1));
  if (value && typeof value === 'object') {
    if (depth > 4) return '[TRUNCATED]';
    const out: Fields = {};
    for (const [k, v] of Object.entries(value)) out[k] = REDACT.test(k) ? '[REDACTED]' : clean(v, depth + 1);
    return out;
  }
  return value;
}

export interface Logger {
  trace(msg: string, fields?: Fields): void;
  debug(msg: string, fields?: Fields): void;
  info(msg: string, fields?: Fields): void;
  warn(msg: string, fields?: Fields): void;
  error(msg: string, fields?: Fields): void;
  fatal(msg: string, fields?: Fields): void;
  /** New logger that adds request_id (and optional fields such as trace_id) to every line. */
  child(requestId: string, extra?: Fields): Logger;
}

type Options = { level: Level; bindings?: Fields; write?: (line: string) => void };

export function createLogger(opts: Options): Logger {
  const write = opts.write ?? ((line: string) => void process.stdout.write(line + '\n'));
  const bindings = opts.bindings ?? {};
  const emit = (level: Level, msg: string, fields: Fields = {}) => {
    if (SEVERITY[level] < SEVERITY[opts.level]) return;
    const extra = clean({ ...bindings, ...fields }) as Fields;
    for (const k of ['timestamp', 'level', 'severity_number', 'msg']) delete extra[k];
    const record = {
      timestamp: new Date().toISOString(),
      level,
      severity_number: SEVERITY[level],
      msg: clean(msg),
      ...extra,
    };
    write(JSON.stringify(record));
  };
  const at = (level: Level) => (msg: string, fields?: Fields) => emit(level, msg, fields);
  return {
    trace: at('trace'),
    debug: at('debug'),
    info: at('info'),
    warn: at('warn'),
    error: at('error'),
    fatal: at('fatal'),
    child: (requestId, extra = {}) => createLogger({ ...opts, bindings: { ...bindings, request_id: requestId, ...extra } }),
  };
}

export const logger: Logger = createLogger({ level: env.LOG_LEVEL });

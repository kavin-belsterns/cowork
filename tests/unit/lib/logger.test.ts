// Purpose: Unit tests for structured JSON logger (src/lib/logger.ts).
// Rules: standards/testing.md, standards/logging.md. OpenTelemetry log fields, level filtering, redaction.
import { describe, expect, it } from 'vitest';
import { createLogger, type Level } from '@/lib/logger';

describe('src/lib/logger: structured JSON logging', () => {
  function capture(level: Level = 'debug') {
    const lines: Record<string, unknown>[] = [];
    const write = (raw: string) => {
      lines.push(JSON.parse(raw.trim()));
    };
    const log = createLogger({ level, write });
    return { log, lines };
  }

  describe('OpenTelemetry log format', () => {
    it('emits one JSON line with OTel fields', () => {
      const { log, lines } = capture('info');
      log.info('Server started', { port: 3000 });

      expect(lines).toHaveLength(1);
      const entry = lines[0]!;
      expect(typeof entry.timestamp).toBe('string');
      expect(entry.level).toBe('info');
      expect(entry.severity_number).toBe(9);
      expect(entry.msg).toBe('Server started');
      expect(entry.port).toBe(3000);
    });

    it('assigns correct severity numbers for all levels', () => {
      const { log, lines } = capture('trace');
      log.trace('t');
      log.debug('d');
      log.info('i');
      log.warn('w');
      log.error('e');
      log.fatal('f');

      expect(lines.map((l) => [l.level, l.severity_number])).toEqual([
        ['trace', 1],
        ['debug', 5],
        ['info', 9],
        ['warn', 13],
        ['error', 17],
        ['fatal', 21],
      ]);
    });
  });

  describe('level filtering', () => {
    it('suppresses logs below the configured severity level', () => {
      const { log, lines } = capture('warn');
      log.trace('trace msg');
      log.debug('debug msg');
      log.info('info msg');
      expect(lines).toHaveLength(0);

      log.warn('warn msg');
      log.error('error msg');
      expect(lines).toHaveLength(2);
      expect(lines[0]?.level).toBe('warn');
      expect(lines[1]?.level).toBe('error');
    });
  });

  describe('child logger', () => {
    it('binds request_id and custom attributes to all child log calls', () => {
      const { log, lines } = capture('info');
      const reqLogger = log.child('req-12345', { trace_id: 'trace-abc' });

      reqLogger.info('Handled request', { http_status: 200 });
      expect(lines).toHaveLength(1);
      expect(lines[0]?.request_id).toBe('req-12345');
      expect(lines[0]?.trace_id).toBe('trace-abc');
      expect(lines[0]?.http_status).toBe(200);
    });
  });

  describe('sensitive data redaction', () => {
    it('redacts passwords, tokens, secrets, cookies, session and query fields', () => {
      const { log, lines } = capture('info');
      log.info('Auth event', {
        password: 'super-secret-pwd',
        passwd: 'secret',
        token: 'eyJh...',
        bearerToken: 'eyJh...',
        secret: 'shhh',
        session: 'sess-token',
        cookie: 'auth=abc',
        apiKey: 'key-123',
        query: 'SELECT * FROM users',
      });

      const entry = lines[0]!;
      expect(entry.password).toBe('[REDACTED]');
      expect(entry.passwd).toBe('[REDACTED]');
      expect(entry.token).toBe('[REDACTED]');
      expect(entry.bearerToken).toBe('[REDACTED]');
      expect(entry.secret).toBe('[REDACTED]');
      expect(entry.session).toBe('[REDACTED]');
      expect(entry.cookie).toBe('[REDACTED]');
      expect(entry.apiKey).toBe('[REDACTED]');
      expect(entry.query).toBe('[REDACTED]');
    });

    it('redacts personal data: email, phone, desk, company, IP, and camelCase names', () => {
      const { log, lines } = capture('info');
      log.info('User action', {
        email: 'alice@example.com',
        phone: '+44 7700 900077',
        desk: 'Desk 4B',
        company: 'Acme Corp',
        client_ip: '192.168.1.1',
        user_ip: '10.0.0.1',
        ip: '127.0.0.1',
        visitor: { status: 'checked_in' },
        // camelCase name fields per ADR-0014/ADR-0015 review item
        name: 'Alice Smith',
        userName: 'asmith',
        visitorName: 'Bob Visitor',
        firstName: 'Alice',
        // User ID must NOT be redacted (design.md / logging.md: log user id only)
        userId: '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4001',
      });

      const entry = lines[0]!;
      expect(entry.email).toBe('[REDACTED]');
      expect(entry.phone).toBe('[REDACTED]');
      expect(entry.desk).toBe('[REDACTED]');
      expect(entry.company).toBe('[REDACTED]');
      expect(entry.client_ip).toBe('[REDACTED]');
      expect(entry.user_ip).toBe('[REDACTED]');
      expect(entry.ip).toBe('[REDACTED]');
      expect(entry.visitor).toBe('[REDACTED]');
      expect(entry.name).toBe('[REDACTED]');
      expect(entry.userName).toBe('[REDACTED]');
      expect(entry.visitorName).toBe('[REDACTED]');
      expect(entry.firstName).toBe('[REDACTED]');
      expect(entry.userId).toBe('0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4001');
    });

    it('redacts sensitive fields in nested objects', () => {
      const { log, lines } = capture('info');
      log.info('Nested test', {
        auth: {
          token: 'sensitive-token',
          safeField: 'ok',
        },
      });

      const entry = lines[0]! as { auth: { token: string; safeField: string } };
      expect(entry.auth.token).toBe('[REDACTED]');
      expect(entry.auth.safeField).toBe('ok');
    });
  });

  describe('sanitisation and safety', () => {
    it('strips CR and LF characters from string values and message', () => {
      const { log, lines } = capture('info');
      log.info('Message\r\nwith\nnewlines', {
        userInput: 'Header\r\ninjection\nattempt',
      });

      const entry = lines[0]!;
      expect(entry.msg).toBe('Message with newlines');
      expect(entry.userInput).toBe('Header injection attempt');
    });

    it('caps long string values at 1000 characters', () => {
      const { log, lines } = capture('info');
      const longString = 'x'.repeat(1500);
      log.info('Long test', { longVal: longString });

      const entry = lines[0]! as { longVal: string };
      expect(entry.longVal.length).toBe(1000);
    });

    it('formats Error instances safely', () => {
      const { log, lines } = capture('error');
      const err = new TypeError('Cannot read properties of undefined');
      log.error('Operation failed', { error: err });

      const entry = lines[0]! as { error: { 'error.type': string; 'error.message': string; 'exception.stacktrace': string } };
      expect(entry.error['error.type']).toBe('TypeError');
      expect(entry.error['error.message']).toBe('Cannot read properties of undefined');
      expect(entry.error['exception.stacktrace']).toBeDefined();
    });

    it('truncates deep nesting beyond depth 4', () => {
      const { log, lines } = capture('info');
      const deep = { a: { b: { c: { d: { e: { f: 'too deep' } } } } } };
      log.info('Deep test', { deep });

      const entry = lines[0] as unknown as { deep: { a: { b: { c: { d: unknown } } } } };
      expect(entry.deep.a.b.c.d).toBe('[TRUNCATED]');
    });
  });
});

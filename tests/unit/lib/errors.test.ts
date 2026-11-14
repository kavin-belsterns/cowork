// Purpose: Unit tests for RFC 9457 errors and error mapping (src/lib/errors.ts).
// Rules: standards/testing.md, standards/api.md. Verify status codes, instance matches requestId, problem URI format, omission of stack trace.
import { describe, expect, it } from 'vitest';
import {
  BookingConflictError,
  ForbiddenError,
  LockedError,
  NotFoundError,
  PasswordChangeRequiredError,
  problem,
  RequestChangedError,
  RequestInProgressError,
  RuleViolationError,
  toResponse,
  UnauthorizedError,
  ValidationError,
  VersionConflictError,
  mapDbError,
} from '@/lib/errors';

describe('src/lib/errors: RFC 9457 problem details and AppError classes', () => {
  const REQ_ID = '0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4001';

  describe('problem factory', () => {
    it('formats bare type names as /problems/<type>', () => {
      const p = problem(400, { type: 'validation', detail: 'Invalid field' });
      expect(p.type).toBe('/problems/validation');
      expect(p.title).toBe('Bad Request');
      expect(p.status).toBe(400);
      expect(p.detail).toBe('Invalid field');
    });

    it('uses about:blank when type is undefined', () => {
      const p = problem(500);
      expect(p.type).toBe('about:blank');
      expect(p.title).toBe('Internal Server Error');
      expect(p.status).toBe(500);
    });

    it('leaves full URIs untouched', () => {
      const p = problem(403, { type: 'https://example.com/probs/forbidden' });
      expect(p.type).toBe('https://example.com/probs/forbidden');
    });

    it('attaches instance and extensions when provided', () => {
      const p = problem(422, {
        type: 'rule-violation',
        instance: REQ_ID,
        extensions: { conflictId: '123' },
      });
      expect(p.instance).toBe(REQ_ID);
      expect(p.conflictId).toBe('123');
    });
  });

  describe('AppError classes and status codes', () => {
    it('UnauthorizedError sets status 401 and type unauthenticated', () => {
      const err = new UnauthorizedError();
      expect(err.status).toBe(401);
      expect(err.type).toBe('unauthenticated');
      expect(err.message).toBe('Please sign in again.');
    });

    it('ForbiddenError sets status 403 and type forbidden', () => {
      const err = new ForbiddenError();
      expect(err.status).toBe(403);
      expect(err.type).toBe('forbidden');
      expect(err.message).toBe('You do not have access to this.');
    });

    it('PasswordChangeRequiredError is a ForbiddenError subclass', () => {
      const err = new PasswordChangeRequiredError();
      expect(err).toBeInstanceOf(ForbiddenError);
      expect(err.status).toBe(403);
      expect(err.message).toBe('Set a new password to continue.');
    });

    it('NotFoundError sets status 404 and type not-found', () => {
      const err = new NotFoundError();
      expect(err.status).toBe(404);
      expect(err.type).toBe('not-found');
      expect(err.message).toBe('We could not find this item.');
    });

    it('ValidationError sets status 400 or 422 with issues extension', () => {
      const issues = [{ path: 'name', message: 'Required' }];
      const err400 = new ValidationError('Bad request', issues);
      expect(err400.status).toBe(400);
      expect(err400.type).toBe('validation');
      expect(err400.extensions?.issues).toEqual(issues);

      const err422 = new ValidationError('Rule violation', issues, 422);
      expect(err422.status).toBe(422);
      expect(err422.type).toBe('rule-violation');
    });

    it('BookingConflictError sets status 409 and type booking-conflict', () => {
      const err = new BookingConflictError();
      expect(err.status).toBe(409);
      expect(err.type).toBe('booking-conflict');
    });

    it('VersionConflictError sets status 409 and type version-conflict', () => {
      const err = new VersionConflictError();
      expect(err.status).toBe(409);
      expect(err.type).toBe('version-conflict');
    });

    it('RequestInProgressError sets status 409 and type request-in-progress', () => {
      const err = new RequestInProgressError();
      expect(err.status).toBe(409);
      expect(err.type).toBe('request-in-progress');
    });

    it('RequestChangedError sets status 422 and type request-changed', () => {
      const err = new RequestChangedError();
      expect(err.status).toBe(422);
      expect(err.type).toBe('request-changed');
    });

    it('RuleViolationError sets status 422 and type rule-violation', () => {
      const err = new RuleViolationError('Room is closed', { office: 'London' });
      expect(err.status).toBe(422);
      expect(err.type).toBe('rule-violation');
      expect(err.extensions).toEqual({ office: 'London' });
    });

    it('LockedError sets status 429 and Retry-After header', () => {
      const err = new LockedError(900);
      expect(err.status).toBe(429);
      expect(err.type).toBe('locked');
      expect(err.headers?.['retry-after']).toBe('900');
    });
  });

  describe('mapDbError', () => {
    it('returns AppError instances unmodified', () => {
      const original = new NotFoundError();
      expect(mapDbError(original)).toBe(original);
    });

    it('maps Postgres 23P01 exclusion violation to BookingConflictError', () => {
      const dbErr = { code: '23P01', message: 'conflicting key value violates exclusion constraint' };
      const mapped = mapDbError(dbErr);
      expect(mapped).toBeInstanceOf(BookingConflictError);
    });

    it('inspects nested meta, cause and driverAdapterError for SQLSTATE 23P01', () => {
      const nestedErr = {
        name: 'PrismaClientUnknownRequestError',
        meta: { originalCode: '23P01' },
      };
      expect(mapDbError(nestedErr)).toBeInstanceOf(BookingConflictError);

      const causeErr = {
        name: 'DriverError',
        cause: { code: '23P01' },
      };
      expect(mapDbError(causeErr)).toBeInstanceOf(BookingConflictError);
    });

    it('returns null for unknown database errors', () => {
      const foreignKeyErr = { code: '23503' };
      expect(mapDbError(foreignKeyErr)).toBeNull();
      expect(mapDbError(new Error('connection timeout'))).toBeNull();
    });
  });

  describe('toResponse', () => {
    it('converts AppError to RFC 9457 response matching request id', async () => {
      const err = new LockedError(300, 'Account locked');
      const res = toResponse(err, REQ_ID);

      expect(res.status).toBe(429);
      expect(res.headers.get('content-type')).toBe('application/problem+json');
      expect(res.headers.get('x-request-id')).toBe(REQ_ID);
      expect(res.headers.get('retry-after')).toBe('300');

      const body = await res.json();
      expect(body.type).toBe('/problems/locked');
      expect(body.title).toBe('Too Many Requests');
      expect(body.status).toBe(429);
      expect(body.detail).toBe('Account locked');
      expect(body.instance).toBe(REQ_ID);
    });

    it('omits stack trace and hides internal message for unexpected errors', async () => {
      const unexpected = new Error('Database password was password123 and failed at /var/app/db.ts:42');
      const res = toResponse(unexpected, REQ_ID);

      expect(res.status).toBe(500);
      expect(res.headers.get('content-type')).toBe('application/problem+json');
      expect(res.headers.get('x-request-id')).toBe(REQ_ID);

      const body = await res.json();
      expect(body.type).toBe('/problems/internal');
      expect(body.status).toBe(500);
      expect(body.instance).toBe(REQ_ID);
      expect(body.detail).toBe(
        `Something went wrong. Try again. If it happens again, give reference ${REQ_ID} to your admin.`,
      );

      // Verify no sensitive internal error message or stack trace leaks into response
      const jsonString = JSON.stringify(body);
      expect(jsonString).not.toContain('password123');
      expect(jsonString).not.toContain('/var/app/db.ts');
      expect(jsonString).not.toContain('stack');
    });
  });
});

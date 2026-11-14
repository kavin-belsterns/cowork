// Purpose: unit tests for src/lib/auth/form-state.ts.
import { describe, expect, it } from 'vitest';
import { ChangePasswordInput } from '@/contracts/auth';
import { LockedError, RuleViolationError, UnauthorizedError, ValidationError } from '@/lib/errors';
import { fieldErrorsFrom, internalCopy, stateFromError, validationState } from '@/lib/auth/form-state';

describe('E-001/AC-72 form state', () => {
  it('puts the AC-72 text at the new password field', () => {
    const parsed = ChangePasswordInput.safeParse({ currentPassword: 'x', newPassword: 'short', version: '1' });
    if (parsed.success) throw new Error('expected failure');
    const errors = fieldErrorsFrom(parsed.error, { newPassword: 'Use at least 12 characters.' }, 'req-1');
    expect(errors).toEqual({ newPassword: 'Use at least 12 characters.' });
    expect(validationState(errors)).toMatchObject({ summary: 'Use at least 12 characters.', type: 'validation' });
  });

  it('never shows raw zod text: over-length and unmapped fields get the internal copy', () => {
    const parsed = ChangePasswordInput.safeParse({ currentPassword: 'x', newPassword: 'a'.repeat(129), version: 'nope' });
    if (parsed.success) throw new Error('expected failure');
    const errors = fieldErrorsFrom(parsed.error, { currentPassword: 'Enter your current password.', newPassword: 'Use at least 12 characters.' }, 'req-1');
    expect(errors).toEqual({ form: internalCopy('req-1') });
    expect(internalCopy('req-1')).toContain('reference req-1');
  });

  it('maps expected errors and keeps the detail as the summary', () => {
    expect(stateFromError(new UnauthorizedError('Email or password is wrong.'))).toEqual({
      summary: 'Email or password is wrong.',
      fieldErrors: {},
      type: 'unauthenticated',
    });
    expect(stateFromError(new RuleViolationError('This account is not active.'))?.type).toBe('rule-violation');
    expect(stateFromError(new ValidationError('bad'))?.type).toBe('validation');
  });

  it('puts a message at a field when asked and adds Retry-After for locked', () => {
    expect(stateFromError(new UnauthorizedError('Your current password is wrong.'), { unauthenticated: 'currentPassword' })?.fieldErrors).toEqual({
      currentPassword: 'Your current password is wrong.',
    });
    expect(stateFromError(new LockedError(900))).toMatchObject({ type: 'locked', retryAfterSeconds: 900 });
  });

  it('returns undefined for an unexpected error so the caller rethrows', () => {
    expect(stateFromError(new Error('boom'))).toBeUndefined();
  });
});

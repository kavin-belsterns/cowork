'use client';
// Purpose: the own-password form. Calls changePasswordAction and shows its form state. No business rule here.
// Rules: spec S01 section 2 (copy, autocomplete, paste allowed, submit disabled while pending). Password fields are never stored.
import { useActionState } from 'react';
import { changePasswordAction } from '@/app/(app)/account/password/actions';
import { ErrorSummary } from '@/components/auth/error-summary';
import { isSignInRedirect, redirectTarget } from '@/components/auth/redirect';
import { TextField } from '@/components/auth/text-field';
import { clearFlash, setFlash } from '@/components/shell/flash';
import { Button } from '@/components/ui/button';
import type { FormState } from '@/lib/auth/form-state';

export function PasswordForm({ version }: { version: number }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(async (previous, formData) => {
    // The action redirects on success, so the next page reads this note and shows "Password changed.".
    // The note is cleared again when the action returns a state, throws, or redirects to /sign-in.
    setFlash('password.done');
    try {
      const result = await changePasswordAction(previous, formData);
      // A returned state means the change failed and the page stays. Success redirects and returns no state.
      if (result && typeof result === 'object' && 'type' in result) clearFlash();
      return result;
    } catch (err) {
      // A redirect to the role home is the success case, so the note stays. Any other end clears it.
      const target = redirectTarget(err);
      if (target === null || isSignInRedirect(target)) clearFlash();
      throw err;
    }
  }, null);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <ErrorSummary state={state} />
      <TextField
        id="currentPassword"
        name="currentPassword"
        label="Current password"
        type="password"
        autoComplete="current-password"
        required
        error={errors.currentPassword}
      />
      <TextField
        id="newPassword"
        name="newPassword"
        label="New password"
        help="Use 12 to 128 characters."
        type="password"
        autoComplete="new-password"
        required
        error={errors.newPassword}
      />
      <input type="hidden" name="version" value={version} />
      <Button type="submit" size="lg" disabled={pending} className="w-full md:w-auto md:self-start">
        Save password
      </Button>
    </form>
  );
}

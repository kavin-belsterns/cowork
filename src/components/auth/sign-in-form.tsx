'use client';
// Purpose: the sign-in form. Calls signInAction and shows its form state. No business rule here.
// Rules: spec S01 section 2 (copy, autocomplete, paste allowed, submit disabled while pending), standards/ui.md.
import { useActionState, useEffect, useState } from 'react';
import { signInAction } from '@/app/(auth)/sign-in/actions';
import { ErrorSummary } from '@/components/auth/error-summary';
import { TextField } from '@/components/auth/text-field';
import { clearFlash } from '@/components/shell/flash';
import { Button } from '@/components/ui/button';
import type { FormState } from '@/lib/auth/form-state';

export function SignInForm({ returnTo, expired }: { returnTo?: string; expired?: boolean }) {
  const [email, setEmail] = useState('');
  // React clears uncontrolled fields after an action. The email stays in state so a wrong password does not erase it.
  const [state, formAction, pending] = useActionState<FormState, FormData>(async (previous, formData) => {
    setEmail(String(formData.get('email') ?? ''));
    return signInAction(previous, formData);
  }, null);
  // Nobody is signed in here, so a leftover "Password changed." note is stale. Drop it.
  useEffect(() => {
    clearFlash();
  }, []);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      {expired ? (
        <p role="status" className="text-sm text-muted-foreground">
          Please sign in again.
        </p>
      ) : null}
      <ErrorSummary state={state} />
      <TextField
        id="email"
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={errors.email}
      />
      <TextField id="password" name="password" label="Password" type="password" autoComplete="current-password" required error={errors.password} />
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <Button type="submit" size="lg" disabled={pending} className="w-full md:w-auto md:self-start">
        Sign in
      </Button>
      <p className="text-sm text-muted-foreground">Forgot your password? Ask your office admin to reset it.</p>
    </form>
  );
}

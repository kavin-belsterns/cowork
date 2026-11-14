'use client';
// Purpose: the sign out control. It clears drafts and the flash note first, then the server action ends the session.
// Rules: spec S01 section 2 (drafts cleared on sign-out). signOutAction owns the session delete and the redirect.
import { signOutAction } from '@/app/(auth)/sign-in/actions';
import { clearDraftsSafely } from '@/components/shell/drafts';
import { clearFlash } from '@/components/shell/flash';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function signOutCleanup(): void {
  clearDraftsSafely();
  clearFlash();
}

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOutAction} onSubmit={signOutCleanup}>
      <Button type="submit" variant="ghost" className={cn('min-h-10 w-full justify-start px-3', className)}>
        Sign out
      </Button>
    </form>
  );
}

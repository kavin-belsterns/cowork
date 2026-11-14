'use client';
// Purpose: warn 5 minutes before the fixed 12 hour session end, then point to sign-in once it has ended.
// Rules: spec S01 section 2, E-001/AC-71, WCAG 2.2.1 (accepted exception). Timing comes from src/domain/auth/rules.ts.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { isSessionExpired, shouldWarn } from '@/domain/auth/rules';

type Phase = 'none' | 'warn' | 'ended';

export function SessionWarning({ expiresAt }: { expiresAt: string }) {
  const [phase, setPhase] = useState<Phase>('none');
  useEffect(() => {
    const end = new Date(expiresAt);
    const id = window.setInterval(() => {
      const now = new Date();
      setPhase(isSessionExpired(end, now) ? 'ended' : shouldWarn(end, now) ? 'warn' : 'none');
    }, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);
  return (
    <div role="status" data-testid="session-warning">
      {phase === 'warn' ? (
        <p className="rounded-md border border-border bg-muted p-3 text-sm text-foreground">
          Your session ends in 5 minutes. Save your work, then sign in again.
        </p>
      ) : null}
      {phase === 'ended' ? (
        <p className="rounded-md border border-destructive bg-background p-3 text-sm text-destructive">
          <Link href="/sign-in?reason=expired" className="underline">
            Please sign in again.
          </Link>
        </p>
      ) : null}
    </div>
  );
}

'use client';
// Purpose: the error state for the auth routes. Says what failed, what to do, and gives the reference id.
// Rules: standards/ui.md (retry, reference id), versions.md (installed Next 16.4 passes `retry`). Copy: design.md Errors, `internal`.
import { Button } from '@/components/ui/button';
import { internalCopy } from '@/lib/auth/form-state';

type RouteErrorProps = {
  error: Error & { digest?: string };
  retry: () => void;
  /** `main` when the route has no landmark of its own. */
  as?: 'div' | 'main';
};

export function RouteError({ error, retry, as: Tag = 'div' }: RouteErrorProps) {
  return (
    <Tag id={Tag === 'main' ? 'main' : undefined} className={Tag === 'main' ? 'flex min-h-screen items-center justify-center p-4' : 'w-full md:w-96'}>
      <div className="flex w-full flex-col gap-4 rounded-lg border border-border bg-background p-6 md:w-96">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-base text-muted-foreground">{internalCopy(error.digest ?? 'unknown')}</p>
        <Button type="button" size="lg" onClick={() => retry()} className="w-full md:w-auto">
          Try again
        </Button>
      </div>
    </Tag>
  );
}

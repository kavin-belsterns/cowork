'use client';

import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  const referenceId = error.digest ?? 'unknown';
  const handleRetry = () => {
    if (typeof retry === 'function') {
      retry();
    } else if (typeof reset === 'function') {
      reset();
    }
  };

  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground font-sans antialiased flex items-center justify-center p-4">
        <main className="max-w-md w-full rounded-lg border border-border bg-background p-6 shadow-sm">
          <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
          <p className="text-base text-muted-foreground mb-4">
            Something went wrong. Try again. If it happens again, give reference {referenceId} to your admin.
          </p>
          <Button type="button" onClick={handleRetry}>
            Try again
          </Button>
        </main>
      </body>
    </html>
  );
}

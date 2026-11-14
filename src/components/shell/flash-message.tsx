'use client';
// Purpose: the status region that shows a one time note after a redirect. The region is always in the page so readers announce it.
// Rules: standards/ui.md (inline confirmation after a write), interface-rules.md (role status).
import { useEffect, useState } from 'react';
import { clearFlash, readFlash } from '@/components/shell/flash';

export function FlashMessage() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => {
      const found = readFlash();
      if (found !== null) {
        clearFlash();
        setMessage(found);
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <div role="status" data-testid="flash">
      {message ? <p className="rounded-md border border-border bg-muted p-3 text-sm text-foreground">{message}</p> : null}
    </div>
  );
}

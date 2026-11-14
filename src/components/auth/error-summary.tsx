'use client';
// Purpose: the form error summary. It takes focus each time a new error state arrives (WCAG 3.3.1).
// Rules: standards/ui.md, interface-rules.md (error summary receives focus). The text states what happened and what to do.
import { useEffect, useRef } from 'react';
import { CircleAlert } from 'lucide-react';
import type { FormState } from '@/lib/auth/form-state';

export function ErrorSummary({ state }: { state: FormState | undefined }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state) ref.current?.focus();
  }, [state]);
  if (!state) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      data-type={state.type}
      className="flex items-start gap-2 rounded-md border border-destructive bg-background p-3 text-sm text-destructive"
    >
      <CircleAlert aria-hidden="true" className="mt-1 size-4 shrink-0" />
      <p className="font-medium">{state.summary}</p>
    </div>
  );
}

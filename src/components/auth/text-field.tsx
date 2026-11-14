// Purpose: one labelled text input with its error message, linked by aria-describedby.
// Rules: standards/ui.md (token classes only, visible focus ring, 24 px targets), interface-rules.md (WCAG 3.3.1).
import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type TextFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id' | 'name'> & {
  id: string;
  name: string;
  label: string;
  /** Short help shown under the label. Linked by aria-describedby. */
  help?: string;
  /** Error text for this field. Shown as text, never by colour alone. */
  error?: string;
};

export function TextField({ id, name, label, help, error, className, ...input }: TextFieldProps) {
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      {help ? (
        <p id={helpId} className="text-sm text-muted-foreground">
          {help}
        </p>
      ) : null}
      <Input
        {...input}
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          error && 'border-destructive',
          className,
        )}
      />
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

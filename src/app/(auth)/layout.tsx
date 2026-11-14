// Purpose: the centred frame for the auth pages. Centring is allowed for auth (standards/ui.md).
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      {children}
    </main>
  );
}

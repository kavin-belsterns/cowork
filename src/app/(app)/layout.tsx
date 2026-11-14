// Purpose: the shared frame for signed-in pages. It holds the skip link only. PageShell renders inside each page.tsx.
import type { ReactNode } from 'react';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-background focus:p-2 focus:text-foreground"
      >
        Skip to main content
      </a>
      {children}
    </>
  );
}

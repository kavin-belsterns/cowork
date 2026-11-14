// Purpose: the frame around every signed-in page: role menu, session warning, status note and draft keeper.
// Rules: spec S01 section 2. Rendered inside each page.tsx, not in layout.tsx, so each page passes its own session.
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { SessionUser } from '@/contracts/auth';
import { DraftKeeper } from '@/components/shell/draft-keeper';
import { FlashMessage } from '@/components/shell/flash-message';
import { COMMON_ITEMS, menuItemsFor } from '@/components/shell/menu';
import { RoleMenu } from '@/components/shell/role-menu';
import { SessionWarning } from '@/components/shell/session-warning';
import { DRAFT_SCOPE_ATTRIBUTE } from '@/components/shell/drafts';

export function PageShell({ session, children }: { session: SessionUser; children: ReactNode }) {
  const items = [...menuItemsFor(session), ...COMMON_ITEMS];
  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <div className="border-b border-border p-4 lg:min-h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <header className="mb-2 flex flex-col gap-1">
          <Link href="/" className="text-lg font-semibold text-foreground">
            Room Booking
          </Link>
          <p className="text-sm text-muted-foreground">{session.name}</p>
        </header>
        <RoleMenu items={items} />
      </div>
      <main id="main" tabIndex={-1} {...{ [DRAFT_SCOPE_ATTRIBUTE]: '' }} className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-6 lg:p-8">
        <SessionWarning expiresAt={session.expiresAt} />
        <FlashMessage />
        {children}
      </main>
      <DraftKeeper userId={session.id} />
    </div>
  );
}

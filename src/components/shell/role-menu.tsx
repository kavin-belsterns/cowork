'use client';
// Purpose: the menu. Behind a Menu button at 375, a top bar row at 768, a side column at 1280.
// Rules: spec S01 section 2 (breakpoints), standards/ui.md (visible focus, Esc closes, 24 px targets).
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu as MenuIcon, X } from 'lucide-react';
import type { MenuItem } from '@/components/shell/menu';
import { Button } from '@/components/ui/button';
import { SignOutButton } from '@/components/shell/sign-out-button';
import { cn } from '@/lib/utils';

const linkClass =
  'flex min-h-10 items-center rounded-md px-3 text-sm text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export function RoleMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div>
      <Button
        ref={button}
        type="button"
        variant="outline"
        aria-expanded={open}
        aria-controls="main-menu"
        onClick={() => setOpen((v) => !v)}
        className="min-h-10 px-3 md:hidden"
      >
        {open ? <X aria-hidden="true" className="size-4" /> : <MenuIcon aria-hidden="true" className="size-4" />}
        Menu
      </Button>
      <nav aria-label="Main" id="main-menu" className={cn('mt-2 md:mt-0 md:block', open ? 'block' : 'hidden')}>
        <ul className="flex flex-col gap-1 md:flex-row md:flex-wrap lg:flex-col">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
                className={cn(linkClass, pathname === item.href && 'bg-accent text-accent-foreground')}
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <SignOutButton />
          </li>
        </ul>
      </nav>
    </div>
  );
}

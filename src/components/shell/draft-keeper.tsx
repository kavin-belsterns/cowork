'use client';
// Purpose: keep form drafts in sessionStorage for the signed-in user and put them back on the same page.
// Rules: design.md UX, spec S01 section 2. Keyed by user id and path. Cleared for another user. Password fields never stored.
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { DRAFT_SCOPE_ATTRIBUTE, claimDrafts, draftKey, isDraftField, type DraftField } from '@/components/shell/drafts';

type Saved = Record<string, string>;

function setValue(el: DraftField, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

export function DraftKeeper({ userId }: { userId: string }) {
  const pathname = usePathname();
  useEffect(() => {
    let storage: Storage;
    try {
      storage = window.sessionStorage;
    } catch {
      return;
    }
    const scope = document.querySelector(`[${DRAFT_SCOPE_ATTRIBUTE}]`);
    if (!scope) return;
    claimDrafts(storage, userId);
    const key = draftKey(userId, pathname);

    const read = (): Saved => {
      try {
        const parsed: unknown = JSON.parse(storage.getItem(key) ?? '{}');
        return parsed !== null && typeof parsed === 'object' ? (parsed as Saved) : {};
      } catch {
        return {};
      }
    };

    // Put a saved value into a field that is still empty. A value the user already typed is never replaced.
    const restoreIn = (root: Element) => {
      const saved = read();
      const fields = [root, ...root.querySelectorAll('input, textarea')].filter(isDraftField);
      for (const field of fields) {
        const value = saved[field.name];
        if (typeof value === 'string' && field.value === '') setValue(field, value);
      }
    };

    const onInput = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element) || !isDraftField(target)) return;
      const saved = read();
      if (target.value === '') delete saved[target.name];
      else saved[target.name] = target.value;
      try {
        storage.setItem(key, JSON.stringify(saved));
      } catch {
        // Storage full or blocked. The draft is lost, the form still works.
      }
    };

    restoreIn(scope);
    // Forms that appear after the page loads are restored too.
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) restoreIn(node);
        });
      }
    });
    observer.observe(scope, { childList: true, subtree: true });
    document.addEventListener('input', onInput);
    return () => {
      observer.disconnect();
      document.removeEventListener('input', onInput);
    };
  }, [userId, pathname]);
  return null;
}

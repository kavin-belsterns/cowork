// Purpose: the rules for the draft keeper. Which fields may be stored, where, and when drafts are cleared.
// Rules: design.md UX (drafts in sessionStorage keyed by user id, never for password fields), spec S01 section 2.
export const DRAFT_PREFIX = 'draft:v1:';
export const DRAFT_OWNER_KEY = 'draft-owner';
/** Fields inside an element with this attribute are kept. */
export const DRAFT_SCOPE_ATTRIBUTE = 'data-draft-scope';

const TEXT_TYPES = new Set(['text', 'email', 'tel', 'url', 'search', 'number', 'date', 'time', 'datetime-local', 'month', 'week']);
const SECRET_AUTOCOMPLETE = /password|one-time-code|cc-/i;

export type DraftField = HTMLInputElement | HTMLTextAreaElement;

/** True for a named text field in the draft scope. Password and secret fields never qualify. */
export function isDraftField(el: Element): el is DraftField {
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) return false;
  if (!el.name || el.hasAttribute('data-no-draft')) return false;
  if (el instanceof HTMLInputElement && !TEXT_TYPES.has(el.type)) return false;
  if (SECRET_AUTOCOMPLETE.test(el.autocomplete) || /pass/i.test(el.name)) return false;
  return el.closest(`[${DRAFT_SCOPE_ATTRIBUTE}]`) !== null;
}

export function draftKey(userId: string, path: string): string {
  return `${DRAFT_PREFIX}${userId}:${path}`;
}

/** Remove every draft and the owner note. Called at sign-out. */
export function clearDrafts(storage: Storage): void {
  const doomed: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && key.startsWith(DRAFT_PREFIX)) doomed.push(key);
  }
  for (const key of doomed) storage.removeItem(key);
  storage.removeItem(DRAFT_OWNER_KEY);
}

/** Keep drafts for the same user. A different user starts clean. */
export function claimDrafts(storage: Storage, userId: string): void {
  if (storage.getItem(DRAFT_OWNER_KEY) === userId) return;
  clearDrafts(storage);
  storage.setItem(DRAFT_OWNER_KEY, userId);
}

/** Clear drafts from a component that has no storage in hand. Storage can be blocked, so never throw. */
export function clearDraftsSafely(): void {
  try {
    clearDrafts(window.sessionStorage);
  } catch {
    // Nothing stored, nothing to clear.
  }
}

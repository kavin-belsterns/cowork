// Purpose: a one time note that survives a redirect, so the next page can say "Password changed.".
// Rules: spec S01 section 2 (success state). Only a known key is stored. Text is mapped here, never read back from storage.
export const FLASH_KEY = 'flash';

export const FLASH_COPY = {
  'password.done': 'Password changed.',
} as const;

export type FlashKey = keyof typeof FLASH_COPY;

export function setFlash(key: FlashKey): void {
  try {
    window.sessionStorage.setItem(FLASH_KEY, key);
  } catch {
    // Storage can be blocked. The change still worked, only the note is lost.
  }
}

export function clearFlash(): void {
  try {
    window.sessionStorage.removeItem(FLASH_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** The note text for the stored key, or null. Unknown values give null. */
export function readFlash(): string | null {
  try {
    const key = window.sessionStorage.getItem(FLASH_KEY);
    return key !== null && key in FLASH_COPY ? FLASH_COPY[key as FlashKey] : null;
  } catch {
    return null;
  }
}

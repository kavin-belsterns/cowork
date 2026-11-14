// Purpose: read the target of a redirect that surfaces as a thrown error. One place knows Next's digest format.
// Rules: the digest is "NEXT_REDIRECT;<type>;<url>;<status>;". Anything else is not a redirect.
/** The redirect path, or null when the error is not a redirect. */
export function redirectTarget(err: unknown): string | null {
  if (typeof err !== 'object' || err === null || !('digest' in err)) return null;
  const parts = String((err as { digest: unknown }).digest).split(';');
  if (parts[0] !== 'NEXT_REDIRECT') return null;
  return parts[2] ?? null;
}

/** True when the redirect leads to the sign-in page, for example an expired session. */
export function isSignInRedirect(target: string): boolean {
  return target === '/sign-in' || target.startsWith('/sign-in?');
}

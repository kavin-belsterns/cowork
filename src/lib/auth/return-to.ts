// Purpose: pick the path after sign-in. Open redirects are blocked here.
// Rules: spec S01 section 5 (OWASP A07). The ReturnTo contract allows only one `/` then a path. Anything else gives the role home.
import { ReturnTo } from '@/contracts/auth';
import type { Role } from '@/contracts/permissions';
import { roleHome } from '@/domain/auth/rules';

/** The checked path, or undefined when it is missing or unsafe. */
export function checkedReturnTo(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const parsed = ReturnTo.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

/** The checked path, else the role home. */
export function resolveReturnTo(raw: string | undefined, role: Role): string {
  return checkedReturnTo(raw) ?? roleHome(role);
}

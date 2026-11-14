// Purpose: the client IP for the IP limit.
// Rules: spec S01 section 3. One trusted hop: the proxy appends the real client address, so the last value is the one to trust.
// Earlier values come from the client and can be forged. The IP is never logged.
import { isIP } from 'node:net';

export const UNKNOWN_IP = 'unknown';

/** Last `X-Forwarded-For` value. No header or a value that is not an IP gives 'unknown'. */
export function clientIp(headers: { get(name: string): string | null }): string {
  const raw = headers.get('x-forwarded-for');
  if (!raw) return UNKNOWN_IP;
  const last = raw.split(',').at(-1)?.trim() ?? '';
  return isIP(last) !== 0 ? last : UNKNOWN_IP;
}

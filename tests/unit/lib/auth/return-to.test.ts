// Purpose: unit tests for src/lib/auth/return-to.ts. Open redirects fall back to the role home.
import { describe, expect, it } from 'vitest';
import { checkedReturnTo, resolveReturnTo } from '@/lib/auth/return-to';

describe('E-001/AC-47 return path', () => {
  it('keeps a same-origin relative path', () => {
    expect(checkedReturnTo('/rooms?day=2026-11-14')).toBe('/rooms?day=2026-11-14');
    expect(resolveReturnTo('/bookings', 'employee')).toBe('/bookings');
  });

  it.each(['//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', '/a b', '/a\nb', 'rooms', ''])(
    'drops %j',
    (raw) => {
      expect(checkedReturnTo(raw)).toBeUndefined();
    },
  );

  it('falls back to the role home for missing or unsafe paths', () => {
    expect(resolveReturnTo(undefined, 'platform_admin')).toBe('/admin/offices');
    expect(resolveReturnTo('//evil.example', 'receptionist')).toBe('/reception');
    expect(resolveReturnTo('https://evil.example', 'employee')).toBe('/rooms');
  });
});

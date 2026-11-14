// Purpose: unit tests for src/lib/auth/client-ip.ts. One trusted hop: the last X-Forwarded-For value.
import { describe, expect, it } from 'vitest';
import { UNKNOWN_IP, clientIp } from '@/lib/auth/client-ip';

const headers = (value: string | null) => ({ get: (name: string) => (name.toLowerCase() === 'x-forwarded-for' ? value : null) });

describe('E-001/AC-48 client IP', () => {
  it('takes the only value', () => {
    expect(clientIp(headers('203.0.113.7'))).toBe('203.0.113.7');
  });

  it('takes the last value, not the forged first one', () => {
    expect(clientIp(headers('1.2.3.4, 5.6.7.8,  203.0.113.7 '))).toBe('203.0.113.7');
  });

  it('accepts IPv6', () => {
    expect(clientIp(headers('2001:db8::1'))).toBe('2001:db8::1');
  });

  it('gives unknown for no header, an empty value or a non-IP', () => {
    expect(clientIp(headers(null))).toBe(UNKNOWN_IP);
    expect(clientIp(headers(''))).toBe(UNKNOWN_IP);
    expect(clientIp(headers('1.2.3.4, not-an-ip'))).toBe(UNKNOWN_IP);
  });
});

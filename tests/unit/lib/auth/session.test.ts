// Purpose: unit tests for src/lib/auth/session.ts. The data call and next/headers are mocked.
// Rules: spec S01 section 3 (getSession fills SessionUser from users, expired or deactivated gives null).
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('react', () => ({ cache: <T>(fn: T) => fn }));
const cookieGet = vi.fn();
vi.mock('next/headers', () => ({ cookies: async () => ({ get: cookieGet }) }));
vi.mock('@/data/session', () => ({ findSessionByTokenHash: vi.fn() }));

import { SessionUser } from '@/contracts/auth';
import { findSessionByTokenHash } from '@/data/session';
import { getSession, sessionFromToken, toSessionUser } from '@/lib/auth/session';
import { hashToken } from '@/lib/auth/token';

const row = {
  userId: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
  name: 'Ann Admin',
  role: 'office_admin' as const,
  officeId: '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c',
  mustChangePassword: true,
  version: 3,
  expiresAt: new Date('2026-11-14T22:00:00.000Z'),
};

describe('E-001/AC-71 getSession', () => {
  beforeEach(() => {
    vi.mocked(findSessionByTokenHash).mockReset();
    cookieGet.mockReset();
  });

  it('maps the row to a valid SessionUser with expiresAt', () => {
    const user = toSessionUser(row);
    expect(SessionUser.parse(user)).toEqual(user);
    expect(user).toMatchObject({ id: row.userId, role: 'office_admin', mustChangePassword: true, version: 3, expiresAt: '2026-11-14T22:00:00.000Z' });
  });

  it('looks up by the SHA-256 of the cookie value', async () => {
    vi.mocked(findSessionByTokenHash).mockResolvedValue(row);
    const now = new Date('2026-11-14T10:00:00Z');
    expect((await sessionFromToken('raw-token', now))?.id).toBe(row.userId);
    expect(findSessionByTokenHash).toHaveBeenCalledWith(hashToken('raw-token'), now);
  });

  it('gives null with no cookie and does not query', async () => {
    cookieGet.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
    expect(findSessionByTokenHash).not.toHaveBeenCalled();
  });

  it('gives null for an expired or deactivated row (data returns null)', async () => {
    cookieGet.mockReturnValue({ value: 'raw-token' });
    vi.mocked(findSessionByTokenHash).mockResolvedValue(null);
    expect(await getSession()).toBeNull();
  });

  it('reads the __Host-session cookie', async () => {
    cookieGet.mockReturnValue({ value: 'raw-token' });
    vi.mocked(findSessionByTokenHash).mockResolvedValue(row);
    expect((await getSession())?.name).toBe('Ann Admin');
    expect(cookieGet).toHaveBeenCalledWith('__Host-session');
  });
});

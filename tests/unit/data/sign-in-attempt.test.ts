// Purpose: unit tests for src/data/sign-in-attempt.ts against the live test database as role app_web.
// Rules: spec S01 section 6. Fixtures use a separate pg client on DATABASE_URL_MIGRATOR. Unique hashes per run. Rows are deleted after.
// The tests fail when the database is unreachable. Nothing is skipped.
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { clearFailures, countDistinctEmailsByIp, countFailures, recordFailure } from '@/data/sign-in-attempt';

const run = randomUUID();
const hashA = `ut-a-${run}`;
const hashB = `ut-b-${run}`;
const ip = `ut-ip-${run}`;
const otherIp = `ut-ip2-${run}`;
const now = new Date('2026-11-14T10:00:00.000Z');
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
const since = minutesAgo(15);

let admin: Client;

beforeAll(async () => {
  const url = process.env.DATABASE_URL_MIGRATOR;
  if (!url) throw new Error('DATABASE_URL_MIGRATOR is not set.');
  admin = new Client({ connectionString: url });
  await admin.connect();
});

afterAll(async () => {
  if (!admin) return;
  await admin.query('DELETE FROM sign_in_attempts WHERE email_hash = ANY($1) OR ip = ANY($2)', [[hashA, hashB], [ip, otherIp]]);
  await admin.end();
});

describe('src/data/sign-in-attempt', () => {
  it('counts failures per email hash inside the window and ignores older rows', async () => {
    await recordFailure(hashA, ip, minutesAgo(1));
    await recordFailure(hashA, ip, minutesAgo(14));
    await recordFailure(hashA, ip, minutesAgo(16));
    await recordFailure(hashB, otherIp, minutesAgo(2));
    expect(await countFailures(hashA, since)).toBe(2);
    expect(await countFailures(hashB, since)).toBe(1);
  });

  it('counts a failure exactly at the window start', async () => {
    const edge = `ut-edge-${run}`;
    await recordFailure(edge, ip, since);
    expect(await countFailures(edge, since)).toBe(1);
    expect(await countFailures(edge, new Date(since.getTime() + 1))).toBe(0);
    await admin.query('DELETE FROM sign_in_attempts WHERE email_hash = $1', [edge]);
  });

  it('counts distinct email hashes per IP in the window', async () => {
    await recordFailure(hashB, ip, minutesAgo(3));
    // ip holds hashA (3 rows, 2 in window) and hashB (1 row in window): 2 distinct.
    expect(await countDistinctEmailsByIp(ip, since)).toBe(2);
    expect(await countDistinctEmailsByIp(otherIp, since)).toBe(1);
  });

  it('does not count a hash whose only rows are older than the window', async () => {
    const oldIp = `ut-old-${run}`;
    await recordFailure(`ut-old-hash-${run}`, oldIp, minutesAgo(30));
    expect(await countDistinctEmailsByIp(oldIp, since)).toBe(0);
    await admin.query('DELETE FROM sign_in_attempts WHERE ip = $1', [oldIp]);
  });

  it('returns 0 for an unknown hash and an unknown IP', async () => {
    expect(await countFailures(`ut-none-${run}`, since)).toBe(0);
    expect(await countDistinctEmailsByIp(`ut-none-${run}`, since)).toBe(0);
  });

  it('clears every row for one hash and leaves other hashes alone', async () => {
    const mine = `ut-clear-${run}`;
    const other = `ut-clear-other-${run}`;
    await recordFailure(mine, ip, minutesAgo(1));
    await recordFailure(mine, ip, minutesAgo(40));
    await recordFailure(other, ip, minutesAgo(1));
    await clearFailures(mine);
    expect(await countFailures(mine, minutesAgo(60))).toBe(0);
    expect(await countFailures(other, since)).toBe(1);
    await clearFailures(`ut-clear-none-${run}`);
    await admin.query('DELETE FROM sign_in_attempts WHERE email_hash = $1', [other]);
  });
});

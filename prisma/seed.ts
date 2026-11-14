// Purpose: the shared test seed. Every later e2e and integration test starts from this data. Safe to run again.
// Rules: standards/data.md, standards/security.md. Runs as the migrator role (DATABASE_URL_MIGRATOR) through `prisma db seed`.
// Ids are fixed uuid v7 shaped values, so a re-run updates the same rows and tests can name them. Times move to today on each run.
// Raw SQL through pg, so src/lib/db.ts stays the only PrismaClient. Table and column names below are constants, values are parameters.
// Users get one known test password. It comes from SEED_PASSWORD. A test default applies only when NODE_ENV is not production.
import { hash } from '@node-rs/argon2';
import { TZDate } from '@date-fns/tz';
import pg from 'pg';

type Row = Record<string, unknown>;

const TEST_DEFAULT_PASSWORD = 'Test-Password-1234';
const DAY_MS = 24 * 60 * 60 * 1000;

/** Fixed id: version 7 and variant bits are set, so z.uuid() accepts it. `kind` groups tables, `n` numbers the row. */
const id = (kind: number, n: number) => `01920000-0000-7000-8000-${String(kind).padStart(4, '0')}${String(n).padStart(8, '0')}`;
const K = { office: 1, room: 2, user: 3, booking: 4, visit: 5 } as const;

const OFFICES = [
  { n: 1, code: 'chn', name: 'Chennai', zone: 'Asia/Kolkata' },
  { n: 2, code: 'lon', name: 'London', zone: 'Europe/London' },
] as const;
const ROOM_TEMPLATES = [
  { name: 'Marina', floor: 1, size: 2 },
  { name: 'Kaveri', floor: 1, size: 4 },
  { name: 'Thames', floor: 2, size: 8 },
  { name: 'Atrium', floor: 2, size: 12 },
] as const;

async function upsert(client: pg.Client, table: string, rows: Row[], conflict: string[], touchUpdatedAt: boolean): Promise<void> {
  for (const row of rows) {
    const cols = Object.keys(row);
    const insert = [...cols, ...(touchUpdatedAt ? ['updated_at'] : [])];
    const values = [...cols.map((c) => row[c]), ...(touchUpdatedAt ? [new Date()] : [])];
    const marks = insert.map((_, i) => `$${i + 1}`).join(', ');
    const names = insert.map((c) => `"${c}"`).join(', ');
    const update = insert.filter((c) => !conflict.includes(c)).map((c) => `"${c}" = EXCLUDED."${c}"`);
    const target = conflict.map((c) => `"${c}"`).join(', ');
    const action = update.length > 0 ? `DO UPDATE SET ${update.join(', ')}` : 'DO NOTHING';
    await client.query(`INSERT INTO "${table}" (${names}) VALUES (${marks}) ON CONFLICT (${target}) ${action}`, values);
  }
}

/** Local calendar date in a zone, as YYYY-MM-DD, `offsetDays` from today. */
function localDate(zone: string, offsetDays: number): string {
  const now = TZDate.tz(zone);
  const d = new TZDate(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays, 12, 0, 0, 0, zone);
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The instant of a local wall clock time on a local date in a zone. */
function at(zone: string, date: string, hhmm: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const [h, min] = hhmm.split(':').map(Number) as [number, number];
  return new Date(new TZDate(y, m - 1, d, h, min, 0, 0, zone).getTime());
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL_MIGRATOR;
  if (!url) throw new Error('Missing environment variable: DATABASE_URL_MIGRATOR');
  const password = process.env.SEED_PASSWORD ?? (process.env.NODE_ENV !== 'production' ? TEST_DEFAULT_PASSWORD : undefined);
  if (!password) throw new Error('Missing environment variable: SEED_PASSWORD (required when NODE_ENV is production)');
  const passwordHash = await hash(password); // Argon2id by default, one hash shared by every seed user

  const offices: Row[] = [];
  const hours: Row[] = [];
  const rooms: Row[] = [];
  const users: Row[] = [];
  const bookings: Row[] = [];
  const visits: Row[] = [];
  const now = new Date();

  const user = (n: number, email: string, name: string, role: string, officeId: string | null, extra: Row = {}): Row => ({
    id: id(K.user, n), office_id: officeId, email, name, role, phone: null, desk: null, password_hash: passwordHash,
    deactivated_at: null, must_change_password: false, temp_password_expires_at: null, version: 1, created_by: null, ...extra,
  });

  users.push(user(1, 'platform.admin@example.test', 'Priya Platform', 'platform_admin', null));

  for (const o of OFFICES) {
    const officeId = id(K.office, o.n);
    offices.push({ id: officeId, name: o.name, time_zone: o.zone, version: 1, created_by: null });
    for (let weekday = 1; weekday <= 5; weekday++) {
      hours.push({ office_id: officeId, weekday, opens_at: '08:00:00', closes_at: '20:00:00', created_by: null });
    }
    ROOM_TEMPLATES.forEach((r, i) => {
      rooms.push({ id: id(K.room, o.n * 10 + i + 1), office_id: officeId, name: r.name, floor: r.floor, size: r.size, version: 1, deleted_at: null, created_by: null });
    });

    const base = o.n * 10;
    const admin = user(base + 1, `office.admin.${o.code}@example.test`, `Asha Admin ${o.name}`, 'office_admin', officeId, { desk: 'A-01' });
    const employee = user(base + 2, `employee.${o.code}@example.test`, `Eli Employee ${o.name}`, 'employee', officeId, { phone: '+91 98765 43210', desk: 'B-12' });
    const reception = user(base + 3, `receptionist.${o.code}@example.test`, `Rita Reception ${o.name}`, 'receptionist', officeId, { desk: 'FRONT' });
    const mustChange = user(base + 4, `must.change.${o.code}@example.test`, `Mani Mustchange ${o.name}`, 'employee', officeId, {
      must_change_password: true,
      temp_password_expires_at: new Date(now.getTime() + 7 * DAY_MS),
    });
    users.push(admin, employee, reception, mustChange);
    if (o.n === 1) {
      users.push(user(base + 5, `deactivated.${o.code}@example.test`, `Dev Deactivated ${o.name}`, 'employee', officeId, { deactivated_at: new Date(now.getTime() - 30 * DAY_MS) }));
    }

    const today = localDate(o.zone, 0);
    const room = (i: number) => id(K.room, o.n * 10 + i);
    const booking = (n: number, roomId: string, ownerId: unknown, from: string, to: string, attendees: number, status = 'confirmed'): Row => ({
      id: id(K.booking, o.n * 10 + n), room_id: roomId, owner_id: ownerId, series_id: null,
      starts_at: at(o.zone, today, from), ends_at: at(o.zone, today, to), attendees, status, version: 1, created_by: null,
    });
    // Back to back slots in one room are allowed. The cancelled row overlaps them and must not clash (ADR-0006).
    bookings.push(
      booking(1, room(1), employee.id, '09:00', '10:00', 2),
      booking(2, room(1), admin.id, '10:00', '11:00', 2),
      booking(3, room(2), employee.id, '14:00', '15:30', 4),
      booking(4, room(1), employee.id, '09:30', '10:30', 2, 'cancelled'),
    );

    const visit = (n: number, date: string, name: string | null, status: string, extra: Row = {}): Row => ({
      id: id(K.visit, o.n * 100 + n), office_id: officeId, host_id: employee.id,
      name, email: name ? `visitor${o.n}${n}@example.test` : null, phone: name ? '+44 20 7946 0000' : null, company: name ? 'Example Supplies' : null,
      visit_date: date, status, checked_in_at: null, checked_in_by: null, checked_out_at: null, host_seen_at: null, anonymised_at: null,
      version: 1, created_by: employee.id, ...extra,
    });
    const arrived = at(o.zone, today, '09:05');
    const old = (days: number) => localDate(o.zone, -days);
    visits.push(
      visit(1, today, 'Vera Visitor', 'expected'),
      visit(2, today, 'Walt Walkin', 'checked_in', { checked_in_at: arrived, checked_in_by: reception.id }),
      visit(3, today, 'Olga Outgoing', 'checked_out', { checked_in_at: arrived, checked_in_by: reception.id, checked_out_at: at(o.zone, today, '09:50'), host_seen_at: at(o.zone, today, '09:10') }),
      visit(4, today, 'Cara Cancelled', 'cancelled'),
      // Earlier day still checked in (Q5 of the reception view).
      visit(5, old(1), 'Late Leaver', 'checked_in', { checked_in_at: at(o.zone, old(1), '16:00'), checked_in_by: reception.id }),
      // Older than 90 days. Two still hold personal data (purge test), one is already anonymised.
      visit(6, old(120), 'Oscar Old', 'checked_out', { checked_in_at: at(o.zone, old(120), '10:00'), checked_in_by: reception.id, checked_out_at: at(o.zone, old(120), '11:00') }),
      visit(7, old(91), 'Nora Nearlyold', 'checked_out', { checked_in_at: at(o.zone, old(91), '10:00'), checked_in_by: reception.id, checked_out_at: at(o.zone, old(91), '11:00') }),
      visit(8, old(200), null, 'checked_out', { checked_in_at: at(o.zone, old(200), '10:00'), checked_in_by: reception.id, checked_out_at: at(o.zone, old(200), '11:00'), anonymised_at: new Date(now.getTime() - 110 * DAY_MS) }),
    );
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('BEGIN');
    await upsert(client, 'offices', offices, ['id'], true);
    await upsert(client, 'office_hours', hours, ['office_id', 'weekday'], true);
    await upsert(client, 'rooms', rooms, ['id'], true);
    await upsert(client, 'users', users, ['id'], true);
    await upsert(client, 'bookings', bookings, ['id'], true);
    await upsert(client, 'visits', visits, ['id'], true);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }

  process.stdout.write(`seed ok: ${offices.length} offices, ${rooms.length} rooms, ${users.length} users, ${bookings.length} bookings, ${visits.length} visits\n`);
}

main().catch((err: unknown) => {
  process.stderr.write(`seed failed: ${err instanceof Error ? err.message : 'unknown error'}\n`);
  process.exit(1);
});

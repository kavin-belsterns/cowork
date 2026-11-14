import { describe, expect, it } from 'vitest';
import {
  ArrivalNotice,
  BadgeView,
  CheckInInput,
  CheckOutInput,
  TodayView,
  TodayVisit,
  Visit,
  VisitCancelInput,
  VisitCreateInput,
  VisitSearchInput,
  VisitSeenInput,
  WalkInInput,
} from '@/contracts/visit';
import { ID, ID2, LATER, NOW, checkSchema } from './harness';

const create = { name: 'Vik Rao', company: 'Acme', email: 'vik@example.com', phone: '+91 98765 43210', officeId: ID, visitDate: '2026-11-16' };

checkSchema({
  name: 'VisitCreateInput',
  schema: VisitCreateInput,
  valid: create,
  required: ['name', 'officeId', 'visitDate'],
  bad: {
    name: ['', ' ', 'n'.repeat(121)],
    company: ['c'.repeat(121)],
    email: ['nope', `${'a'.repeat(250)}@example.com`],
    phone: ['abc', '12345'],
    officeId: ['x', ''],
    visitDate: ['', '2026-02-30', 'today'],
  },
});

describe('VisitCreateInput details', () => {
  it('has no host field: the host is the caller', () => {
    expect(VisitCreateInput.safeParse({ ...create, hostId: ID }).success).toBe(false);
  });

  it('lets company, email and phone stay blank', () => {
    const r = VisitCreateInput.parse({ name: 'Vik', company: '', email: '', phone: '', officeId: ID, visitDate: '2026-11-16' });
    expect([r.company, r.email, r.phone]).toEqual([undefined, undefined, undefined]);
  });
});

checkSchema({
  name: 'VisitCancelInput',
  schema: VisitCancelInput,
  valid: { visitId: ID, version: 1 },
  required: ['visitId', 'version'],
  bad: { visitId: ['x'], version: [0, ''] },
});

checkSchema({
  name: 'WalkInInput',
  schema: WalkInInput,
  valid: { name: 'Vik Rao', company: 'Acme', email: 'vik@example.com', phone: '+91 98765 43210', officeId: ID, hostId: ID2 },
  required: ['name', 'officeId', 'hostId'],
  bad: { name: [''], company: ['c'.repeat(121)], email: ['nope'], phone: ['abc'], officeId: ['x'], hostId: ['x', ''] },
});

for (const [name, schema] of [
  ['CheckInInput', CheckInInput],
  ['CheckOutInput', CheckOutInput],
] as const) {
  checkSchema({ name, schema, valid: { visitId: ID, version: 1 }, required: ['visitId', 'version'], bad: { visitId: ['x'], version: [0, ''] } });
}

checkSchema({
  name: 'VisitSearchInput',
  schema: VisitSearchInput,
  valid: { query: 'Vik', officeId: ID },
  required: ['query'],
  bad: { query: ['', '   ', 'q'.repeat(121)], officeId: ['x'] },
});

checkSchema({
  name: 'VisitSeenInput',
  schema: VisitSeenInput,
  valid: { visitId: ID },
  required: ['visitId'],
  bad: { visitId: ['x', ''] },
});

const visit = {
  id: ID,
  officeId: ID,
  hostId: ID2,
  name: 'Vik Rao',
  company: null,
  email: null,
  phone: null,
  visitDate: '2026-11-16',
  status: 'checked_in',
  checkedInAt: NOW,
  checkedOutAt: null,
  anonymised: false,
  version: 2,
};

checkSchema({
  name: 'Visit',
  schema: Visit,
  valid: visit,
  required: ['id', 'officeId', 'hostId', 'name', 'company', 'email', 'phone', 'visitDate', 'status', 'checkedInAt', 'checkedOutAt', 'anonymised', 'version'],
  bad: { id: ['x'], status: ['arrived'], visitDate: ['x'], checkedInAt: ['x'], anonymised: ['no'], version: [0] },
});

describe('Visit details (E-001/AC-18)', () => {
  it('accepts an anonymised visit with no personal data and keeps date, office and host', () => {
    const r = Visit.safeParse({ ...visit, name: null, anonymised: true });
    expect(r.success).toBe(true);
  });
});

const todayVisit = { ...visit, hostName: 'Ana', hostPhone: '+91 44 1234 5678', hostDesk: 'B-12', notCheckedOut: false };

checkSchema({
  name: 'TodayVisit',
  schema: TodayVisit,
  valid: todayVisit,
  required: ['hostName', 'hostPhone', 'hostDesk', 'notCheckedOut'],
  bad: { hostName: [1], hostPhone: ['p'.repeat(31)], hostDesk: ['d'.repeat(61)], notCheckedOut: ['no'] },
});

const booking = { id: ID, roomName: 'Aspen', ownerName: 'Ana', startsAt: NOW, endsAt: LATER, attendees: 4 };

checkSchema({
  name: 'TodayView',
  schema: TodayView,
  valid: { officeId: ID, officeName: 'Chennai', timeZone: 'Asia/Kolkata', date: '2026-11-16', bookings: [booking], visits: [todayVisit] },
  required: ['officeId', 'officeName', 'timeZone', 'date', 'bookings', 'visits'],
  bad: {
    officeId: ['x'],
    date: ['x'],
    bookings: [[{ ...booking, attendees: 0 }]],
    visits: [[{ ...todayVisit, status: 'arrived' }]],
  },
});

checkSchema({
  name: 'ArrivalNotice',
  schema: ArrivalNotice,
  valid: { visitId: ID, visitorName: 'Vik Rao', arrivedAt: NOW },
  required: ['visitId', 'visitorName', 'arrivedAt'],
  bad: { visitId: ['x'], visitorName: [''], arrivedAt: ['x'] },
});

checkSchema({
  name: 'BadgeView',
  schema: BadgeView,
  valid: { visitorName: 'Vik Rao', hostName: 'Ana', officeName: 'Chennai', date: '2026-11-16' },
  required: ['visitorName', 'hostName', 'officeName', 'date'],
  bad: { visitorName: [''], hostName: [''], officeName: [''], date: ['x'] },
});

describe('BadgeView details (E-001/AC-43)', () => {
  it('refuses any field beyond visitor name, host name, office name and date', () => {
    expect(BadgeView.safeParse({ visitorName: 'Vik', hostName: 'Ana', officeName: 'Chennai', date: '2026-11-16', hostPhone: '+91 123456' }).success).toBe(false);
  });
});

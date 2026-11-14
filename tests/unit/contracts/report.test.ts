import { describe, expect, it } from 'vitest';
import { ReportQuery, WeeklyReport } from '@/contracts/report';
import { ID, checkSchema } from './harness';

checkSchema({
  name: 'ReportQuery',
  schema: ReportQuery,
  valid: { office: ID, week: '2026-11-16' },
  required: [],
  bad: { office: ['x'], week: ['2026-11-17', '2026-11-22', '2026-13-01', 'this week'] },
});

describe('ReportQuery details', () => {
  it('takes a Monday and lets both fields stay blank', () => {
    expect(ReportQuery.safeParse({ week: '2026-11-16' }).success).toBe(true);
    expect(ReportQuery.parse({ office: '', week: '' })).toEqual({});
  });
});

const days = Array.from({ length: 7 }, (_, i) => ({ date: `2026-11-${16 + i}`, checkedIn: i }));

checkSchema({
  name: 'WeeklyReport',
  schema: WeeklyReport,
  valid: {
    officeId: ID,
    officeName: 'Chennai',
    timeZone: 'Asia/Kolkata',
    weekStart: '2026-11-16',
    rooms: [{ roomId: ID, name: 'Aspen', size: 8, bookedMinutes: 120, openMinutes: 3600 }],
    days,
  },
  required: ['officeId', 'officeName', 'timeZone', 'weekStart', 'rooms', 'days'],
  bad: {
    officeId: ['x'],
    weekStart: ['x'],
    rooms: [[{ roomId: ID, name: 'Aspen', size: 8, bookedMinutes: -1, openMinutes: 0 }], [{ roomId: ID, name: 'Aspen', size: 8, bookedMinutes: 1.5, openMinutes: 0 }]],
    days: [days.slice(0, 6), [...days, days[0]], days.map((d) => ({ ...d, checkedIn: -1 }))],
  },
});

describe('WeeklyReport details', () => {
  it('carries raw minutes and counts only: no ratio field', () => {
    const rooms = [{ roomId: ID, name: 'Aspen', size: 8, bookedMinutes: 120, openMinutes: 3600, ratio: 0.03 }];
    expect(WeeklyReport.safeParse({ officeId: ID, officeName: 'Chennai', timeZone: 'Asia/Kolkata', weekStart: '2026-11-16', rooms, days }).success).toBe(false);
  });
});

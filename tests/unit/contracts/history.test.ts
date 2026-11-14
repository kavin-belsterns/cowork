import { describe, expect, it } from 'vitest';
import { AUDIT_ACTIONS, AuditEventView, HistoryPage, HistoryQuery } from '@/contracts/history';
import { ID, NOW, checkSchema } from './harness';

checkSchema({
  name: 'HistoryQuery',
  schema: HistoryQuery,
  valid: { cursor: 'abc_123', limit: '100' },
  required: [],
  bad: { cursor: ['a b', 'x'.repeat(201)], limit: ['101', '0', 'x'] },
});

const event = {
  id: ID,
  at: NOW,
  officeId: ID,
  officeName: 'Chennai',
  timeZone: 'Asia/Kolkata',
  actorName: 'Ana',
  action: 'checked_in',
  itemType: 'visit',
  itemLabel: 'Visitor V-3F2A',
  visitorDetailsRemoved: false,
};

checkSchema({
  name: 'AuditEventView',
  schema: AuditEventView,
  valid: event,
  required: ['id', 'at', 'officeId', 'officeName', 'timeZone', 'actorName', 'action', 'itemType', 'itemLabel', 'visitorDetailsRemoved'],
  bad: {
    id: ['x'],
    at: ['x'],
    officeId: ['x'],
    action: ['deleted', ''],
    itemType: ['badge'],
    itemLabel: ['l'.repeat(201)],
    visitorDetailsRemoved: ['no'],
  },
});

describe('AuditEventView details', () => {
  it('accepts a system actor as null and covers the nine plain verbs', () => {
    expect(AuditEventView.safeParse({ ...event, actorName: null, officeId: null, officeName: null, timeZone: null }).success).toBe(true);
    expect(AUDIT_ACTIONS).toHaveLength(9);
  });

  it('has no visitor name field', () => {
    expect(AuditEventView.safeParse({ ...event, visitorName: 'Vik Rao' }).success).toBe(false);
  });
});

checkSchema({
  name: 'HistoryPage',
  schema: HistoryPage,
  valid: { events: [event], next: 'abc' },
  required: ['events', 'next'],
  bad: { events: [[{ ...event, action: 'deleted' }], Array.from({ length: 101 }, () => event)], next: ['a b'] },
});

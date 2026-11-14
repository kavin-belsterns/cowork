import { describe, expect, it } from 'vitest';
import {
  DeactivateInput,
  HostOption,
  IssuePasswordsInput,
  PasswordResetInput,
  UserCreateInput,
  UserDetail,
  UserListItem,
  UserListQuery,
  UserUpdateInput,
} from '@/contracts/user';
import { ID, ID2, LATER, checkSchema } from './harness';

checkSchema({
  name: 'UserListQuery',
  schema: UserListQuery,
  valid: { office: ID, role: 'employee', status: 'active', cursor: 'abc', limit: '50' },
  required: [],
  bad: { office: ['x'], role: ['admin', 'system'], status: ['gone'], cursor: ['a b'], limit: ['101', '0'] },
});

const create = { name: 'Ana', email: 'ana@example.com', role: 'employee', officeId: ID, phone: '+91 44 1234 5678', desk: 'B-12' };

checkSchema({
  name: 'UserCreateInput',
  schema: UserCreateInput,
  valid: create,
  required: ['name', 'email', 'role'],
  bad: {
    name: ['', 'n'.repeat(121)],
    email: ['', 'nope', `${'a'.repeat(250)}@example.com`],
    role: ['admin', ''],
    officeId: ['x'],
    phone: ['12345', 'call me', '1'.repeat(31), '+' + '1'.repeat(30), '+'],
    desk: ['d'.repeat(61)],
  },
});

describe('UserCreateInput details', () => {
  it('needs an office for every role except platform_admin', () => {
    expect(UserCreateInput.safeParse({ ...create, officeId: '' }).success).toBe(false);
    expect(UserCreateInput.safeParse({ name: 'Pat', email: 'pat@example.com', role: 'platform_admin' }).success).toBe(true);
    expect(UserCreateInput.safeParse({ name: 'Pat', email: 'pat@example.com', role: 'platform_admin', officeId: ID }).success).toBe(false);
  });

  it('lets phone and desk stay blank', () => {
    const r = UserCreateInput.parse({ ...create, phone: '', desk: '' });
    expect(r.phone).toBeUndefined();
    expect(r.desk).toBeUndefined();
  });
});

checkSchema({
  name: 'UserUpdateInput',
  schema: UserUpdateInput,
  valid: { ...create, userId: ID2, version: 3 },
  required: ['userId', 'version', 'name', 'email', 'role'],
  bad: { userId: ['x'], version: [0, ''], name: [''], email: ['nope'], role: ['admin'], officeId: ['x'], phone: ['abc'], desk: ['d'.repeat(61)] },
});

checkSchema({
  name: 'PasswordResetInput',
  schema: PasswordResetInput,
  valid: { userId: ID, version: 1 },
  required: ['userId', 'version'],
  bad: { userId: ['x'], version: [0] },
});

checkSchema({
  name: 'IssuePasswordsInput',
  schema: IssuePasswordsInput,
  valid: { userIds: [ID, ID2], adminPassword: 'my-own-password' },
  required: ['userIds', 'adminPassword'],
  bad: {
    userIds: [[], ['x'], Array.from({ length: 501 }, () => ID)],
    adminPassword: ['', 'p'.repeat(129)],
  },
});

describe('IssuePasswordsInput details', () => {
  it('accepts exactly 500 users', () => {
    expect(IssuePasswordsInput.safeParse({ userIds: Array.from({ length: 500 }, () => ID), adminPassword: 'x' }).success).toBe(true);
  });
});

checkSchema({
  name: 'DeactivateInput',
  schema: DeactivateInput,
  valid: { userId: ID, version: 2, hostReassignments: [{ visitId: ID, newHostId: ID2 }] },
  required: ['userId', 'version'],
  bad: {
    userId: ['x'],
    version: [0],
    hostReassignments: [[{ visitId: 'x', newHostId: ID2 }], [{ visitId: ID }], [{ visitId: ID, newHostId: ID2, extra: 1 }]],
  },
});

const item = { id: ID, name: 'Ana', email: 'ana@example.com', role: 'employee', officeId: ID, officeName: 'Chennai', status: 'active', version: 1 };

checkSchema({
  name: 'UserListItem',
  schema: UserListItem,
  valid: item,
  required: ['id', 'name', 'email', 'role', 'officeId', 'officeName', 'status', 'version'],
  bad: { id: ['x'], email: ['x'], role: ['admin'], status: ['gone'], version: [0] },
});

checkSchema({
  name: 'UserDetail',
  schema: UserDetail,
  valid: { ...item, phone: null, desk: 'B-12', mustChangePassword: true, tempPasswordExpiresAt: LATER },
  required: ['phone', 'desk', 'mustChangePassword', 'tempPasswordExpiresAt'],
  bad: { mustChangePassword: ['yes'], tempPasswordExpiresAt: ['soon'], desk: ['d'.repeat(61)] },
});

describe('user DTOs never carry a password hash', () => {
  it('rejects passwordHash on UserDetail and UserListItem', () => {
    expect(UserDetail.safeParse({ ...item, phone: null, desk: null, mustChangePassword: false, tempPasswordExpiresAt: null, passwordHash: 'x' }).success).toBe(false);
    expect(UserListItem.safeParse({ ...item, passwordHash: 'x' }).success).toBe(false);
  });
});

describe('HostOption', () => {
  checkSchema({
    name: 'HostOption shape',
    schema: HostOption,
    valid: { id: ID, name: 'Ana', desk: 'B-12' },
    required: ['id', 'name', 'desk'],
    bad: { id: ['x'], name: [''], desk: ['d'.repeat(61)] },
  });

  it('returns name and desk only: phone and email are refused', () => {
    expect(HostOption.safeParse({ id: ID, name: 'Ana', desk: null, phone: '+91 123456' }).success).toBe(false);
    expect(HostOption.safeParse({ id: ID, name: 'Ana', desk: null, email: 'a@example.com' }).success).toBe(false);
  });
});

// Purpose: the role menu. One list of items, one order per role, and the S-00 matrix decides what shows.
// Rules: spec S01 section 2 (menu table). A link shows only when the role holds the permission key.
import type { SessionUser } from '@/contracts/auth';
import { can, type GuardedPermission, type Role } from '@/contracts/permissions';

export type MenuItem = { label: string; href: string };

type ItemId = 'offices' | 'users' | 'import' | 'rooms' | 'bookings' | 'visits' | 'reception' | 'officeRooms' | 'history' | 'reports';

type Entry = { label: string; href: (session: SessionUser) => string; key: GuardedPermission; when?: (session: SessionUser) => boolean };

const ENTRIES: Record<ItemId, Entry> = {
  offices: { label: 'Offices', href: () => '/admin/offices', key: 'office.manage' },
  users: { label: 'Users', href: () => '/admin/users', key: 'user.manage' },
  import: { label: 'Import', href: () => '/admin/import', key: 'import.run' },
  rooms: { label: 'Rooms', href: () => '/rooms', key: 'booking.create' },
  bookings: { label: 'My bookings', href: () => '/bookings', key: 'booking.create' },
  visits: { label: 'My visits', href: () => '/visits', key: 'visit.create' },
  reception: { label: 'Reception', href: () => '/reception', key: 'visit.desk' },
  // Rooms of the user's own office. A platform admin has no office and reaches rooms through Offices.
  officeRooms: { label: 'Office rooms', href: (s) => `/admin/offices/${s.officeId ?? ''}`, key: 'room.manage', when: (s) => s.officeId !== null },
  history: { label: 'History', href: () => '/history', key: 'history.view' },
  reports: { label: 'Reports', href: () => '/reports', key: 'report.view' },
};

const ORDER: Record<Role, ItemId[]> = {
  platform_admin: ['offices', 'users', 'import', 'rooms', 'bookings', 'visits', 'reception', 'history', 'reports'],
  office_admin: ['reception', 'rooms', 'bookings', 'visits', 'officeRooms', 'users', 'import', 'history', 'reports'],
  receptionist: ['reception', 'rooms', 'bookings', 'visits', 'history', 'reports'],
  employee: ['rooms', 'bookings', 'visits'],
};

/** Items for this user. While a password change is forced, only the common items remain. */
export function menuItemsFor(session: SessionUser): MenuItem[] {
  if (session.mustChangePassword) return [];
  return ORDER[session.role]
    .map((id) => ENTRIES[id])
    .filter((entry) => can(session, entry.key) && (entry.when?.(session) ?? true))
    .map((entry) => ({ label: entry.label, href: entry.href(session) }));
}

/** The items every role holds. Sign out is a form, so it is not listed here. */
export const COMMON_ITEMS: MenuItem[] = [{ label: 'Change password', href: '/account/password' }];

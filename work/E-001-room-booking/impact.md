# E-001 impact and change tables

One block per intake. Newest at the bottom.

## Impact table: 2026-11-14, first intake from SOW-room-booking.md

| Input item | Touched EARS IDs | Touched stories | Functional effect | NFR effect |
|---|---|---|---|---|
| Shared data model and roles | E-001/AC-01 (new) | E-001/S-00 (new) | Schema, types, permissions, history table and writer | None |
| Sign-in and sessions | E-001/AC-47 to AC-49, AC-71, AC-72, AC-84, AC-85 (new) | E-001/S-01 (new) | Local accounts, lockout, admin reset | 12 h sessions, 12-character passwords |
| Offices and rooms | E-001/AC-30 to AC-32, AC-34, AC-54, AC-81, AC-86 (new) | E-001/S-02 (new) | Offices with time zone and opening hours. Rooms. | None |
| Users and roles | E-001/AC-02 to AC-06, AC-13 to AC-17, AC-19, AC-56, AC-58, AC-59, AC-89 (new) | E-001/S-03 (new) | Tiered creation, office scoping, leavers | 404 or 403 on cross-office access |
| Data load | E-001/AC-60 to AC-64 (new) | E-001/S-04 (new) | Seed script and CSV import | Up to 5,000 rows per file |
| Room availability | E-001/AC-07, AC-33, AC-80 (new) | E-001/S-05 (new) | Free rooms by office, day and size | 2.5 s page |
| Book, change, cancel | E-001/AC-11, AC-12, AC-23 to AC-28, AC-35 to AC-38, AC-55, AC-78, AC-79, AC-82 (new) | E-001/S-06 (new) | Single bookings, capacity check | Zero double bookings under concurrent requests |
| Recurring bookings | E-001/AC-74 to AC-77 (new) | E-001/S-07 (new) | Daily and weekly series | Series up to 90 days ahead |
| Visitor pre-registration | E-001/AC-39, AC-40, AC-87, AC-91 (new) | E-001/S-08 (new) | Register and cancel visits | None |
| Reception desk | E-001/AC-20 to AC-22, AC-41 to AC-46, AC-88 (new) | E-001/S-09 (new) | Today view, check-in and out, walk-ins, badge, banner | None |
| Activity history | E-001/AC-50 to AC-52, AC-57 (new) | E-001/S-10 (new) | Locked history view | Visitors shown by ID only |
| Weekly reports | E-001/AC-08, AC-53, AC-90 (new) | E-001/S-11 (new) | Room use and visitor counts | Built live |
| Visitor data purge | E-001/AC-09, AC-10, AC-18, AC-70, AC-83 (new) | E-001/S-12 (new) | Nightly anonymising job | 90 days; backups kept 7 days |
| Quality checks | E-001/AC-29, AC-65 to AC-69, AC-73 (new) | E-001/S-13 (new); AC-29, AC-66, AC-67 also in every UI story | Load and browser tests | 200 users, 500 ms, WCAG 2.2 AA |

## Change table: 2026-11-14, first intake from SOW-room-booking.md

Current status read from GitHub on 2026-11-14: no project board, no issues.

| Item ID | Current status | Action | Reason | EARS IDs | Downstream stories |
|---|---|---|---|---|---|
| Project board "Room booking" (#1) | (new) | Create | No board exists. Every skill needs one. (recommended) | None | All |
| E-001 (#1) | (new) | Create | New epic from the SOW | All 91 | All |
| E-001/S-00 (#2) | (new) | Create | Required first story | AC-01 | S-01 to S-13 |
| E-001/S-01 (#3) | (new) | Create | SOW 4.8 | See impact table | S-02 |
| E-001/S-02 (#4) | (new) | Create | SOW 4.1 | See impact table | S-03, S-05 |
| E-001/S-03 (#5) | (new) | Create | SOW 4.8, extended | See impact table | S-04, S-06, S-08, S-10 |
| E-001/S-04 (#6) | (new) | Create | Added beyond the SOW | See impact table | S-13 |
| E-001/S-05 (#7) | (new) | Create | SOW 4.2 | See impact table | S-06 |
| E-001/S-06 (#8) | (new) | Create | SOW 4.3 and 6 | See impact table | S-07, S-11 |
| E-001/S-07 (#9) | (new) | Create | Added beyond the SOW | See impact table | S-13 |
| E-001/S-08 (#10) | (new) | Create | SOW 4.4 | See impact table | S-09 |
| E-001/S-09 (#11) | (new) | Create | SOW 4.5 to 4.7 | See impact table | S-11, S-12 |
| E-001/S-10 (#12) | (new) | Create | SOW 4.9 | See impact table | S-13 |
| E-001/S-11 (#13) | (new) | Create | SOW 4.10 | See impact table | S-13 |
| E-001/S-12 (#14) | (new) | Create | SOW 6 | See impact table | S-13 |
| E-001/S-13 (#15) | (new) | Create | SOW 6. Load test lives in the last story. | See impact table | None |

Additions beyond the SOW, for client confirmation: platform admin role and office scoping, CSV import screen, recurring bookings, attendee capacity check, in-app arrival banner.

Open point: monthly uptime target. Owner: client IT team.

Approval: Kavin Pasupathy, 2026-11-14. Comment posted on each item: yes.

## Impact table: 2026-11-15 web role delete grants
Found by the E-001/S-02 lead before T-01: `app_web` has no DELETE on `office_hours` or `booking_series`, but signed specs S-02 and S-07 delete rows there.

| Input item | Touched EARS IDs | Touched stories | Functional effect | NFR effect |
|---|---|---|---|---|
| `app_web` may delete `office_hours` rows | E-001/AC-54 | E-001/S-02 | An admin can close a weekday that was open (no row means closed) | None |
| `app_web` may delete `booking_series` rows | E-001/AC-74, E-001/AC-75, E-001/AC-76, E-001/AC-77 | E-001/S-07 | A series that books 0 dates leaves no series row | None |

## Change table: 2026-11-15 web role delete grants
| Item ID | Current status | Action | Reason | EARS IDs | Downstream stories |
|---|---|---|---|---|---|
| E-001/S-14 (#104) | (new) | Create | Contracts amendment: new migration grants DELETE on `office_hours` and `booking_series` to `app_web`; S-00 grants test updated. Only S-00 or an amendment touches `prisma/` (recommended) | E-001/AC-54, E-001/AC-74 to E-001/AC-77 | E-001/S-02, E-001/S-07 |
| E-001/S-07 (#9) | Backlog | Edit | Add blocked by S-14 | E-001/AC-74 to E-001/AC-77 | None |
| E-001/S-02 (#4) | In progress | None | Edit not allowed while In progress. S-02 stacks on S-14 under an eng-build override ADR | E-001/AC-54 | None |

Approval: Kavin P, 2026-11-15. Comment posted on each item: yes.

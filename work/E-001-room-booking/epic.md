<!-- Mirror header (generated): Summary, actors, NFRs and out of scope mirror GitHub. The EARS table here is the full text; GitHub holds the per-story ID list. -->

# E-001 Room booking and visitor management

## Summary
Staff, reception and admins at every office get one web app for rooms and visitors.
Rooms are booked without clashes, visitors are pre-registered and checked in, and every action is recorded.
Today this runs on email, paper and memory, which caused double bookings, lost visitors and no visit record.

## Actors
- Platform admin: manages every office, room and user.
- Office admin: manages rooms and users of their own office. One or more per office.
- Employee: books rooms at any office and hosts visitors.
- Receptionist: runs the today view, check-in, check-out and badges for their office.
- Nightly job (system): anonymises visitor data after 90 days.

## EARS lines
| ID | Pattern | Text |
|---|---|---|
| E-001/AC-01 | ubiquitous | THE SYSTEM SHALL support four fixed roles: platform admin, office admin, employee and receptionist. |
| E-001/AC-02 | state | WHILE a user is a platform admin THE SYSTEM SHALL allow them to manage every office, room and user. |
| E-001/AC-03 | state | WHILE a user is an office admin THE SYSTEM SHALL limit their management actions to their assigned office. |
| E-001/AC-04 | state | WHILE a user is a receptionist THE SYSTEM SHALL limit their actions to their assigned office. |
| E-001/AC-05 | unwanted | IF an office admin or receptionist requests a record from another office THEN THE SYSTEM SHALL return 404. |
| E-001/AC-06 | unwanted | IF an employee opens the reports or history page THEN THE SYSTEM SHALL return 403. |
| E-001/AC-07 | ubiquitous | THE SYSTEM SHALL let an employee book rooms at any office. |
| E-001/AC-08 | ubiquitous | THE SYSTEM SHALL build each weekly report from live data when the page opens. |
| E-001/AC-09 | event | WHEN the nightly job runs THE SYSTEM SHALL remove the name, email, phone and company from each visitor record 90 days after its visit date. |
| E-001/AC-10 | unwanted | IF the nightly purge fails THEN THE SYSTEM SHALL record the failure in the activity history. |
| E-001/AC-11 | ubiquitous | THE SYSTEM SHALL allow at most one confirmed booking per room for any overlapping time range. |
| E-001/AC-12 | unwanted | IF two users book the same room for overlapping times at the same moment THEN THE SYSTEM SHALL confirm one booking and reject the other with "This room was just booked. Pick another time." |
| E-001/AC-13 | ubiquitous | THE SYSTEM SHALL allow one or more office admins per office. |
| E-001/AC-14 | ubiquitous | THE SYSTEM SHALL let only a platform admin create offices and assign the office admin role. |
| E-001/AC-15 | ubiquitous | THE SYSTEM SHALL let an office admin create employee and receptionist accounts for their own office only. |
| E-001/AC-16 | unwanted | IF an office admin tries to assign the platform admin or office admin role THEN THE SYSTEM SHALL reject the action with 403. |
| E-001/AC-17 | unwanted | IF a user tries to remove the last office admin of an office THEN THE SYSTEM SHALL reject the action with "Each office needs at least one admin." |
| E-001/AC-18 | ubiquitous | THE SYSTEM SHALL keep the visit date, office and host on an anonymised visitor record. |
| E-001/AC-19 | ubiquitous | THE SYSTEM SHALL store a phone number and a desk location on each employee profile. |
| E-001/AC-20 | state | WHILE a visitor is expected or checked in THE SYSTEM SHALL show the host's name, phone number and desk location on the receptionist's today view. |
| E-001/AC-21 | event | WHEN a receptionist checks a visitor in THE SYSTEM SHALL show the host an arrival banner on their next page load. |
| E-001/AC-22 | event | WHEN a receptionist adds a walk-in visitor with a host THE SYSTEM SHALL create the visitor record and check the visitor in. |
| E-001/AC-23 | ubiquitous | THE SYSTEM SHALL accept booking start and end times only in 15-minute steps. |
| E-001/AC-24 | unwanted | IF a booking lasts longer than 1 day THEN THE SYSTEM SHALL reject it with "A booking can last at most 1 day." |
| E-001/AC-25 | unwanted | IF a booking starts more than 90 days ahead THEN THE SYSTEM SHALL reject it with "You can book up to 90 days ahead." |
| E-001/AC-26 | unwanted | IF a booking starts in the past THEN THE SYSTEM SHALL reject it with "You cannot book a time that has passed." |
| E-001/AC-27 | ubiquitous | THE SYSTEM SHALL let the booking owner, the platform admin, and the office admins and receptionists of that office change or cancel a booking. |
| E-001/AC-28 | unwanted | IF any other user tries to change or cancel a booking THEN THE SYSTEM SHALL reject the action with 403. |
| E-001/AC-29 | ubiquitous | THE SYSTEM SHALL show every page without sideways scrolling on screens 375 px wide and wider. |
| E-001/AC-30 | event | WHEN an admin saves a room with a name, size and floor THE SYSTEM SHALL add it to the office. |
| E-001/AC-31 | unwanted | IF a room name already exists in the same office THEN THE SYSTEM SHALL reject it with "A room with this name already exists in this office." |
| E-001/AC-32 | unwanted | IF an admin removes a room that has future bookings THEN THE SYSTEM SHALL refuse and list those bookings. |
| E-001/AC-33 | event | WHEN a user picks an office and a day THE SYSTEM SHALL list every room with its free and booked times. |
| E-001/AC-34 | ubiquitous | THE SYSTEM SHALL show all times in the office's own time zone. |
| E-001/AC-35 | event | WHEN a user submits a valid booking THE SYSTEM SHALL save it and show a confirmation. |
| E-001/AC-36 | ubiquitous | THE SYSTEM SHALL allow back-to-back bookings, such as 10:00 to 11:00 and 11:00 to 12:00. |
| E-001/AC-37 | unwanted | IF a change moves a booking onto a taken time THEN THE SYSTEM SHALL reject the change and keep the original booking. |
| E-001/AC-38 | event | WHEN a booking is cancelled THE SYSTEM SHALL free the time for others at once. |
| E-001/AC-39 | event | WHEN an employee pre-registers a visitor THE SYSTEM SHALL show the visitor on that office's today view on the visit date. |
| E-001/AC-40 | unwanted | IF a pre-registration is missing the name, visit date or office THEN THE SYSTEM SHALL show an error on that field and save nothing. |
| E-001/AC-41 | event | WHEN a receptionist checks a visitor in THE SYSTEM SHALL record the time and the receptionist. |
| E-001/AC-42 | unwanted | IF a receptionist checks in a visitor who is already checked in THEN THE SYSTEM SHALL reject it with "Already checked in at HH:MM." |
| E-001/AC-43 | event | WHEN a visitor is checked in THE SYSTEM SHALL offer a printable badge with the visitor name, host name, office and date. |
| E-001/AC-44 | event | WHEN a receptionist checks a visitor out THE SYSTEM SHALL record the time. |
| E-001/AC-45 | state | WHILE a visitor from an earlier day is still checked in THE SYSTEM SHALL show them as "Not checked out" on the today view. |
| E-001/AC-46 | state | WHILE a receptionist is on the today view THE SYSTEM SHALL show today's bookings and visitors for their office. |
| E-001/AC-47 | event | WHEN a user signs in with a correct email and password THE SYSTEM SHALL open the home page for their role. |
| E-001/AC-48 | unwanted | IF sign-in fails 5 times in 15 minutes THEN THE SYSTEM SHALL lock the account for 15 minutes. |
| E-001/AC-49 | event | WHEN an admin resets a user's password THE SYSTEM SHALL make the user set a new one at the next sign-in. |
| E-001/AC-50 | event | WHEN a user creates, changes or cancels any record THE SYSTEM SHALL write the actor, action, item and time to the activity history. |
| E-001/AC-51 | ubiquitous | THE SYSTEM SHALL block any edit or deletion of an activity history entry. |
| E-001/AC-52 | ubiquitous | THE SYSTEM SHALL refer to visitors in the activity history by record ID, not by name. |
| E-001/AC-53 | ubiquitous | THE SYSTEM SHALL calculate room use as booked hours divided by the office's open hours for the week. |
| E-001/AC-54 | ubiquitous | THE SYSTEM SHALL store a time zone and opening hours for each office. |
| E-001/AC-55 | unwanted | IF a booking falls outside the office's opening hours THEN THE SYSTEM SHALL reject it with "This office is open HH:MM to HH:MM." |
| E-001/AC-56 | event | WHEN an admin removes a user THE SYSTEM SHALL deactivate the account and keep the user's history. |
| E-001/AC-57 | ubiquitous | THE SYSTEM SHALL keep a cancelled booking with the status "cancelled" for reports and history. |
| E-001/AC-58 | event | WHEN an admin deactivates a user THE SYSTEM SHALL cancel that user's future bookings. |
| E-001/AC-59 | unwanted | IF a user being deactivated hosts future visitors THEN THE SYSTEM SHALL make the admin pick a new host for each one before deactivation completes. |
| E-001/AC-60 | ubiquitous | THE SYSTEM SHALL provide a one-time seed script that loads offices, rooms and users from a spreadsheet file. |
| E-001/AC-61 | event | WHEN an admin uploads a valid CSV file of rooms or users THE SYSTEM SHALL add every row. |
| E-001/AC-62 | unwanted | IF any row in an uploaded CSV file is invalid THEN THE SYSTEM SHALL import nothing and list each bad row with its reason. |
| E-001/AC-63 | ubiquitous | THE SYSTEM SHALL apply the same role and office limits to CSV rows as to single entries. |
| E-001/AC-64 | unwanted | IF a CSV file has more than 5,000 rows THEN THE SYSTEM SHALL reject it with "Upload at most 5,000 rows at a time." |
| E-001/AC-65 | ubiquitous | THE SYSTEM SHALL support 20 offices, 300 rooms, 3,000 users and 500 visitors a day. |
| E-001/AC-66 | ubiquitous | THE SYSTEM SHALL meet WCAG 2.2 AA on every page. |
| E-001/AC-67 | ubiquitous | THE SYSTEM SHALL show the main content of each page within 2.5 s on office wifi. |
| E-001/AC-68 | ubiquitous | THE SYSTEM SHALL answer 95% of server requests within 500 ms. |
| E-001/AC-69 | ubiquitous | THE SYSTEM SHALL serve 200 concurrent users with an error rate under 1%. |
| E-001/AC-70 | ubiquitous | THE SYSTEM SHALL keep daily database backups for 7 days only. |
| E-001/AC-71 | ubiquitous | THE SYSTEM SHALL end a sign-in session 12 hours after it starts. |
| E-001/AC-72 | unwanted | IF a new password is shorter than 12 characters THEN THE SYSTEM SHALL reject it with "Use at least 12 characters." |
| E-001/AC-73 | ubiquitous | THE SYSTEM SHALL support the latest two versions of Chrome, Edge, Safari and Firefox. |
| E-001/AC-74 | event | WHEN a user books with a daily or weekly repeat THE SYSTEM SHALL create one booking for each date in the series. |
| E-001/AC-75 | unwanted | IF a repeat series ends more than 90 days ahead THEN THE SYSTEM SHALL reject it with "A series can run up to 90 days ahead." |
| E-001/AC-76 | unwanted | IF some dates in a series clash with existing bookings THEN THE SYSTEM SHALL book the free dates and list the clashing ones. |
| E-001/AC-77 | event | WHEN a user cancels a booking in a series THE SYSTEM SHALL offer to cancel that date only or all future dates. |
| E-001/AC-78 | ubiquitous | THE SYSTEM SHALL ask for the attendee count on every booking. |
| E-001/AC-79 | unwanted | IF the attendee count is more than the room size THEN THE SYSTEM SHALL reject the booking with "This room holds N people." |
| E-001/AC-80 | event | WHEN a user enters an attendee count THE SYSTEM SHALL list only rooms that fit. |
| E-001/AC-81 | unwanted | IF an admin reduces a room size below a future booking's attendee count THEN THE SYSTEM SHALL list those bookings and ask the admin to confirm. |
| E-001/AC-82 | ubiquitous | THE SYSTEM SHALL let admins and receptionists book rooms as well as employees. |
| E-001/AC-83 | unwanted | IF the nightly purge fails THEN THE SYSTEM SHALL retry it on the next nightly run. |
| E-001/AC-84 | unwanted | IF a deactivated user tries to sign in THEN THE SYSTEM SHALL reject the sign-in with "This account is not active." |
| E-001/AC-85 | unwanted | IF the email or password is wrong THEN THE SYSTEM SHALL reject the sign-in with "Email or password is wrong." |
| E-001/AC-86 | unwanted | IF a room is missing its name or floor, or its size is below 1, THEN THE SYSTEM SHALL show an error on that field and save nothing. |
| E-001/AC-87 | unwanted | IF a visit date is in the past THEN THE SYSTEM SHALL reject it with "Pick today or a later date." |
| E-001/AC-88 | unwanted | IF a receptionist checks out a visitor who is not checked in THEN THE SYSTEM SHALL reject it with "This visitor is not checked in." |
| E-001/AC-89 | unwanted | IF an email already belongs to another user THEN THE SYSTEM SHALL reject it with "This email is already in use." |
| E-001/AC-90 | ubiquitous | THE SYSTEM SHALL show the number of visitors per office per day in the weekly report. |
| E-001/AC-91 | event | WHEN the host cancels an expected visit THE SYSTEM SHALL remove it from the today view. |

## NFRs
| Area | Target |
|---|---|
| Correctness | Zero double bookings, including concurrent requests (AC-11, AC-12) |
| Speed | Main content within 2.5 s on office wifi; 95% of server requests within 500 ms (AC-67, AC-68) |
| Load | 200 concurrent users, error rate under 1%; sized for 20 offices, 300 rooms, 3,000 users, 500 visitors a day (AC-65, AC-69) |
| Accessibility | WCAG 2.2 AA on every page; works from 375 px wide (AC-29, AC-66) |
| Privacy | Visitor personal data anonymised 90 days after the visit; backups kept 7 days (AC-09, AC-70) |
| Security | Role and office checked on every action; 12 h sessions; 12-character passwords; lockout after 5 failures (AC-03 to AC-06, AC-48, AC-71, AC-72) |
| Browsers | Latest two versions of Chrome, Edge, Safari and Firefox (AC-73) |
| Availability | [NEEDS CLARIFICATION: monthly uptime target. Owner: client IT team, who host the app.] |

## Out of scope
- Payments
- Calendar links
- Single sign-on
- Mobile apps
- Badge printers or kiosks
- Text or email alerts
- Custom roles (later phase)
- Monthly repeat bookings
- Links to other systems (HR, access control)

## Links
- Design: `work/E-001-room-booking/design.md`
- Specs: `work/E-001-room-booking/specs/S00-contracts.md`
- Impact and change tables: `work/E-001-room-booking/impact.md`

## Stories
| ID | GitHub | Title |
|---|---|---|
| E-001/S-00 | #2 | Contracts |
| E-001/S-01 | #3 | Sign-in and sessions |
| E-001/S-02 | #4 | Offices and rooms |
| E-001/S-03 | #5 | Users and roles |
| E-001/S-04 | #6 | Data load |
| E-001/S-05 | #7 | Room availability |
| E-001/S-06 | #8 | Book, change and cancel |
| E-001/S-07 | #9 | Recurring bookings |
| E-001/S-08 | #10 | Visitor pre-registration |
| E-001/S-09 | #11 | Reception desk |
| E-001/S-10 | #12 | Activity history |
| E-001/S-11 | #13 | Weekly reports |
| E-001/S-12 | #14 | Visitor data purge |
| E-001/S-13 | #15 | Quality checks |
| E-001/S-14 | #104 | Contracts amendment: web role delete grants |

## Status note
Change table approved on 2026-11-14. Next: eng-design. Status lives on the Room booking board.

<!-- bls:id=E-001;sha=618b0c511070 -->

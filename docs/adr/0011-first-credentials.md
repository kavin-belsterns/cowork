---
id: 0011
type: decision
work_item: E-001
date: 2026-11-14
status: accepted
---

# 0011 How users get their first password

## Context
Email is out of scope (SOW 5), so no reset link can be sent. Up to 3,000 users arrive by seed script or CSV import (AC-60, AC-61). Admin reset already shows a temporary password (AC-49).

## Options
| Option | Complexity | Cost to run | Scale | Team knows it |
|---|---|---|---|---|
| A. Default password in code or config | Low | None | Fine | Yes. Rejected: shared secret (OWASP A02) |
| B. Account starts with no password. Admin issues a temporary password per user, shown once | Low | Admin time per user | Slow for 3,000 users | Yes |
| C. As B, plus "Issue first passwords" for selected users: a one-time CSV download, never stored, each password expires after 7 days | Medium | Hashing 3,000 passwords, done outside any transaction, not measured | Fine | Yes |

## Decision
Option C. Bulk issue covers only users with no password yet, needs the admin to re-enter their own password, sends `no-store`, and writes one audit event per user. Temporary passwords are 16 alphanumeric CSPRNG characters. Users must set a new one at first sign-in (AC-49). The first platform admin comes from `scripts/break-glass.ts` on the host. Proposed by the chair, signed with the design.

## Consequences
- Easier: go-live with 3,000 users in one admin action per office.
- Harder: the download file holds live secrets for up to 7 days. The admin must hand them out and delete the file.
- Revisit when: email or single sign-on enters scope.

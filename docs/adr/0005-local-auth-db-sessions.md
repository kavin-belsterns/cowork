---
id: 0005
type: decision
work_item: E-001
date: 2026-11-14
status: accepted
---

# 0005 Local accounts with database sessions

## Context
Single sign-on is out of scope (SOW 5). Staff sign in with email and password. Sessions last 12 h (AC-71). A deactivated user must lose access at once (AC-84).

## Options
| Option | Complexity | Cost to run | Scale | Team knows it |
|---|---|---|---|---|
| A. Auth.js credentials provider, JWT sessions | Medium: credentials flow is a side path in the library | None | Fine | Yes |
| B. Own session table, random token cookie, Argon2id hashing (`@node-rs/argon2`) | Low: about 150 lines in `src/lib/auth.ts` | One DB read per request, not measured | Fine to 3,000 users | Yes |
| C. Another auth library with its own schema | Medium: second schema owner beside Prisma | None | Fine | No |

## Decision
Option B. A JWT cannot be revoked before expiry, so A breaks AC-84 without extra work. Proposed by the chair, signed with the design.

## Consequences
- Easier: instant revoke on deactivation. Full control of lockout (AC-48).
- Harder: we own the session code and its tests. `@node-rs/argon2` is not in `standards/versions.md`; pin it by the 90-day rule.
- Revisit when: the client asks for single sign-on.

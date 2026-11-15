---
id: 0018
type: decision
work_item: E-001/S-15
date: 2026-11-15
status: accepted
---

# 0018 AC-48 lockout is a fixed 15-minute lock

## Context
E-001/AC-48 says 5 failures in 15 minutes "lock the account for 15 minutes". S-01 (PR #103) shipped a sliding window: the account is locked while 5 or more failures for the email hash fall in the last 15 minutes. So the lock can lift sooner than 15 minutes, and "Try again in 15 minutes." can overstate the wait. Review of PR #103 raised this as an open item.

## Options
| Option | Behaviour | Change needed |
|---|---|---|
| A. Fixed lock | Locked for 15 minutes from the failure that made 5 in 15 minutes. Attempts during the lock do not extend it | Lock end from the existing `sign_in_attempts` rows, new rule and tests (E-001/S-15) |
| B. Sliding window | Locked while 5 or more failures fall in the last 15 minutes | None: shipped in S-01 |

## Decision
Option A, the fixed lock. It matches AC-48 as written, makes "Too many attempts. Try again in 15 minutes." true, and gives a predictable wait. Chosen by the lead on 2026-11-15 under delegation from Kavin P ("decision is yours"). E-001/S-15 (#111) brings the S-01 code in line. No schema or grant change.

## Consequences
- Easier: the copy, `Retry-After` and the EARS line agree.
- Harder: the rule needs failure times, not only a count. S-15 adds that read.
- Revisit when: a user or a security review asks for a different lockout model.

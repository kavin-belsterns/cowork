---
id: 0018
type: decision
work_item: E-001/S-01
date: 2026-11-15
status: accepted
---

# 0018 AC-48 lockout is a sliding window

## Context
E-001/AC-48 says 5 failures in 15 minutes "lock the account for 15 minutes". Spec S-01 sections 4 and 6 count failures by email hash in the last 15 minutes. The S-01 build follows the spec. Review of PR #103 raised the gap as an open item.

## Options
| Option | Behaviour | Change needed |
|---|---|---|
| A. Fixed lock | Locked for 15 minutes from the 5th failure | Failure timestamps in the data layer, new rule and tests |
| B. Sliding window | Locked while 5 or more failures for the email hash fall in the last 15 minutes | None: built in S-01 |

## Decision
Option B. The account stays locked while 5 or more failures for that email hash fall within the last 15 minutes. `Retry-After: 900` and "Try again in 15 minutes." give the longest wait. Decided by Kavin P on 2026-11-15.

## Consequences
- Easier: no change to the merged S-01 code.
- Harder: the lock can lift before 15 minutes pass, as old failures age out.
- Revisit when: a user or a security review asks for a fixed lock.

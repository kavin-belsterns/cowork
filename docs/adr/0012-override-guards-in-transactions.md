---
id: 0012
type: override
work_item: E-001
date: 2026-11-14
status: accepted
rule: standards/rules-home.md#RC2
---

# 0012 Count-and-decide guards inside transactions

## Context
Five invariants span rows: no future booking on a removed room (AC-32), at least one admin per office (AC-17), at least one active platform admin, no future booking during an office time zone change (ADR-0009), and no work left on a deactivated user (AC-58, AC-59). Under Read Committed, a check made before the transaction can be stale at commit.

## Decision
Inside the transaction, the code locks the parent row (room or office), or takes a fixed advisory lock for the platform admin guard, runs a count query, and refuses on the count. Only that count comparison runs inside. All other rule calls stay outside, as RC2 requires. Proposed by the chair, signed with the design.

## Consequences
- Easier: the invariants hold under concurrent requests.
- Harder: short row locks on room and office rows.
- Revisit when: a single-statement guard is proven safe under concurrency by test.

## Override block (type: override only)
- Rule skipped: standards/rules-home.md#RC2
- Reason: a guard computed outside the transaction cannot protect a cross-row invariant.
- Who: Kavin Pasupathy (as signer)
- Expires: E-001 release, or when a single-statement guard replaces it

---
id: 0004
type: recommendation-rejected
work_item: E-001
date: 2026-11-14
status: accepted
---

# 0004 CSV import screen in addition to the seed script

## Context
Go-live needs offices, rooms and up to 3,000 users loaded. SOW 4 has no bulk load.

## Decision
Three load paths: one-time seed script, manual entry, and a CSV import screen for admins (E-001/S-04, AC-60 to AC-64). Decided by Kavin Pasupathy in the eng-intake interview.

## Consequences
- Easier: Admins can bulk load new offices after go-live without engineering help.
- Harder: A file upload path to secure and test. All-or-nothing validation up to 5,000 rows.
- Revisit when: The client rejects the addition at design sign-off.

## Recommendation-rejected block (type: recommendation-rejected only)
- Recommendation: Seed script only. No extra screen to build or secure.
- Engineer reason: Not stated in the interview. Engineer choice.
- Who: Kavin Pasupathy

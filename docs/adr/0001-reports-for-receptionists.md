---
id: 0001
type: recommendation-rejected
work_item: E-001
date: 2026-11-14
status: accepted
---

# 0001 Receptionists see reports and history

## Context
SOW 4.9 and 4.10 ask for a history and weekly reports. The SOW does not say who sees them.

## Decision
Office admins and receptionists see reports and history for their own office. The platform admin sees all. Employees see none (E-001/AC-04, AC-06). Decided by Kavin Pasupathy in the eng-intake interview.

## Consequences
- Easier: Reception can answer who visited without asking an admin.
- Harder: More roles can read visitor data. Office scoping must hold on every report query.
- Revisit when: A privacy review or the client asks to narrow access.

## Recommendation-rejected block (type: recommendation-rejected only)
- Recommendation: Admins only see reports and history. Smallest exposure of visitor data.
- Engineer reason: Not stated in the interview. Engineer choice.
- Who: Kavin Pasupathy

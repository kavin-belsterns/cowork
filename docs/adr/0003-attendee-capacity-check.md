---
id: 0003
type: recommendation-rejected
work_item: E-001
date: 2026-11-14
status: accepted
---

# 0003 Bookings check attendee count against room size

## Context
SOW 4.1 gives each room a size. The SOW does not say a booking must respect it.

## Decision
Every booking asks for the attendee count and is rejected when it exceeds the room size (E-001/AC-78 to AC-81). Decided by Kavin Pasupathy in the eng-intake interview.

## Consequences
- Easier: Rooms are not overbooked. The free-rooms list can filter by size.
- Harder: One more field on every booking. Room size changes need a check on future bookings.
- Revisit when: Staff report the count field as friction.

## Recommendation-rejected block (type: recommendation-rejected only)
- Recommendation: Show room size as information only. Ask no attendee count.
- Engineer reason: Not stated in the interview. Engineer choice.
- Who: Kavin Pasupathy

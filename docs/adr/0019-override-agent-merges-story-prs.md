---
id: 0019
type: override
work_item: E-001
date: 2026-11-15
status: accepted
rule: eng-build#step-5
---

# 0019 An agent merges a story PR when every gate passes

## Context
eng-build step 5 stops for the human to approve and merge each story PR. With 11 stories left and up to 3 building at once, each wait for a merge holds back every story that depends on it. Each PR already passes these gates: a read-only reviewer on every task (max 2 rounds), a story review, story checks that mirror CI, and GitHub CI.

## Options
| Option | Complexity | Cost to run | Scale | Team knows it |
|---|---|---|---|---|
| A. Human approves and merges every PR | Low | A human wait per story | Slows every wave | Yes |
| B. Agent merges when all gates pass; anything else waits for the human | Low | None | Fine | Yes |

## Decision
Option B. Kavin P asked for it on 2026-11-15: "if pr create you can merge using another agent if ci pass".

The story session merges its own PR with `gh pr merge --merge` only when all of these hold:
1. GitHub CI is green on the PR head (`gh pr checks <n>` shows every check passing).
2. The story review returned Approve, and no Critical or Major item is open in the PR body's "Open review items".
3. The PR is mergeable with no conflicts, and the branch was rebased onto main after its last dependency merged.
4. Every contract amendment the story needs is already merged.

If any gate fails, the PR waits for Kavin P, and the session says why in the PR body.

## Consequences
- Easier: waves move as soon as their dependencies merge.
- Harder: no human reads each diff before merge. The human can still review merged PRs and raise follow-up items.
- Revisit when: a merged story needs a revert, or before E-001 release (eng-release still has its human go).

## Override block (type: override only)
- Rule skipped: eng-build#step-5 (human approves and merges the story PR)
- Reason: the user asked for agent merges gated on CI, to remove merge waits between parallel waves.
- Who: Kavin P
- Expires: E-001 release, or when Kavin P withdraws it

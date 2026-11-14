---
id: 0017
type: override
work_item: E-001/S-01
date: 2026-11-14
status: accepted
rule: eng-build#step-5
---

# 0017 Stack S-01 on the unapproved S-00 branch

## Context
eng-build step 5 says not to start a story whose dependency PR is unapproved. S-01 depends on S-00. The S-00 pull request (PR #100, branch `feat/E001-S00-contracts`) is open and not yet approved.

## Decision
Build S-01 on a branch cut from `feat/E001-S00-contracts`. The S-01 PR targets that branch until PR #100 merges. Kavin P decided this on 2026-11-14 to save time.

## Consequences
- Easier: S-01 work starts now, not after S-00 approval.
- Harder: every S-00 change means a rebase and a re-run of the affected done commands. A contract change in S-00 review can force S-01 rework.
- Revisit when: PR #100 merges or S-00 review changes a contract S-01 imports.

## Owned-files gap in parallel sessions
- S-01 runs in its own worktree session. The `check-owned-files.sh` hook reads `work/.active-task` from the main checkout, not from the worktree.
- So the hook cannot enforce S-01 owns at write time. It blocks every write while S-00 holds a card, and checks nothing otherwise.
- S-01 owns are enforced at commit time instead. Before each task commit the lead runs `lib-taskcard.py owns` against the worktree for every staged path. The output goes in the task evidence file under "## Owns check".
- The reviewer's check 2 runs on every task as the second backstop.
- The S-00 session messages S-01 before it activates any card in the main checkout. S-01 pauses writes until it is cleared.

## Override block (type: override only)
- Rule skipped: eng-build#step-5
- Reason: the user accepts rebase risk to save time.
- Who: Kavin P
- Expires: when PR #100 merges. Then retarget the S-01 PR to `main`.

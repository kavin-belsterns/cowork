---
id: 0014
type: override
work_item: E-001/S-00
date: 2026-11-14
status: proposed
rule: standards/versions.md#RC2
---

# 0014 Pin TypeScript 6 instead of the newest major

## Context
`standards/versions.md` asks for the newest major at least 90 days old. For TypeScript that is 7.0.2. `eslint-config-next` 16.4.6 pulls in `typescript-eslint` 8.72.2, which throws "does not support TS 7.0". On TypeScript 7, `pnpm lint` cannot run, so every task's done list fails.

## Options
| Option | Complexity | Cost to run | Scale | Team knows it |
|---|---|---|---|---|
| A. TypeScript 7.0.2, drop `eslint-config-next` | High: rebuild the Next.js lint rules by hand | None | Fine | Partly |
| B. TypeScript 7.0.2, skip `pnpm lint` | Low | Loses the machine-enforced lint rules (no-console, raw SQL ban, jsx-a11y) | Fine | Yes |
| C. TypeScript 6.0.3, the newest major `typescript-eslint` supports | Low | None | Fine | Yes |

## Decision
Option C. Proposed by the lead in E-001/S-00/T-01. The engineer confirms at the S-00 pull request.

## Consequences
- Easier: lint and its house rules keep running in every task and in CI.
- Harder: one major behind on TypeScript.
- Revisit when: `eslint-config-next` ships a `typescript-eslint` release that supports TypeScript 7. Check in the January 2027 quarterly window.

## Override block (type: override only)
- Rule skipped: standards/versions.md#RC2
- Reason: the lint toolchain from `eslint-config-next` 16.4.6 does not support TypeScript 7.
- Who: engineer to confirm at the S-00 pull request
- Expires: when `typescript-eslint` supports TypeScript 7, or the January 2027 window

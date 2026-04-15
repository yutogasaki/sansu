---
name: sansu-verify
description: Run and interpret Sansu's required verification flow after substantive code, UI, docs, or release-sensitive changes. Use for verify, test, lint, typecheck, build, or release checks.
---

# Sansu Verify

## Read First

1. `docs/ai/verification_matrix.md`
2. `docs/wiki/memory.md`
3. `git diff --stat`

## Flow

1. Classify the change type using `docs/ai/verification_matrix.md`
2. Run the required checks for that change type
3. Report failures from the first meaningful error, not downstream noise
4. If a required check cannot run, record the gap clearly

## Common Commands

- `npm run docs:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `npm run build`
- `npm run e2e:smoke`
- `npm run verify:core`
- `npm run verify:release`

## Output Format

## Verify Report

### Summary
- Result: PASS / FAIL / PARTIAL
- Change type:

### Commands
- command: result

### Findings
- Most important failure or risk first

### Next Actions
- Smallest useful next step

## Rules

- Fix one meaningful problem at a time
- Prefer `typecheck/lint -> build -> test -> e2e`
- If docs or process changed, include `npm run docs:check`

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

## Iteration and integration

- During implementation, reproduce a failure with the smallest check that covers its cause. Use saved timestamps, source data and a focused regression before repeating an expensive browser journey; do not make an unrelated feature wait for that diagnosis.
- Assign independent implementation owners and share one typecheck for the integrated changes. Run the full required matrix on a stable integration candidate after the focused checks pass. Repeat a broad check when its inputs changed or an unresolved result requires it, and retain the earlier result with its exact source.
- Keep focused checks and explicit diagnostic fixtures separate from end-to-end evidence. A short reproduction can guide a fix; it does not prove real acquisition, offline recovery, learning throughput, visual appeal or child motivation. Final acceptance still follows the verification matrix.
- For normal production-preview journeys, allow service workers; explicitly blocking them is a separate fault diagnostic and can itself produce registration errors. For a static/on-demand WebGL view, capture the visible canvas with a browser screenshot after a real rendered frame; a later `toDataURL()` may read an already-cleared drawing buffer. Before touch navigation beside a sticky canvas, scroll the whole control into the unobscured area and verify the actual hit target. Keep the first failed trace when correcting these harness assumptions.

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
- References to gitignored local evidence (such as `output/` and generated logs) keep their label and path as plain text/inline code; use Markdown links for tracked, durable artifacts. Before pushing evidence-doc changes, also run `node tools/check-docs.mjs` in a temporary copy outside the watched repository containing only `git ls-files` paths copied from current working contents, without the ignored output tree. A local-only link can otherwise pass here and fail in CI.

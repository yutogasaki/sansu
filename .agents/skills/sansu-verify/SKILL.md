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
- Before rerunning a long journey, classify the first failure as application behavior, harness assumptions, or environment. Capture the underlying exception and actual screen/route/save state. A failed locator after a successful save is not evidence of a failed save; reload may correctly retain a detail route. Prefer role/name or test-ID locators; never concatenate an unescaped JSON-shaped record ID into CSS. Keep application and corrected-harness versions distinct.

## Verify the intended commit

- In a shared dirty checkout, distinguish current working contents from the staged commit. Inspect ownership and `git diff --cached --name-only`; stage only authorized paths, including the exact required durable evidence files. Do not stage another task's work to make a check pass.
- Before pushing evidence-doc changes, export the reviewed index into a fresh directory outside the watched repository and run its docs checker there. This catches ignored local artifacts and excludes unrelated unstaged edits. A working-copy PASS or FAIL must not be relabeled as the commit result. Confirm the index stayed unchanged during the check; repeat if it changed.

```bash
# Run from the repository root, after reviewing the staged paths.
sansu_docs_check_dir="$(mktemp -d "${TMPDIR:-/tmp}/sansu-docs-index.XXXXXX")"
git checkout-index --all --ignore-skip-worktree-bits --prefix="$sansu_docs_check_dir/"
(cd "$sansu_docs_check_dir" && node tools/check-docs.mjs)
```

For an isolated application build, likewise verify that the reviewed commit's build inputs match the tested candidate before reporting its results. Documentation-only edits do not require rebuilding unchanged application inputs.

References: [Git index export](https://git-scm.com/docs/git-checkout-index#_examples), [Playwright locators](https://playwright.dev/docs/locators).

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
- References to gitignored local evidence (such as `output/` and generated logs) keep their label and path as plain text/inline code; use Markdown links for tracked, durable artifacts. Verify those links in the intended commit as described above.

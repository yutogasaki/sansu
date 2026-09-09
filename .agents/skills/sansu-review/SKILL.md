---
name: sansu-review
description: Review diffs in Sansu for regressions, over-change, child-tone issues, design drift, and spec mismatches. Use for review requests, pre-PR sanity checks, or risky diffs.
---

# Sansu Review

## Read First

1. `git status`
2. `git diff --stat`
3. Relevant source docs from `docs/`

## Review Priorities

1. Breaking behavior or data risk
2. Spec mismatch
3. Learning-logic regressions
4. Child/parent UX tone issues
5. Over-change, unnecessary abstraction, or noisy refactors

## Sansu-Specific Checks

- Does the diff add competitive, harsh, or loud UX?
- Does it change learning thresholds, SRS behavior, or block prioritization?
- Does it create page-local styling that should be shared?
- Does it skip docs or verification updates implied by the change?
- Does an initial-view adjustment invoke a user camera action that sets manual mode or cancels automatic presentation? Review those state effects, the overview/reset behavior, and the return from dedicated views; changing the default framing and simulating a user zoom are not interchangeable.
- When terrain expands, do placement, walking and camera bounds use the same new floor, and do generated ornaments stay clear of usable surfaces? Preserve saved object coordinates and test valid placement against the contract rather than requiring the old search direction.

## Output Format

## Diff Review Report

### Summary
- Safety: OK / Attention / Risk
- Spec alignment: OK / Needs review / NG
- Tone: OK / Needs review / NG
- Over-change: None / Present

### Findings
1. Finding
   - Evidence:
   - Impact:
   - Suggested minimal fix:

### Verification Plan
- What to run after fixes

## Rules

- Findings come first
- Prefer minimal fixes over broad rewrites
- Do not call something safe only because tests pass

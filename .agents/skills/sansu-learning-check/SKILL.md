---
name: sansu-learning-check
description: Validate Sansu learning logic, progression, SRS behavior, session assembly, and test triggers after logic changes. Use when editing learning domain code or reviewing those diffs.
---

# Sansu Learning Check

## Read First

1. `docs/product/01_app_spec.md`
2. `docs/product/02_math_skills.md`
3. `docs/product/04_math_problems.md`
4. Relevant diff

## Focus Areas

- SRS interval and strength behavior
- Progression functions and difficulty monotonicity
- Problem generators and visual scaffolding transitions
- Session and block composition
- Test trigger thresholds and cooldown behavior

## Recommended Checks

- `npx vitest run src/domain/algorithms/srs.test.ts`
- `npx vitest run src/domain/math/`
- `npx vitest run src/hooks/blockGenerators.test.ts`
- `npx vitest run src/hooks/useStudySession.logic.test.ts`
- `npx vitest run src/domain/test/trigger.test.ts`

## Output Format

## Learning Logic Report

### Summary
- Tests: PASS / FAIL / PARTIAL
- Logic alignment: OK / Needs review

### Findings
1. Finding
   - Impact:
   - Spec alignment:
   - Risk:

### Recommendations
- Missing tests
- Required spec confirmation

## Rules

- Do not assume safety just because tests pass
- Call out user experience impact when thresholds or pacing change
- Prefer targeted tests when only one logic area changed

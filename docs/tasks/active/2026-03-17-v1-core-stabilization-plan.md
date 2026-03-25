# Task: V1 Core Stabilization Plan

- Date: 2026-03-17
- Owner: yutogasaki / codex
- Status: Active
- Review By: 2026-04-07
- Related ADR / Runbooks:
  - `docs/runbooks/backlog-triage.md`
  - `docs/verification_matrix.md`
  - `docs/runbooks/release-checklist.md`
  - `docs/runbooks/schema-migration.md`

## Goal

- Convert the current backlog into an execution-ready plan that stabilizes the core v1 experience before future feature expansion.

## In Scope

- P0 core UI consistency for `Study` / `Battle` / `Stats` / `Settings` / `Onboarding`
- State UI consistency for `Modal` / `Badge` / `ProgressBar` / `Spinner`
- P1 regression coverage for the core user flow
- P2 specification and operations documentation for learning rules and persistence policy
- Only the minimum P3 foundation work needed to unblock P0 or P1

## Out of Scope

- Implementing TTS, example sentences, unit conversion, time calculation, or cloud sync
- Large-scale redesign outside the existing design language
- Broad backlog reshaping unless priority changes materially

## SSOT References

- `docs/01_app_spec.md`
- `docs/07_ui_design_guideline.md`
- `docs/10_design_refresh_status.md`
- `docs/11_full_task_backlog.md`
- `docs/12_ui_fix_tasklist.md`
- `docs/risk_register.md`

## Docs To Touch

- Must update:
  - This task file while the work is active
  - The owning SSOT or status doc when each implementation slice lands
- Intentionally unchanged:
  - Future-feature specs until the core stabilization slices are complete

## Plan

1. Finish P0 by aligning core screen tone and consolidating state UI components.
2. Finish P1 by adding regression coverage for `useStudySession`, the main end-to-end flow, and device/A11y checks.
3. Finish P2 by documenting trigger thresholds, coefficient review rules, text-mode responsibility, and persistence/migration policy.
4. Capture deferred future-feature work as P4 requirement notes rather than implementation tasks.

## Definition of Done

- P0 surfaces are visually consistent with the current design system
- P1 regression checks exist for the core learning flow and pass
- P2 rules are documented in the owning specs or runbooks
- P4 items are clearly parked and no longer mixed into current execution
- Relevant docs updated or explicitly declared unchanged
- Done log entry created if the task ships

## Verification

- Commands:
  - `npm run docs:check`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:run`
  - `npm run build`
  - `npm run e2e:smoke`
- Manual checks:
  - Core flow on desktop and mobile viewport
  - `Modal` layering and safe-area behavior
  - Long-name and long-text display
  - Basic accessibility names and focus visibility

## Progress

### Now

- Priorities were regrouped through a five-pass KJ-style exercise.
- The current recommended order is `P0 -> P1 -> P2 -> P3 -> P4`.
- P0 shared state UI alignment is complete and logged in `docs/done/2026-03.md`.
- P0 study / battle tone alignment is complete and logged in `docs/done/2026-03.md`.
- P0 secondary screen tone alignment is complete and logged in `docs/done/2026-03.md`.
- P0 is now implementation-complete for the core v1 surfaces.
- P1 smoke gate realignment is complete and logged in `docs/done/2026-03.md`.
- P1 session completion regression coverage is complete and logged in `docs/done/2026-03.md`.
- P1 progression side-effect regression coverage is complete and logged in `docs/done/2026-03.md`.
- P1 block generation regression coverage is complete and logged in `docs/done/2026-03.md`.
- P1 cross-screen smoke coverage expansion is complete and logged in `docs/done/2026-03.md`.
- P1 fixed-session result-state regression coverage is complete and logged in `docs/done/2026-03.md`.

### Next

- Continue P1 by expanding regression coverage beyond fixed-session completion and cross-screen entry paths.
- Add or strengthen checks around incorrect/correct/skip overlay transitions, timeout-specific result states, and other in-session UI behavior within the main learning flow.
- Follow regression work with device / A11y checks before moving into rule formalization.

### Decision Notes

- The main need is not more feature volume but a more stable and explainable core experience.
- Future features stay deferred until the current experience is coherent, test-covered, and documented.

### Risks

- UI work can drift from SSOT if docs do not move with implementation.
- Mobile-only rendering and PWA update issues may escape desktop-only verification.
- `npm run e2e:smoke` is restored, but its coverage is still intentionally narrow and should not be treated as the only regression gate.
- `useStudySession` completion, progression, generator priority, core cross-screen entry paths, and fixed-session result states are now covered, but broader in-session UI state transitions still need automated protection.

# Task: Secondary Screen Tone Alignment

- Date: 2026-03-17
- Owner: yutogasaki / codex
- Status: Active
- Review By: 2026-03-24
- Related ADR / Runbooks:
  - `docs/verification_matrix.md`
  - `docs/runbooks/release-checklist.md`

## Goal

- Align supporting screens with the refreshed system so setup, review, and settings feel continuous with the main learning experience.

## In Scope

- `src/pages/Stats.tsx`
- `src/pages/Settings.tsx`
- `src/pages/Onboarding.tsx`
- Supporting page-level presentation patterns that block consistency on those screens

## Out of Scope

- New settings features or onboarding steps
- Deep analytics or content changes

## SSOT References

- `docs/01_app_spec.md`
- `docs/06_screen_specs.md`
- `docs/07_ui_design_guideline.md`
- `docs/10_design_refresh_status.md`
- `docs/11_full_task_backlog.md`
- `docs/12_ui_fix_tasklist.md`

## Docs To Touch

- Must update:
  - `docs/10_design_refresh_status.md`
  - `docs/12_ui_fix_tasklist.md` if this resolves listed UI follow-ups
  - This task file while active
- Intentionally unchanged:
  - Future feature sections in `docs/01_app_spec.md`

## Plan

1. Align stats cards, section chips, and summary surfaces with the refreshed tone.
2. Refresh settings cards, modal entry points, and guarded actions using the shared state UI foundation.
3. Bring onboarding into the same visual family while preserving clarity for first-time users.

## Definition of Done

- Stats, settings, and onboarding feel like the same product family as Home and Study
- High-use support surfaces no longer rely on obvious legacy tone patterns
- Page readability and action hierarchy remain clear for parents and children
- Relevant docs updated or explicitly declared unchanged
- Done log entry created if the task ships

## Verification

- Commands:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:run`
  - `npm run build`
- Manual checks:
  - Browse stats sections, review cards, and test actions
  - Open settings modals and guarded actions
  - Walk through onboarding on a narrow mobile viewport

## Progress

### Now

- This slice follows the shared foundation and the main learning surfaces.

### Next

- Reuse the refreshed shared components before changing any page-specific ornamentation.

### Decision Notes

- These screens are grouped because they are adjacent support surfaces with similar panel-heavy composition.

### Risks

- `Stats` and `Settings` are large files, so visual work can become mixed with behavior cleanup if not kept disciplined.

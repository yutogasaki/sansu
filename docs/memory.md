# Project Memory

## Purpose

This file stores durable project memory only.
If the information would still matter after several unrelated tasks, it belongs here.

## What Belongs Here

- Source-of-truth relationships
- Durable design or product constraints
- Operational facts that are easy to forget and expensive to relearn
- Long-lived exceptions to the normal rules

## What Must Not Live Here

- Temporary task notes
- Daily progress
- Open questions without a decision
- Raw chat transcripts

## Durable Memory

### 1. Source of Truth

- [01_app_spec.md](01_app_spec.md) is the parent spec.
- Child specs under `docs/` must follow it.
- [07_ui_design_guideline.md](07_ui_design_guideline.md) is the design-principles doc.
- [10_design_refresh_status.md](10_design_refresh_status.md) is status only, not design truth.
- [11_full_task_backlog.md](11_full_task_backlog.md) is backlog only, not active execution truth.

### 2. Verification Baseline

- Current baseline commands are:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test:run`
  - `npm run build`
  - `npm run e2e:smoke` when release-sensitive flows change
- `npm run typecheck` is the fastest standalone TypeScript gate.
- `npm run build` still includes TypeScript build via `tsc -b`.

### 3. Risk Areas

- Learning/session logic
- Local storage and schema changes
- Parent/child UX and wording
- PWA update and cache behavior
- Navigation and onboarding flows

Schema changes should use `docs/runbooks/schema-migration.md`.

### 4. Skill Boundary

- `.agent/skills/` stores reusable workflows.
- Durable truth still belongs in docs, not only in Skills.

## When To Update Memory

- A repeated explanation appears in multiple PRs/tasks.
- A decision is easy to forget and costly to rediscover.
- A new doc becomes the clear SSOT for an area.

## When To Remove Memory

- The source doc changed and this file became stale.
- The fact is no longer durable and should move back into task history.

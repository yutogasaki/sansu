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

- [product/01_app_spec.md](/docs/product/01_app_spec.md) is the parent spec.
- Child specs under `docs/product/` must follow it.
- [product/07_ui_design_guideline.md](/docs/product/07_ui_design_guideline.md) is the design-principles doc.
- [tasks/design-refresh-status.md](/docs/tasks/design-refresh-status.md) is status only, not design truth.
- [tasks/backlog.md](/docs/tasks/backlog.md) is backlog only, not active execution truth.
- [ai/ownership_map.md](/docs/ai/ownership_map.md) is the tie-breaker when doc ownership is unclear.

### 2. Verification Baseline

- Current baseline commands are:
  - `npm run docs:check` for docs/process changes
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
- Documentation drift and context pollution

Schema changes should use `docs/runbooks/schema-migration.md`.
Cross-cutting durable risks are tracked in `docs/wiki/risk_register.md`.

### 4. Skill Boundary

- `.agents/skills/` stores current Codex repo-local workflows.
- `.claude/commands/` stores Claude-specific reusable prompt flows.
- Durable truth still belongs in docs, not only in Skills.
- `design-system/MASTER.md` is an AI-facing design brief, but `docs/product/07_ui_design_guideline.md` remains the design SSOT.
- Agent-specific memory tools may help continuity, but they must not replace repo truth.
- `doc-sync` should be used when a code change may require spec/doc updates.

### 5. Shared AI Operating Layer

- `docs/` remains the SSOT for product behavior, verification rules, runbooks, and durable project memory.
- `.agents/agent-guide.md` is the shared operations entry for both Codex and Claude Code.
- `.agents/tasks/*.md` is the shared queue layer, while detailed execution files remain in `docs/tasks/active/*.md`.
- `.agents/memory/durable.md` stores shared agent-operational reminders only and must stay subordinate to `docs/wiki/memory.md`.
- `AGENTS.md` and `CLAUDE.md` should stay concise and point to `.agents/` and `docs/` rather than duplicating long instructions.

## When To Update Memory

- A repeated explanation appears in multiple PRs/tasks.
- A decision is easy to forget and costly to rediscover.
- A new doc becomes the clear SSOT for an area.
- A risk keeps surfacing across unrelated tasks and deserves durable tracking.

## When To Remove Memory

- The source doc changed and this file became stale.
- The fact is no longer durable and should move back into task history.
- The content belongs in `docs/ai/archive_policy.md`, `docs/ai/ownership_map.md`, or `docs/wiki/risk_register.md` instead.

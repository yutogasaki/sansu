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

### 6. Approved Exploration Direction

- Sansu's approved target direction is an exploration-first math game: children solve math to open paths, choose where to go, discover things, and decide when to return.
- The intended world is a bright, wondrous underground setting, not a dark combat-oriented cave. Game tension may include short-term loss, rescue, and near-miss outcomes, but must not shame children or erase durable learning progress and confirmed discoveries.
- The approved live-encounter visual direction is `いびつ生態ポップ`: one full-width scene, one actor, one subject, one math-powered world verb, the subject's unexpected return, and the actor's counter-pose. Pop comes from an extreme readable silhouette, a biased focal color, material collision, and a bodily fact told before progress. Calm means one clear cause and limited competing motion, not low saturation or an expressionless world. `docs/product/14_ui_world_motion_spec.md` is the exploration visual SSOT; `docs/design/research-library-2026-07-19/benchmark-yoshi-fukashigi.md` is measured evidence and records the IP boundary.
- The current launch contract is `/` -> `/explore` with replace navigation, including after onboarding. `/study`, `/battle`, `/settings`, and the existing profile and learning data remain available without migration; the launch-route change alone must not write or reset them.
- Exploration must preserve Sansu's original rapid problem-solving rhythm. One route decision starts a three-question section; ordinary correct answers advance with zero extra taps, ordinary discoveries never block input, and only a large discovery, return, or recoverable persistence error may interrupt the question stream. The target is 650ms from a correct answer to the next operable problem and 550ms from an incorrect answer to retry.
- A fixed cold-open must not be preceded by route cards whose selected terrain or promise it cannot honor. Start the fixed opening with zero taps, then show the first meaningful route choice at the three-question boundary; every visible route choice must change the following node, action, or encounter in a way the child can recognize.
- PWA version drift may reload `/onboarding`, `/study`, `/explore`, or `/battle/play` before the first pointer/key interaction. After interaction begins, only that same in-memory session remains update-protected; React Router navigation re-arms the next route without relying on `hashchange`. A result/reward/break screen stays visible until the child chooses replay, continue, cancel, or another destination; only that action may form the same-route boundary, and only after required persistence. The replay/continue pointer becomes the first protected interaction of the new active session.
- PWA route safety is subordinate to persistence safety: Study answer/test writes and Explore run/attempt writes hold a global update gate across SPA navigation. A new build can reload only after every critical hold is released; canonical `appData` and its legacy profile mirror must update from the latest owned profile snapshot in one Dexie transaction so a retry or concurrent setting change cannot corrupt a completed test. Async Explore continuations must verify the mounted component and run identity before changing UI or navigation.
- The first validation surface remains a math-only `/explore` MVP. Its minimal learning bridge now uses the Study-shared planner/writer for reserved Due, weak, maintenance, follow-up, main, +1, and representation-retry assignments; unsupported game-only fallbacks remain outside SRS. Discovery persistence, run resume, and English exploration are still not integrated.
- [product/10_exploration_game_spec.md](/docs/product/10_exploration_game_spec.md) through [product/16_legacy_feature_decision.md](/docs/product/16_legacy_feature_decision.md) are the target-state SSOTs for their exploration domains. [product/17_open_questions.md](/docs/product/17_open_questions.md) records unresolved choices and is not settled behavior.
- The constitution and [product/01_app_spec.md](/docs/product/01_app_spec.md) establish the exploration direction and its staged rollout. The prior egg Home is no longer the launch surface; later integration work must still preserve the independent study and settings routes unless the parent spec explicitly changes them.
- [ai/implementation_plan_explore_mvp.md](/docs/ai/implementation_plan_explore_mvp.md) is an execution guide only; implementation order does not override product specifications.

## When To Update Memory

- A repeated explanation appears in multiple PRs/tasks.
- A decision is easy to forget and costly to rediscover.
- A new doc becomes the clear SSOT for an area.
- A risk keeps surfacing across unrelated tasks and deserves durable tracking.

## When To Remove Memory

- The source doc changed and this file became stale.
- The fact is no longer durable and should move back into task history.
- The content belongs in `docs/ai/archive_policy.md`, `docs/ai/ownership_map.md`, or `docs/wiki/risk_register.md` instead.

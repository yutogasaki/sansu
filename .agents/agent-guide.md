# Sansu Shared Agent Guide

## Purpose

This file is the shared operations guide for both Codex and Claude Code in the `sansu` repository.
Keep durable product and process truth in `docs/`, and use this file as the practical entry point for day-to-day agent work.

Shared canonical guide:

- `/Users/yutogasaki/Projects/_common-ai/PROJECTS_COMMON_AI_GUIDE.md`

## Read Order

1. `CONSTITUTION.md`
2. `docs/index.md`
3. `docs/ai/ownership_map.md`
4. `docs/ai/verification_matrix.md`
5. `docs/wiki/memory.md`
6. `.agents/tasks/TASKS.md`
7. `.agents/memory/durable.md`

For UI work, also read:

1. `docs/product/07_ui_design_guideline.md`
2. `docs/product/design_review_checklist.md`
3. `design-system/MASTER.md`

For exploration work, also read:

1. `docs/product/10_exploration_game_spec.md`
2. `docs/product/11_learning_integration_spec.md`
3. `docs/product/12_screen_flow_spec.md`
4. `docs/product/14_ui_world_motion_spec.md`
5. `docs/product/15_mvp_rollout_verification_spec.md`

For image-led exploration work, route through `.agents/skills/sansu-art-direction-loop/SKILL.md` before generating art or changing runtime presentation.

## Repo Snapshot

- Product: child-friendly math and English learning PWA
- Stack: React 19, TypeScript, Vite 7, Tailwind CSS 4, Dexie, Playwright, Vitest
- Deployment: static hosting on Vercel
- Storage model: client-side IndexedDB with offline-first behavior

## Working Boundaries

- `docs/` is the source of truth for product behavior, process, runbooks, and durable project memory.
- `.agents/` is the shared operations layer for both Codex and Claude Code.
- `.claude/` is the Claude-specific adapter layer.
- `.codex/` is reserved for Codex-specific adapter files if this repo later needs them.
- `design-system/MASTER.md` is an AI-facing implementation brief, not the design SSOT.

Do not duplicate the same durable rule across `docs/`, `.agents/`, `.claude/`, and `.codex/`.

## Repo Rules

- Spec first. `docs/product/01_app_spec.md` is the parent spec.
- One change should have one primary purpose.
- Verification is mandatory before closing work.
- UX must invite replay without shaming children; exploration uses readable valleys and short, energetic peaks.
- Routing, storage, tests, and PWA/update flows are high-risk areas.

## Key Commands

```bash
nvm use
npm ci
npm run dev
```

Core checks:

- `npm run docs:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `npm run build`
- `npm run e2e:smoke`
- `npm run verify:core`
- `npm run verify:release`

## Task And Memory Layout

- `.agents/tasks/TASKS.md`
  Shared active queue for both agents
- `.agents/tasks/BLOCKED.md`
  Shared blocked queue
- `.agents/tasks/DONE.md`
  Shared completion index pointing to durable history
- `docs/tasks/active/*.md`
  Detailed execution files for tasks in flight
- `docs/done/YYYY-MM.md`
  Durable done history
- `.agents/memory/durable.md`
  Shared agent-operational memory only
- `docs/wiki/memory.md`
  Durable project memory and SSOT relationships

## Shared Skills

Repo-local shared skills live in `.agents/skills/`:

- `sansu-art-direction-loop`
- `sansu-ui-builder`
- `sansu-verify`
- `sansu-doc-sync`
- `sansu-review`
- `sansu-design-review`
- `sansu-learning-check`
- `sansu-ux-tone`

Claude-only reusable prompts live in `.claude/commands/`.

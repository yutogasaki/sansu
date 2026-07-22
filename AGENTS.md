# Sansu Codex Entry

## Purpose

This file is the Codex entry point for the `sansu` repository.
Keep it short, point to the real source-of-truth docs, and route shared operations into `.agents/`.

Shared canonical guide:

- `/Users/yutogasaki/Projects/_common-ai/PROJECTS_COMMON_AI_GUIDE.md`

## Read First

1. `CONSTITUTION.md`
2. `.agents/agent-guide.md`
3. `docs/index.md`
4. `.agents/tasks/TASKS.md`
5. `.agents/memory/durable.md`
6. `docs/ai/verification_matrix.md`

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

For image-led exploration work, use `.agents/skills/sansu-art-direction-loop/SKILL.md` before generating art or changing runtime presentation.

## Repository Expectations

- Spec first. `docs/product/01_app_spec.md` is the parent spec.
- One change should have one primary purpose.
- Verification is mandatory before closing work.
- UX must be replayable and game-like without shaming children; ordinary moments stay readable and peak moments may be energetic.
- For image-led UI, compare the latest runtime screenshot beside the approved benchmark before release; prompts, specs, mocks, and automated tests are weaker evidence than the rendered screen.
- Image-led release evidence must identify the actual app target, build revision, delivery flag, and visual candidate ID, and include a critical-path contact sheet so stale builds and mixed visual lineages cannot pass as a finished change.
- Report visual appeal, silent comprehension/safety, and runtime integrity as separate non-compensating gates. Never let a strong technical score hide weak art.
- Routing, storage, tests, and PWA/update flows are high-risk areas.

## Boundary Rules

- `docs/` holds product, process, runbook, and durable project truth.
- `.agents/` holds shared operations, shared task queue, shared operational memory, and shared skills.
- `.claude/` holds Claude-specific adapters.
- `.codex/` is only for repo-committed Codex-specific adapters when needed.

Do not treat done logs, scratch notes, or agent-specific memory as the current source of truth.

## Setup And Commands

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

# CLAUDE.md

## Purpose

This file is the Claude Code entry point for the `sansu` repository.
Keep shared project truth in `docs/` and `.agents/`, and keep this file focused on Claude-specific guidance.

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

## Claude-Specific Layer

- Claude reusable prompts live in `.claude/commands/`
- Claude local settings live in `.claude/settings.local.json`
- Shared skills live in `.agents/skills/`, not `.claude/skills/`
- Shared tasks and shared operational memory live in `.agents/tasks/` and `.agents/memory/`

## Slash Commands

- `/project:verify`
- `/project:doc-sync`
- `/project:review`
- `/project:design-review`
- `/project:ux-tone`
- `/project:learning-check`
- `/project:release-check`

## Repo Rules

- `docs/product/01_app_spec.md` is the parent spec
- Verification is mandatory before closing work
- Routing, storage, tests, and PWA/update flows are high-risk areas
- Durable project truth belongs in `docs/`, not in Claude-only memory

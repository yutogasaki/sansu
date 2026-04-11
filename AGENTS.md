# Sansu Agent Guide

## Purpose

This file is the Codex entry point for the `sansu` repository.
Keep it concise, point to the real source-of-truth docs, and encode how agents should work here.

## First Read

1. `CONSTITUTION.md`
2. `docs/01_app_spec.md`
3. `docs/ownership_map.md`
4. `docs/verification_matrix.md`
5. `docs/memory.md`

For UI work, also read:

1. `docs/07_ui_design_guideline.md`
2. `docs/design_review_checklist.md`
3. `design-system/MASTER.md`

## Repository Expectations

- Spec first. `docs/01_app_spec.md` is the parent spec.
- One change should have one primary purpose.
- Verification is mandatory before closing work.
- UX must stay gentle for children and clear for parents.
- Routing, storage, tests, and PWA/update flows are high-risk areas.

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

## Source Of Truth Boundaries

- Product and behavior rules live in `docs/`.
- Durable project memory lives in `docs/memory.md`.
- AI-operational design guidance lives in `design-system/MASTER.md`, but `docs/07_ui_design_guideline.md` remains the design SSOT.
- Active execution context belongs in `docs/tasks/active/`.
- Historical facts belong in `docs/done/`.

Do not treat done logs, scratch notes, or agent-specific memory as the current source of truth.

## Shared AI Workflow

- Claude-specific memory systems such as `claude-mem` are optional accelerators, not the project truth.
- Repo-shared workflows for Codex live under `.agents/skills/`.
- Claude-specific prompts live under `.claude/commands/`.
- Legacy workspace skills still exist under `.agent/skills/`, but new Codex-facing repo skills should live in `.agents/skills/`.

## UI Rules

- The intended feel is calm, gentle, and non-competitive.
- Avoid loud colors, score-pressure, exaggerated celebration, and attention-seeking motion.
- Prefer shared tokens and surfaces from `src/index.css`:
  `--app-surface`, `--app-surface-strong`, `--app-border`, `--app-border-soft`, `--app-shadow`, `--app-shadow-strong`, `--app-accent`, `app-glass`, `app-glass-strong`.
- Keep one main action per screen.
- Use size, spacing, and placement before color for emphasis.
- If you create or restyle UI, check `design-system/MASTER.md` before writing code.

## Logic And Risk Rules

- Learning/session logic changes should be checked against the relevant child specs and tests.
- Storage/schema changes should review `docs/runbooks/schema-migration.md`.
- PWA or deployment-sensitive changes should review `docs/runbooks/pwa-release.md`.
- If a code change affects process, docs, or operational rules, run doc sync before closing.

## Done When

- Relevant docs are updated or explicitly called out as unchanged.
- The required checks from `docs/verification_matrix.md` are run, or any gap is recorded.
- User-visible risk and follow-up are called out clearly.

## Repo Skills

Codex can use these repo-local skills when relevant:

- `sansu-ui-builder`
- `sansu-verify`
- `sansu-doc-sync`
- `sansu-review`
- `sansu-design-review`
- `sansu-learning-check`
- `sansu-ux-tone`

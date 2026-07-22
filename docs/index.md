# Documentation Index

## Purpose

This file is the main entry point for repository documentation.
Use it to find the right source of truth before editing docs, tasks, runbooks, or agent-operational files.

## Layout

- `docs/product/`
  Product and design source of truth
- `docs/ai/`
  AI collaboration rules, verification policy, and doc ownership
- `docs/wiki/`
  Durable shared knowledge such as memory, glossary, and risk register
- `docs/tasks/`
  Backlog, status, and active execution docs
- `docs/runbooks/`
  Repeatable operational procedures

## Read Order

1. [../CONSTITUTION.md](../CONSTITUTION.md)
2. [product/01_app_spec.md](/docs/product/01_app_spec.md)
3. [ai/ownership_map.md](/docs/ai/ownership_map.md)
4. [ai/verification_matrix.md](/docs/ai/verification_matrix.md)
5. [wiki/memory.md](/docs/wiki/memory.md)
6. [ai/contributor-guide.md](/docs/ai/contributor-guide.md)

## AI Collaboration Layers

- `docs/`
  Human and AI shared long-term knowledge and process truth
- `.agents/`
  Shared operations layer for both Codex and Claude Code
- `.claude/`
  Claude-specific adapter layer
- `.codex/`
  Optional Codex-specific adapter layer when committed repo config is needed

## Frequently Used Docs

| File | Role | SSOT |
|---|---|---|
| [product/01_app_spec.md](/docs/product/01_app_spec.md) | Parent product spec | Yes |
| [product/07_ui_design_guideline.md](/docs/product/07_ui_design_guideline.md) | Design principles | Yes |
| [wiki/index.md](/docs/wiki/index.md) | Reusable knowledge map | Yes |
| [wiki/glossary.md](/docs/wiki/glossary.md) | Workspace glossary | Yes |
| [ai/ownership_map.md](/docs/ai/ownership_map.md) | Doc ownership and tie-breaks | Yes |
| [wiki/memory.md](/docs/wiki/memory.md) | Durable project memory | Yes |
| [ai/verification_matrix.md](/docs/ai/verification_matrix.md) | Minimum verification by change type | Yes |
| [ai/contributor-guide.md](/docs/ai/contributor-guide.md) | Shared AI collaboration boundaries | Yes |
| [tasks/active/README.md](/docs/tasks/active/README.md) | Detailed active-task file rules | Yes |

## Exploration Pivot Specs

The repository is transitioning toward an exploration-first math game. [product/01_app_spec.md](/docs/product/01_app_spec.md) defines the overall direction and staged rollout, while the following child specs are authoritative for their exploration domains. The implementation may intentionally lag the target during MVP validation; check the rollout phase before changing the main flow. If documents conflict, follow the repository source-of-truth order and fix the lower-level document before implementation.

| File | Role | Authority |
|---|---|---|
| [product/10_exploration_game_spec.md](/docs/product/10_exploration_game_spec.md) | Exploration loop, actions, resources, failure, and MVP run model | Target-state SSOT |
| [product/11_learning_integration_spec.md](/docs/product/11_learning_integration_spec.md) | Learning-engine, problem-gate, SRS, and subject integration | Target-state SSOT |
| [product/12_screen_flow_spec.md](/docs/product/12_screen_flow_spec.md) | Exploration routes, screens, and parent/child information split | Target-state SSOT |
| [product/13_data_storage_migration_spec.md](/docs/product/13_data_storage_migration_spec.md) | Exploration persistence, schema, and migration boundaries | Target-state SSOT |
| [product/14_ui_world_motion_spec.md](/docs/product/14_ui_world_motion_spec.md) | Exploration world, tone, motion, sound, and companion behavior | Target-state SSOT |
| [product/15_mvp_rollout_verification_spec.md](/docs/product/15_mvp_rollout_verification_spec.md) | MVP phases, validation questions, and success measures | Target-state SSOT |
| [product/16_legacy_feature_decision.md](/docs/product/16_legacy_feature_decision.md) | Keep/change/integrate/deprecate decisions for legacy features | Target-state SSOT |
| [product/17_open_questions.md](/docs/product/17_open_questions.md) | Unresolved exploration decisions and recommendations | Decision queue, not settled behavior |
| [ai/implementation_plan_explore_mvp.md](/docs/ai/implementation_plan_explore_mvp.md) | Suggested Codex implementation sequence and stop conditions | Execution guide, not product SSOT |

## Supporting Docs

| File | Role | SSOT |
|---|---|---|
| [tasks/design-refresh-status.md](/docs/tasks/design-refresh-status.md) | Design progress and status notes | No |
| [tasks/backlog.md](/docs/tasks/backlog.md) | Full backlog | No |
| [tasks/ui-fix-tasklist.md](/docs/tasks/ui-fix-tasklist.md) | UI-area task list | No |
| [product/design_review_checklist.md](/docs/product/design_review_checklist.md) | UI review checklist | Yes |
| [wiki/risk_register.md](/docs/wiki/risk_register.md) | Cross-cutting risks and mitigations | Yes |
| [ai/archive_policy.md](/docs/ai/archive_policy.md) | Doc trimming and archive rules | Yes |
| [runbooks/pwa-release.md](/docs/runbooks/pwa-release.md) | PWA update procedure | Yes |
| [runbooks/backlog-triage.md](/docs/runbooks/backlog-triage.md) | Backlog triage procedure | Yes |
| [runbooks/release-checklist.md](/docs/runbooks/release-checklist.md) | Release checklist | Yes |
| [runbooks/schema-migration.md](/docs/runbooks/schema-migration.md) | Storage migration procedure | Yes |

## Task And History Layout

- `.agents/tasks/TASKS.md`
  Shared active queue for both agents
- `.agents/tasks/BLOCKED.md`
  Shared blocked queue
- `.agents/tasks/DONE.md`
  Shared completion index
- `docs/tasks/active/`
  Detailed active task files
- `docs/tasks/archive/`
  Archived task or status material that no longer belongs in hot docs
- `docs/done/`
  Durable historical log

## Update Rules

- If behavior changes, update the governing spec first.
- If doc ownership is unclear, check `docs/ai/ownership_map.md`.
- If a change affects process or shared AI workflow, update `docs/ai/contributor-guide.md`.
- If a fact must survive across unrelated work, decide whether it belongs in `docs/wiki/memory.md` or `.agents/memory/durable.md`.
- Run `npm run docs:check` after doc or process updates.

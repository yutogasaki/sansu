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

# Documentation Index

## Purpose

This file is the main entry point for repository documentation.
Use it to find the right source of truth before editing docs, tasks, runbooks, or agent-operational files.

## Read Order

1. [../CONSTITUTION.md](../CONSTITUTION.md)
2. [01_app_spec.md](01_app_spec.md)
3. [ownership_map.md](ownership_map.md)
4. [verification_matrix.md](verification_matrix.md)
5. [memory.md](memory.md)
6. [runbooks/ai-agent-collaboration.md](runbooks/ai-agent-collaboration.md)

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
| [01_app_spec.md](01_app_spec.md) | Parent product spec | Yes |
| [07_ui_design_guideline.md](07_ui_design_guideline.md) | Design principles | Yes |
| [glossary.md](glossary.md) | Workspace glossary | Yes |
| [ownership_map.md](ownership_map.md) | Doc ownership and tie-breaks | Yes |
| [memory.md](memory.md) | Durable project memory | Yes |
| [verification_matrix.md](verification_matrix.md) | Minimum verification by change type | Yes |
| [runbooks/ai-agent-collaboration.md](runbooks/ai-agent-collaboration.md) | Shared AI collaboration boundaries | Yes |
| [tasks/active/README.md](tasks/active/README.md) | Detailed active-task file rules | Yes |

## Supporting Docs

| File | Role | SSOT |
|---|---|---|
| [10_design_refresh_status.md](10_design_refresh_status.md) | Design progress and status notes | No |
| [11_full_task_backlog.md](11_full_task_backlog.md) | Full backlog | No |
| [12_ui_fix_tasklist.md](12_ui_fix_tasklist.md) | UI-area task list | No |
| [design_review_checklist.md](design_review_checklist.md) | UI review checklist | Yes |
| [risk_register.md](risk_register.md) | Cross-cutting risks and mitigations | Yes |
| [archive_policy.md](archive_policy.md) | Doc trimming and archive rules | Yes |
| [runbooks/pwa-release.md](runbooks/pwa-release.md) | PWA update procedure | Yes |
| [runbooks/backlog-triage.md](runbooks/backlog-triage.md) | Backlog triage procedure | Yes |
| [runbooks/release-checklist.md](runbooks/release-checklist.md) | Release checklist | Yes |
| [runbooks/schema-migration.md](runbooks/schema-migration.md) | Storage migration procedure | Yes |

## Task And History Layout

- `.agents/tasks/TASKS.md`
  Shared active queue for both agents
- `.agents/tasks/BLOCKED.md`
  Shared blocked queue
- `.agents/tasks/DONE.md`
  Shared completion index
- `docs/tasks/active/`
  Detailed active task files
- `docs/done/`
  Durable historical log

## Update Rules

- If behavior changes, update the governing spec first.
- If doc ownership is unclear, check `ownership_map.md`.
- If a change affects process or shared AI workflow, update `runbooks/ai-agent-collaboration.md`.
- If a fact must survive across unrelated work, decide whether it belongs in `docs/memory.md` or `.agents/memory/durable.md`.
- Run `npm run docs:check` after doc or process updates.

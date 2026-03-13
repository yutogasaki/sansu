# Docs Map

## Purpose

This file is the entry point for workspace documentation.
It exists to reduce file bloat, duplicate truths, and context pollution.

## Read Order

1. [../CONSTITUTION.md](../CONSTITUTION.md)
2. [01_app_spec.md](01_app_spec.md)
3. Domain or screen-specific child specs
4. Verification, memory, ADR, and runbooks
5. Active tasks
6. Done logs

## Hot Docs

| File | Role | SSOT |
|---|---|---|
| [01_app_spec.md](01_app_spec.md) | Parent spec | Yes |
| [07_ui_design_guideline.md](07_ui_design_guideline.md) | Design principles | Yes |
| [glossary.md](glossary.md) | Workspace/process glossary | Yes |
| [ownership_map.md](ownership_map.md) | Doc ownership and SSOT map | Yes |
| [memory.md](memory.md) | Durable project memory | Yes |
| [verification_matrix.md](verification_matrix.md) | Required checks by change type | Yes |
| [tasks/active/README.md](tasks/active/README.md) | Active task flow | Yes |

## Warm Docs

| File | Role | SSOT |
|---|---|---|
| [10_design_refresh_status.md](10_design_refresh_status.md) | Design progress/status | No |
| [11_full_task_backlog.md](11_full_task_backlog.md) | Global backlog | No |
| [12_ui_fix_tasklist.md](12_ui_fix_tasklist.md) | Domain backlog/tasklist | No |
| [design_review_checklist.md](design_review_checklist.md) | UI review checklist | Yes |
| [risk_register.md](risk_register.md) | Durable cross-cutting risks | Yes |
| [archive_policy.md](archive_policy.md) | Archive/split policy for docs | Yes |
| [runbooks/pwa-release.md](runbooks/pwa-release.md) | Release/runbook for PWA updates | Yes |
| [runbooks/release-checklist.md](runbooks/release-checklist.md) | General release checklist | Yes |
| [runbooks/schema-migration.md](runbooks/schema-migration.md) | Storage/schema migration runbook | Yes |

## Cold Docs

- Old implementation plans
- Historical done logs
- Archived task files
- Archived status or note files under `docs/archive/`

## Workspace Structure

- `docs/adr/`
  - Non-obvious architecture or product decisions
- `docs/tasks/active/`
  - Work in progress only
- `docs/done/`
  - Completed work logs only
- `docs/runbooks/`
  - Operational procedures
- `docs/archive/`
  - Archived status, tasks, or notes that no longer belong in hot docs

## Skills

Workspace skills live under [../.agent/skills](../.agent/skills).
They define repeatable workflows, not project truth.

## Update Rules

- Update spec docs when behavior changes.
- Check `ownership_map.md` when unsure which doc should change.
- Update `memory.md` when a decision should survive multiple tasks.
- Write an ADR when the decision is expensive to rediscover.
- Move finished task context to `docs/done/` instead of leaving it in active files.
- Archive stale or bloated context according to `archive_policy.md`.

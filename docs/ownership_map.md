# Ownership Map

## Purpose

This file maps major workspace topics to their primary source of truth.
If the same topic appears in multiple docs, this file tells you which one should actually change.

## How To Use

1. Find the topic you changed.
2. Update the primary doc first.
3. Update supporting docs only if they need a pointer, status note, or runbook impact.

## Map

| Topic | Primary Doc | Supporting Docs | Update When |
|---|---|---|---|
| Product behavior and promises | [01_app_spec.md](01_app_spec.md) | Child specs under `docs/` | User-visible behavior, rules, or screen purpose changes |
| Screen-specific behavior | Screen or domain spec under `docs/` | [01_app_spec.md](01_app_spec.md) | A screen flow or domain rule changes in detail |
| Design principles, tone, tokens | [07_ui_design_guideline.md](07_ui_design_guideline.md) | [design_review_checklist.md](design_review_checklist.md), [10_design_refresh_status.md](10_design_refresh_status.md) | Shared visual language or tone guidance changes |
| Design rollout status | [10_design_refresh_status.md](10_design_refresh_status.md) | [07_ui_design_guideline.md](07_ui_design_guideline.md) | Progress, remaining rollout work, or status changes |
| Active execution context | [tasks/active/README.md](tasks/active/README.md) and `docs/tasks/active/*.md` | [verification_matrix.md](verification_matrix.md) | Work is currently in progress |
| Completed work history | `docs/done/YYYY-MM.md` | Active task file, related specs | Work is finished and needs a historical record |
| Durable cross-task memory | [memory.md](memory.md) | [risk_register.md](risk_register.md), [glossary.md](glossary.md) | A decision or fact should survive several unrelated tasks |
| Verification policy | [verification_matrix.md](verification_matrix.md) | Runbooks, task files | Required checks or review expectations change |
| Release and maintenance procedure | Files under `docs/runbooks/` | [verification_matrix.md](verification_matrix.md) | Operational steps or release risks change |
| Non-obvious design/architecture decision | Files under `docs/adr/` | Specs, runbooks, memory | A costly-to-rediscover decision is made |
| Global backlog | [11_full_task_backlog.md](11_full_task_backlog.md) | [12_ui_fix_tasklist.md](12_ui_fix_tasklist.md) | Priority ideas or deferred work changes |
| Workspace vocabulary | [glossary.md](glossary.md) | [01_app_spec.md](01_app_spec.md) for app terms | Process/documentation terminology changes |

## Tie-Breaker Rules

- If a file mixes status and rules, the rule doc wins and the status doc should point to it.
- If a task note starts acting like durable knowledge, move the durable part to `memory.md` or an ADR.
- If a done log is being used to infer current behavior, update the real SSOT instead.

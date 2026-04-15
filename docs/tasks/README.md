# Task Docs

## Purpose

Task docs capture active execution context only.

## Split

- `.agents/tasks/TASKS.md`
  Shared active queue for Codex and Claude Code
- `.agents/tasks/BLOCKED.md`
  Shared blocked queue
- `.agents/tasks/DONE.md`
  Shared completion index
- `docs/tasks/backlog.md`
  Global backlog and prioritization
- `docs/tasks/ui-fix-tasklist.md`
  Domain backlog/tasklist
- `docs/tasks/active/`
  Detailed execution files for the small set of tasks currently being executed
- `docs/tasks/archive/`
  Retired task or status detail kept only for reference

## Lifecycle

1. Pull from backlog into `.agents/tasks/TASKS.md`
2. Create or update the detailed file under `docs/tasks/active/`
3. Keep scope small
4. Close by removing the active queue entry and moving durable facts to `docs/done/` and, if needed, `docs/wiki/memory.md`
5. Move stale task detail or retired status notes into `docs/tasks/archive/` when they no longer belong in hot docs
6. Run `npm run docs:check` after task-doc changes

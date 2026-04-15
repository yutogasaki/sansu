# Backlog Triage

## Purpose

This runbook keeps backlog and status docs useful without turning them into shadow specs.
Use it to reduce file bloat, stale priorities, and context pollution.

## When To Run

- Monthly, or when a backlog/status doc starts feeling stale
- After several completed tasks land without backlog cleanup
- When a status doc begins mixing current priorities and old history

## Inputs

- `docs/tasks/backlog.md`
- `docs/tasks/ui-fix-tasklist.md`
- `docs/tasks/active/`
- `docs/done/`
- `docs/ai/archive_policy.md`
- `docs/ai/ownership_map.md`

## Triage Steps

1. Remove finished items from active or near-active sections.
2. Move completed execution detail to `docs/done/` if it matters historically.
3. Move stale detail that no longer guides current work into `docs/archive/`.
4. Split items that are true active work into `docs/tasks/active/`.
5. Refresh `更新日` and `次回棚卸し目安`.
6. Check whether any item is pretending to be spec, memory, or runbook content.
7. Run `npm run docs:check` after editing the docs set.

## Decision Rules

- If the item changes current product truth, update the real SSOT first.
- If the item is only a future idea, keep it in backlog.
- If the item is in progress now, promote it to an active task file.
- If the item is complete, summarize it in `docs/done/` and remove it from active planning text.

## Output Expectations

- Shorter backlog/status docs
- Clear next priorities
- No completed work lingering in active sections
- No status note being used as the real spec

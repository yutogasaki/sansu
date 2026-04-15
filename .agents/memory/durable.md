# Shared Agent Durable Memory

## Purpose

This file stores shared agent-operational memory for Sansu.
It must stay subordinate to `docs/` and must not replace product, process, or design source-of-truth documents.

## Durable Reminders

- `docs/index.md` is the main documentation entry point.
- `docs/wiki/memory.md` remains the durable project-memory SSOT.
- `.agents/agent-guide.md` is the shared operations entry for both Codex and Claude Code.
- `.agents/tasks/*.md` is the shared queue layer; detailed execution notes still live in `docs/tasks/active/*.md`.
- `.agents/skills/` is the canonical home for shared repo-local skills.
- `.claude/commands/` is the canonical home for Claude-only reusable prompts.
- `design-system/MASTER.md` helps implementation, but `docs/product/07_ui_design_guideline.md` remains the design SSOT.
- Add `.codex/` only when the repo needs committed Codex-specific adapter files such as config or hook registration.

## Do Not Store Here

- Product behavior rules
- Long-term project truth already covered by `docs/wiki/memory.md`
- Temporary debugging notes
- Daily progress updates

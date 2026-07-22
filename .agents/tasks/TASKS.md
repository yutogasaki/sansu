# Shared Task Queue

## Purpose

This file is the shared active queue for both Codex and Claude Code.
Keep only short active entries here, and put detailed execution context in `docs/tasks/active/*.md`.

## Rules

- One line per active task in this file
- One detailed task file per active task under `docs/tasks/active/`
- Remove the queue entry when the task closes
- Move durable outcomes to `docs/done/YYYY-MM.md`

## Current Queue

- Cold-open Value Loop -> docs/tasks/active/2026-07-21-cold-open-value-loop.md
- Whole-app brand coherence -> docs/tasks/active/2026-07-23-whole-app-brand-coherence.md

When starting or resuming a task, add:

- `- short task name -> docs/tasks/active/YYYY-MM-DD-task-name.md`

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

- No shared queue entries are recorded here yet.

When starting or resuming a task, add:

- `- short task name -> docs/tasks/active/YYYY-MM-DD-task-name.md`

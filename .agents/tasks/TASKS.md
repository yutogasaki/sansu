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

- Nature Town S1：受入43項目確認済み。次は描画・画面再開の乱数不変（NT-3）、残り4項目 -> docs/tasks/active/2026-09-16-nature-town-s1.md

- Mysterious island v3 -> docs/tasks/active/2026-09-13-mysterious-island-v3.md

- Home journey connection preview -> docs/tasks/active/2026-09-09-home-journey-preview.md

- Full island experience from benchmark -> docs/tasks/active/2026-09-08-island-experience.md

- Learning rhythm and island game experience -> docs/tasks/active/2026-09-07-experience-improvements.md

- Cold-open Value Loop -> docs/tasks/active/2026-07-21-cold-open-value-loop.md
- Whole-app brand coherence -> docs/tasks/active/2026-07-23-whole-app-brand-coherence.md

When starting or resuming a task, add:

- `- short task name -> docs/tasks/active/YYYY-MM-DD-task-name.md`

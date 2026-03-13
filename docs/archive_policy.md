# Archive Policy

## Purpose

This file defines how we prevent file bloat and context pollution in the workspace.
Archive or split context before it starts competing with the real source of truth.

## Core Rules

- Hot docs should stay short enough to scan before coding.
- Status, rule, history, and task execution notes should not live in the same file.
- Archive stale context instead of endlessly appending to active docs.
- If a document mixes more than one durable role, split it.

## Task Rules

- Every active task should include a `Review By` date.
- If the review date passes, either refresh the scope, pause it explicitly, or close it.
- If a task is done, move the lasting outcome into `docs/done/` and remove the active file.
- If an active task grows beyond one primary purpose, split it into smaller task files.

## Status and Backlog Rules

- Status docs should summarize progress, not store step-by-step execution history forever.
- Backlog docs should not contain temporary implementation notes.
- If a status or backlog doc becomes long because of stale history, move old detail under `docs/archive/`.

## Memory and ADR Rules

- `memory.md` should keep only durable facts that survive multiple unrelated tasks.
- If a memory item becomes outdated, delete it instead of keeping a dead breadcrumb.
- Use an ADR when the missing context would be expensive to rediscover.

## Suggested Split Triggers

- A hot doc exceeds roughly 300 lines and mixes role + status + history.
- An active task has gone one review cycle without meaningful updates.
- A status doc contains historical detail that no longer changes current decisions.
- A done log entry starts turning into living design or behavior documentation.

## Archive Location

Use [archive/README.md](archive/README.md) as the starting point for archived task, status, or note files.

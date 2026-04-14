# AI Agent Collaboration

## Purpose

This runbook explains how Sansu should be operated with both Claude Code and Codex without letting agent-specific memory replace project truth.

## Shared Principles

1. `CONSTITUTION.md` wins
2. `docs/01_app_spec.md` is the parent spec
3. Durable project truth stays inside the repository
4. Agent-specific memory is optional and subordinate
5. Verification remains mandatory no matter which agent made the change
6. Entry files stay short and point to shared canonical docs
7. Do not duplicate the same durable rule across `docs/`, `.agents/`, `.claude/`, and `.codex/`

## Shared Source Boundaries

| Topic | Shared source |
|---|---|
| Product behavior | `docs/01_app_spec.md` and child specs |
| Design truth | `docs/07_ui_design_guideline.md` |
| AI-facing design brief | `design-system/MASTER.md` |
| Durable project memory | `docs/memory.md` |
| Shared agent operations | `.agents/agent-guide.md` |
| Shared task queue | `.agents/tasks/TASKS.md`, `.agents/tasks/BLOCKED.md`, `.agents/tasks/DONE.md` |
| Detailed active task context | `docs/tasks/active/*.md` |
| Process and release rules | `docs/runbooks/` |
| Shared repo-local skills | `.agents/skills/` |
| Claude repo prompts | `.claude/commands/` |
| Codex-specific committed adapter files | `.codex/` when needed |

## Repo Entry Files

- `AGENTS.md`
  Codex entry point only. Keep it small and route shared operations into `.agents/`.
- `CLAUDE.md`
  Claude entry point only. Keep it small and focus on Claude-specific notes plus links to shared files.
- `docs/index.md`
  Main documentation index for both humans and agents.
- `.agents/agent-guide.md`
  Shared operating entry after `AGENTS.md` or `CLAUDE.md`.

## Codex Setup For This Repo

- `AGENTS.md` is the repo entry point
- Shared repo-local skills live under `.agents/skills/`
- Keep skills focused and repo-specific
- Prefer repo-local skills over committing generated `.codex/skills/` trees
- Add `.codex/` only when the repo actually needs committed Codex-specific config or hook registration

### Why repo-local `.agents/skills/`

Current Codex guidance favors `.agents/skills/` for repository-scoped skills.
This keeps the setup portable for everyone who clones the repo and avoids hiding important behavior in personal global config.

## Claude Setup For This Repo

- `CLAUDE.md` remains the main Claude entry point
- Reusable review/verification flows live under `.claude/commands/`
- Shared task and memory entry points live under `.agents/`
- Claude-only conversational memory belongs outside the project truth boundary

## Optional Claude-Mem

`claude-mem` is useful for session continuity in Claude Code, but it should store working memory, not replace repo truth.

Recommended install inside Claude Code:

```text
/plugin marketplace add thedotmack/claude-mem
/plugin install claude-mem
```

Use it for:

- session continuity
- recalling prior debugging trails
- recovering context after reconnects

Do not use it as the only place for:

- product decisions
- verification baselines
- SSOT updates
- durable design rules

Those must still land in `docs/` or `design-system/MASTER.md`.

## Optional UI UX Pro Max

`ui-ux-pro-max` is a strong design accelerator, especially for early concepting and design-system framing.
For this repo, the best fit is:

1. keep repo truth in `docs/07_ui_design_guideline.md`
2. keep the AI-facing implementation brief in `design-system/MASTER.md`
3. adapt useful ideas into repo-local skills instead of committing a large generated Codex tree

This avoids conflicts with the repo's current documentation system and keeps Codex aligned with the repo-local skill layout.

## Standard Working Loops

### Normal Code Change

1. Read `CONSTITUTION.md`
2. Read the relevant spec
3. Implement a small change
4. Run required verification
5. Run doc sync if the change affects behavior or process

### UI Change

1. Read `docs/07_ui_design_guideline.md`
2. Read `design-system/MASTER.md`
3. Implement with shared tokens and surfaces
4. Review tone, hierarchy, and mobile density
5. Run build and relevant checks

### Learning Logic Change

1. Read the relevant spec docs
2. Update or add targeted tests
3. Run logic-focused verification
4. Record any durable threshold or pacing decision in docs if needed

## Maintenance Rules

- If a workflow is repeated often in Codex, promote it into `.agents/skills/`
- If a workflow is repeated often in Claude, promote it into `.claude/commands/`
- If both agents need the same durable operational reminder, write it in `.agents/`
- If both agents need the same durable project fact, write it in `docs/` or `design-system/MASTER.md`
- If instructions drift, update the shared repo files first and agent-specific files second

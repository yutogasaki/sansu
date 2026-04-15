# Sansu Constitution

## 0. Purpose

This file defines the highest-priority principles for the `sansu` workspace.
If documents or decisions conflict, this file wins.

## 1. Priority Order

1. Child/parent clarity and trust
2. Functional correctness and data safety
3. Small, verifiable changes
4. Maintainability of code and docs
5. Delivery speed
6. Novelty

## 2. Non-Negotiables

- Spec first. `docs/product/01_app_spec.md` is the parent spec.
- One change should have one primary purpose.
- Verification is mandatory before closing work.
- UX must stay gentle for children and clear for parents.
- Routing, storage, tests, and PWA/update flows are high-risk areas.

## 3. Source-of-Truth Order

1. `CONSTITUTION.md`
2. `docs/product/01_app_spec.md`
3. Child specs under `docs/`
4. Runbooks and verification docs for process
5. Active task docs for local execution intent
6. Done logs for historical facts

Done logs are not a source of truth for current behavior.

## 4. Context Hygiene

- `memory` stores durable decisions only.
- `task` stores active work only.
- `Done` stores completed facts only.
- `ADR` stores non-obvious design decisions only.
- Archive stale context instead of appending forever.

## 5. Size and Split Rules

- Review React pages/hooks when they cross roughly 300 lines.
- Split docs when they mix rule, status, and history.
- Do not mix spec with implementation status.
- Do not mix backlog with active task execution notes.

## 6. Baseline Definition of Done

- Relevant docs are updated or explicitly declared unchanged.
- Required verification is run, or the gap is recorded.
- User-visible risks and follow-ups are called out.

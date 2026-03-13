# Verification Matrix

## Purpose

This file defines the minimum verification expected for each change type.
If a check cannot run, record the gap in the active task and the done log.

## Current Commands

| Command | Purpose |
|---|---|
| `npm run docs:check` | Docs/process link and structure checks |
| `npm run lint` | Static linting |
| `npm run typecheck` | Fast TypeScript verification |
| `npm run test:run` | Unit/integration tests |
| `npm run build` | TypeScript build + production build |
| `npm run e2e:smoke` | Smoke E2E for critical flows |
| `npm run verify:core` | Full local quality gate |
| `npm run verify:release` | Full local quality gate + smoke E2E |

## Matrix

| Change Type | Required Checks | Manual Checks | Notes |
|---|---|---|---|
| Docs only | `npm run docs:check` | Read-through for role/tone sanity | No app build required unless behavior text changed |
| Copy or content only | `npm run lint`, `npm run build` | Affected screen wording | Check tone for child/parent UX |
| Shared UI component | `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build` | Desktop + mobile layout sanity | Prefer screenshot or visual notes |
| Page-level UI/state | `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build` | Main flow through affected screen | Include modal, loading, error, empty state |
| Learning/domain logic | `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build` | Targeted scenario walkthrough | Add/update tests when logic changes |
| Storage/schema/profile data | `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build` | Existing profile load/save | Write ADR or migration note if needed |
| PWA/deploy/update flow | `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`, `npm run e2e:smoke` | Install/update/reload path | Review host cache behavior too |
| Release candidate | All of the above | Critical path smoke on target devices | Include iOS/Android/PWA notes if relevant |

## Review Prompts

- Did the change touch a high-risk area from `memory.md`?
- Does `ownership_map.md` imply a doc or ADR update?
- Did the spec need updating?
- Is there a missing regression test?
- Is there a host/deploy side effect?
- Does `risk_register.md` need a new note or updated mitigation?

## Escalation Rule

If a task spans more than one change type, use the stricter row.

## Shortcut Commands

- Use `npm run docs:check` for docs/process-only changes.
- Use `npm run verify:core` when a change touches code across multiple layers.
- Use `npm run verify:release` for release-sensitive changes.

# Verification Matrix

## Purpose

This file defines the minimum verification expected for each change type.
If a check cannot run, record the gap in the active task and the done log.
GitHub Actions should mirror the same baseline for `docs:check` and `verify:core`.

## Current Commands

| Command | Purpose |
|---|---|
| `npm run docs:check` | Docs/process link and structure checks |
| `npm run lint` | Static linting |
| `npm run typecheck` | Fast TypeScript verification |
| `npm run test:run` | Unit/integration tests |
| `npm run assets:check` | PWA precache・探索画像の容量と制作物混入を検査 |
| `npm run build` | TypeScript build + production build + `assets:check` |
| `npm run e2e:smoke` | Smoke E2E for critical flows |
| `npm run e2e:pwa-update` | Production-preview regression for protected-route and same-route update checkpoints |
| `npm run benchmark:fixed-ten` | Study / Exploreの固定10問throughput、回復、中断、game-only receipt整合を比較 |
| `npm run verify:core` | Docs check + full local quality gate |
| `npm run verify:release` | Full local quality gate + smoke E2E + production PWA checkpoint E2E |

## Matrix

| Change Type | Required Checks | Manual Checks | Notes |
|---|---|---|---|
| Docs only | `npm run docs:check` | Read-through for role/tone sanity | No app build required unless behavior text changed |
| Copy or content only | `npm run lint`, `npm run build` | Affected screen wording | Check tone for child/parent UX |
| Shared UI component | `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build` | Desktop + mobile layout sanity | Prefer screenshot or visual notes |
| Page-level UI/state | `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build` | Main flow through affected screen | Include modal, loading, error, empty state |
| Learning/domain logic | `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build` | Targeted scenario walkthrough | Add/update tests when logic changes |
| Exploration pure domain | `npm run docs:check`, `npm run lint`, `npm run typecheck`, targeted reducer/generator tests, `npm run test:run`, `npm run build` | Fixed-seed run, incorrect-answer penalty, voluntary return, energy depletion | Ensure energy never goes below zero and every run can end |
| Exploration page/routing | `npm run verify:core`, `npm run e2e:smoke` | Complete and replay one run on phone-width and tablet-width layouts; check reduced motion | Existing `/study`, `/battle`, onboarding, and private-route behavior must remain reachable |
| Image-led UI / encounter | `npm run verify:core`, `npm run e2e:smoke`, `npm run assets:check`, `npm run benchmark:fixed-ten` | On the actual app target, compare 390×844 and 768×1024 runtime screenshots beside the approved benchmark; capture launch through the next destination; verify full TenKey, fixed-question throughput, sound off, reduced motion, and cold-cache/PWA update | Fixed-tenはreportの `evidence.eligible = true` かつ `pass = true` とversioned監査への集計転記を必須とし、10反復未満をdiagnostic、通常planner真正性を別検証とする。Record build revision, delivery flag, rendered candidate ID, and cache state. Report visual magnetism, silent comprehension/safety, and runtime integrity separately; mixed legacy/HOLD visual lineage is a HOLD |
| Storage/schema/profile data | `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build` | Existing profile load/save | Write ADR or migration note if needed |
| PWA/deploy/update flow | `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`, `npm run assets:check`, `npm run e2e:smoke`, `npm run e2e:pwa-update` | Real two-build install/update/reload path; iOS relaunch | Review host cache behavior, precache size, persistence-before-checkpoint, and production-asset boundaries too |
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
  It already includes `npm run docs:check`.
- Use `npm run verify:release` for release-sensitive changes.

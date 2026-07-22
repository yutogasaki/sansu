# Sansu / ポッコのふしぎずかん Constitution

## 0. Purpose

This file defines the highest-priority principles for the `sansu` workspace.
If documents, implementation, task notes, past logs, or conversational decisions conflict, this file wins.

Sansu / ポッコのふしぎずかん is not only a learning utility. It is a **math game children choose to replay**, where repeated arithmetic practice and retention grow as a consequence of an engaging exploration experience.

## 1. Product North Star

> ポッコのふしぎずかんは、子どもが相棒ポッコと明るい地底世界を探検し、算数で掘り進み、発見・判断・失敗・再挑戦をくり返すことで、自然に計算練習を続けたくなるPWAである。

## 2. Priority Order

1. Children want to replay by their own choice
2. Recoverable failure that does not shame children, plus parent trust
3. Learning integrity, functional correctness, and data safety
4. Small, verifiable implementation steps
5. Maintainability and consistency between specs and implementation
6. Calmness and visual restraint during ordinary moments
7. Delivery speed

Fun is the first product test, but it never authorizes harm to a child's self-efficacy, unsafe learning progression, or destructive data handling.

## 3. Core Design Thesis

### 3.1 Math is a game action, not a toll

Problems should power actions such as:

- breaking open a rock
- connecting a bridge
- activating a terrain switch
- escaping a risky route
- opening a chance at a rare discovery

The actions children feel they are performing are **dig, choose, move, return, build, discover, and bring things home**.

### 3.2 Learning does not shame; the game may fail

The product distinguishes ability judgment from recoverable game consequences.

| Area | Rule |
|---|---|
| Deny or belittle a child's ability | Never |
| Lower learning progress as punishment | Never |
| Remove a discovery already registered in a collection | Never |
| Miss a temporary bonus in the current run | Allowed |
| Take a detour or retry a bridge | Allowed |
| Lose part of unconfirmed run materials | Allowed when clearly communicated |
| End a run and offer a quick retry | Allowed |
| Use a brief, playful failure animation | Encouraged when it invites retry |

### 3.3 Remove meaningless choices, add meaningful choices

Reduce:

- setup choices before play
- settings mixed into the child surface
- choices that require instructions to understand
- parent information inside the play flow

Add:

- safe path or discovery path
- continue or return
- spend or save a bridge resource
- nearby known find or distant unknown light
- challenge or detour

## 4. Non-Negotiables

1. **Fun First**: Ask first whether the change makes children want another run.
2. **Recoverable Failure**: Failure is short, understandable, and easy to retry.
3. **No Shame**: Incorrect answers, skips, and low scores never become ability or character judgments.
4. **Meaningful Choice**: A run contains several choices with visible game consequences.
5. **Surprise by Design**: Discovery is predictable enough to form expectations, but not fully knowable.
6. **Peaks and Valleys**: Ordinary play remains readable; discovery peaks may use stronger sound, color, and motion briefly.
7. **Player-Generated Stories**: A completed run should produce a small story worth retelling.
8. **Learning Integrity**: Math generators, SRS, Due, weak handling, unlock rules, and lesson bundles remain authoritative unless a spec explicitly changes them.
9. **Local First**: Login and cloud sync are out of scope; local data remains the default.
10. **Spec First**: Update the parent and relevant child specs before behavior changes.
11. **One Primary Purpose**: Keep each implementation step focused and reviewable.
12. **Small Verifiable Steps**: Verification is required before work closes.
13. **No Dark Core**: Horror, death, blood, and defeating enemies are not the center of the world.
14. **Data Safety**: Routing, storage, tests, and PWA update flows remain high-risk areas.

## 5. Source-of-Truth Order

1. `CONSTITUTION.md`
2. `docs/product/01_app_spec.md`
3. `docs/product/10_exploration_game_spec.md`
4. `docs/product/11_learning_integration_spec.md`
5. Other child specs under `docs/product/`
6. `docs/ai/verification_matrix.md` and runbooks
7. Current implementation
8. Active task documents
9. Done logs and conversation history

Done logs are historical facts, not a source of truth for current behavior.

## 6. Product and Operations Boundaries

- `docs/` stores product, process, runbook, and durable project truth.
- `.agents/` stores shared operations, reusable workflows, task queues, and operational memory.
- `.claude/` stores Claude-specific adapters.
- `.codex/` stores only repository-committed Codex adapters when needed.
- `memory` stores durable decisions only.
- `task` stores active work only.
- `ADR` stores non-obvious decisions that are costly to rediscover.
- Status notes never replace the governing spec.

## 7. Size and Split Rules

- Review React pages and hooks when they cross roughly 300 lines.
- Keep exploration domain state in pure modules rather than one large page component.
- Split documents when they mix rules, implementation status, and history.
- Do not mix backlog with active execution notes.
- Do not add large exploration state directly to `UserProfile`; use a dedicated persistence boundary when storage is introduced.

## 8. Baseline Definition of Done

- Relevant specs are updated first, or a no-change decision is recorded.
- Required lint, typecheck, tests, and build checks run successfully, or the gap is recorded.
- Exploration domain changes have focused reducer or generator tests.
- Routing, IndexedDB, PWA, and learning-log changes receive their additional required verification.
- Child-facing copy contains no unnecessary ability judgment or punishment.
- The fun hypothesis and any unverified experience risk are stated in the handoff.
- User-visible risks and follow-ups are called out.

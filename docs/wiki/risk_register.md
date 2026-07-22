# Risk Register

## Purpose

This file tracks durable, cross-cutting risks that should stay visible across multiple tasks.
It is not a bug tracker and not a release checklist.

## Current Risks

| Risk | Why It Matters | Current Controls | Review When |
|---|---|---|---|
| PWA cache/update drift | Users can stay on stale code after deploy, especially on mobile/PWA surfaces | [runbooks/pwa-release.md](/docs/runbooks/pwa-release.md), [runbooks/release-checklist.md](/docs/runbooks/release-checklist.md), release verification, forced reload deferral while `/onboarding`, `/study`, `/explore`, or `/battle/play` holds in-memory progress | Hosting, cache headers, update flow, or service worker behavior changes |
| Local storage and schema migration issues | Existing profiles can break or lose compatibility after data-shape changes | [product/13_data_storage_migration_spec.md](/docs/product/13_data_storage_migration_spec.md), [runbooks/schema-migration.md](/docs/runbooks/schema-migration.md), [ai/verification_matrix.md](/docs/ai/verification_matrix.md), targeted tests | Storage keys, profile shape, exploration tables, migration logic, or persistence behavior changes |
| Onboarding and navigation regressions | Children or parents can get stuck or skip expected steps, which directly harms trust | [product/01_app_spec.md](/docs/product/01_app_spec.md), screen specs, smoke/manual walkthroughs | Routing, onboarding, modal, or guard flows change |
| Design/tone drift between child and parent surfaces | Calm, trustworthy UX can erode slowly through local-only styling or wording choices | [product/07_ui_design_guideline.md](/docs/product/07_ui_design_guideline.md), [product/design_review_checklist.md](/docs/product/design_review_checklist.md), design review skill | New screens, major refreshes, or broad visual changes land |
| Exploration spec-to-implementation transition drift | The approved target intentionally leads the shipped implementation during MVP validation, so an agent could replace the main flow prematurely or mistake legacy behavior for the long-term direction | [docs index](/docs/index.md), [ai/ownership_map.md](/docs/ai/ownership_map.md), [product/15_mvp_rollout_verification_spec.md](/docs/product/15_mvp_rollout_verification_spec.md), staged `/explore` rollout | Work changes the main home/study flow, rollout phase, or exploration authority |
| Game incentives distort learning progression | Route or reward choices can let children avoid due/weak work, change effective difficulty, or turn math into a frustrating toll | [product/11_learning_integration_spec.md](/docs/product/11_learning_integration_spec.md), Study-shared planner, immutable run assignment, atomic/idempotent learning writes, targeted learning tests | Problem gates, penalties, challenge routes, SRS writes, or subject scope change |
| Exploration consequences hurt rather than motivate | Energy loss, rescue, near misses, or lost temporary rewards can create shame or disengagement, especially for younger children | [product/10_exploration_game_spec.md](/docs/product/10_exploration_game_spec.md), [product/14_ui_world_motion_spec.md](/docs/product/14_ui_world_motion_spec.md), [product/15_mvp_rollout_verification_spec.md](/docs/product/15_mvp_rollout_verification_spec.md), family observation | Penalties, failure copy, return loss, sound/motion, or target age changes |
| Exploration run can become unwinnable or confusing | Generated routes, bridge events, and energy accounting can strand the player or hide the next action | [product/10_exploration_game_spec.md](/docs/product/10_exploration_game_spec.md), [product/15_mvp_rollout_verification_spec.md](/docs/product/15_mvp_rollout_verification_spec.md), reducer/generator invariants | Map generation, energy costs, return rules, bridge behavior, or resume logic changes |
| Bundle growth and heavy PDF path | Install/update/startup cost rises on mobile, and large chunks are easier to miss in gradual growth | `npm run build`, [runbooks/release-checklist.md](/docs/runbooks/release-checklist.md), future code-splitting work | New large dependencies, asset additions, or build warnings appear |
| Documentation drift and context pollution | Wrong fixes happen faster when rules, status, tasks, and memory blur together | [ai/ownership_map.md](/docs/ai/ownership_map.md), [ai/archive_policy.md](/docs/ai/archive_policy.md), [wiki/memory.md](/docs/wiki/memory.md), `doc-sync` skill, CI docs check | Large refactors, repeated explanations, or growing status docs appear |

## Update Rules

- Add a risk only if it is durable and likely to recur across tasks.
- Remove or rewrite a risk when the control strategy changes materially.
- Link to the doc that owns the mitigation instead of copying long procedures here.

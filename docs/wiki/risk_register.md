# Risk Register

## Purpose

This file tracks durable, cross-cutting risks that should stay visible across multiple tasks.
It is not a bug tracker and not a release checklist.

## Current Risks

| Risk | Why It Matters | Current Controls | Review When |
|---|---|---|---|
| PWA cache/update drift | Users can stay on stale code after deploy, especially on mobile/PWA surfaces | [runbooks/pwa-release.md](/docs/runbooks/pwa-release.md), [runbooks/release-checklist.md](/docs/runbooks/release-checklist.md), release verification | Hosting, cache headers, update flow, or service worker behavior changes |
| Local storage and schema migration issues | Existing profiles can break or lose compatibility after data-shape changes | [runbooks/schema-migration.md](/docs/runbooks/schema-migration.md), [ai/verification_matrix.md](/docs/ai/verification_matrix.md), targeted tests | Storage keys, profile shape, migration logic, or persistence behavior changes |
| Onboarding and navigation regressions | Children or parents can get stuck or skip expected steps, which directly harms trust | [product/01_app_spec.md](/docs/product/01_app_spec.md), screen specs, smoke/manual walkthroughs | Routing, onboarding, modal, or guard flows change |
| Design/tone drift between child and parent surfaces | Calm, trustworthy UX can erode slowly through local-only styling or wording choices | [product/07_ui_design_guideline.md](/docs/product/07_ui_design_guideline.md), [product/design_review_checklist.md](/docs/product/design_review_checklist.md), design review skill | New screens, major refreshes, or broad visual changes land |
| Bundle growth and heavy PDF path | Install/update/startup cost rises on mobile, and large chunks are easier to miss in gradual growth | `npm run build`, [runbooks/release-checklist.md](/docs/runbooks/release-checklist.md), future code-splitting work | New large dependencies, asset additions, or build warnings appear |
| Documentation drift and context pollution | Wrong fixes happen faster when rules, status, tasks, and memory blur together | [ai/ownership_map.md](/docs/ai/ownership_map.md), [ai/archive_policy.md](/docs/ai/archive_policy.md), [wiki/memory.md](/docs/wiki/memory.md), `doc-sync` skill, CI docs check | Large refactors, repeated explanations, or growing status docs appear |

## Update Rules

- Add a risk only if it is durable and likely to recur across tasks.
- Remove or rewrite a risk when the control strategy changes materially.
- Link to the doc that owns the mitigation instead of copying long procedures here.

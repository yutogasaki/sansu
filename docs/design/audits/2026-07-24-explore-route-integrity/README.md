# Explore Route Integrity Audit

- Date: 2026-07-24
- Actual validation target: `http://127.0.0.1:5173`
- Baseline revision: `d2317bc48d3ee79db15133547a0b6ac5b1faab42`
- Validated state: dirty working tree after route-integrity fix
- Delivery / feature flag: `classic-v1` in smoke tests; presentation-specific Root Pull and Snap Root scenarios also passed
- Viewports: 390×844, 768×1024, 1024×768

## Failure

At `steps=0`, the UI exposed ordinary terrain choices such as `なぞの壁`, but the following first three problems ignored the chosen node and always rendered the fixed root-dig cold open. Persistence and restart were healthy; the visible choice itself was dishonest.

## Fix

- Fixed cold opens auto-route and open the first playable problem with zero extra taps.
- The first route choice appears after the three-question cold open, when the selected node can change the following action.
- Mobile route maps show the current node and available next nodes, not the full locked/opened network.
- Route cards use one child-readable question, the terrain name, its concrete hint, and one arrow. Decorative numbering and repeated identical cost labels were removed.
- Replay copy says a route may be encountered rather than guaranteeing the first destination.

## Non-compensating Gates

- Visual magnetism: **GO for layout cleanup**, runtime 390×844 evidence; this audit does not reapprove encounter source art.
- Silent comprehension / safety: **GO for route meaning**; visible choices are only shown when the following action can honor them.
- Runtime integrity: **GO**; unit, build, asset, and 22-scenario browser smoke checks passed.
- Whole-app continuity: **GO for the affected critical path**; onboarding → zero-tap cold open → three-answer loop → real route break → return → replay was exercised.

## Regression Contract

- `shouldAutoRouteExplorePath(0, 2) === true`
- No route heading or route card before the first cold-open problem
- First attempt remains `steps=0` and attempt number 1
- A real route break exposes at least two choices after three answers
- Replay creates a different `runId` and reaches a first problem without a fake route choice

---
name: sansu-art-direction-loop
description: Generate, select, implement, and audit Sansu exploration art without losing benchmark appeal, silent causality, child safety, or answer tempo. Use for image generation, encounter art, visual redesigns, generated-concept-to-runtime work, and production visual gating.
---

# Sansu Art Direction Loop

Use this skill when an image-led Sansu experience must become playable UI. Treat “safe and explainable” and “I want to enter this world” as separate requirements; neither can compensate for the other.

## Read First

1. `CONSTITUTION.md`
2. `docs/product/01_app_spec.md`
3. `docs/product/07_ui_design_guideline.md`
4. `docs/product/design_review_checklist.md`
5. `docs/product/14_ui_world_motion_spec.md`
6. `docs/product/15_mvp_rollout_verification_spec.md`
7. `design-system/MASTER.md`
8. The latest benchmark images and actual runtime screenshots

Read [references/value-gate.md](references/value-gate.md) when scoring a candidate or preparing a silent test.

## Non-compensating Gates

Keep three verdicts. Never average them into one release score.

1. **Visual magnetism:** score the six visual axes in the reference. A candidate must meet or exceed the current approved benchmark and score at least 8/10 on every axis before full implementation.
2. **Silent causality and safety:** without copy or explanation, at least 4 of 5 observers must describe the same action and payoff. Any pain, restraint, severing, floating-body, tongue, weapon, or fear interpretation is a HOLD.
3. **Runtime integrity:** preserve the complete TenKey, including the visible `1 / 2 / 3` row and physical `0-9` input, additional-zero-tap progression, retry timing, responsive crop, reduced motion, accessibility, asset budgets, and PWA behavior.

For the current cold-open, runtime PASS means correct-answer-to-next-input P95 at or below 650ms, incorrect-answer-to-retry P95 at or below 550ms, zero additional taps between ordinary questions, zero answer leaks, no required acting or causality cue hidden by the answer shelf, fixed-question throughput at least equal to the approved fast baseline, and passing mobile/tablet, keyboard/touch, reduced-motion, asset-budget, and PWA checks. If the governing spec changes these thresholds, follow the spec.

Passing one gate never offsets failing another.

## Workflow

### 0. Freeze the interaction contract

- Record the unchanged input, correct-answer, incorrect-answer, and next-problem timings.
- Record the unchanged key layout and the same fixed-question throughput baseline; a timing pass does not excuse a missing key, blocked control, or slower total problem rate.
- Record the delivery or feature-flag ID separately from the visual candidate ID. Reusing an experiment slot never carries visual approval from an older candidate into a replacement.
- Record the app target, build revision, cache/update state, and expected runtime candidate attribute before capturing evidence. A source file or local flag change is not proof that the app the user opens changed.
- Keep the existing problem generator and TenKey outside the art rewrite unless the task explicitly changes them.
- Define the exact viewport and art crop used for comparison.

### 1. Decompose the benchmark

Create a `TRANSFER / DO NOT TRANSFER` table before prompting or coding.

- Transfer concrete visual properties: color masses, material-specific texture, scale contrast, depth layers, gaze, grounding, and physical comedy.
- Do not transfer ambiguous body contact, unsafe mechanics, drifting character proportions, embedded UI text, trademarks, or incidental generation defects.
- Avoid abstract direction such as “more magical” unless it is translated into visible properties.

### 2. Lock the story sentence

Use one familiar verb, one target, three readable changes, and one physical payoff.

Example: `dig the same soil -> the same root rises -> its feet appear -> it pops out and a soft soil clump becomes a silly hat`.

If the action needs a proper noun, lore paragraph, or badge to become understandable, change the action rather than adding explanation.

### 3. Generate before implementing

- Create at least three direction candidates at the actual runtime crop when the direction is still unresolved.
- Show the entire state sequence in one fixed camera first. Select a winner before producing full-resolution frames.
- Use the winner as the identity, palette, texture, scale, horizon, and camera anchor for every later generation.
- Do not generate each state independently from zero.

### 4. Gate the source art

- Compare the candidate beside the approved benchmark, not only beside the previous failed candidate.
- Test at full size, the real mobile crop, and a 64 px silhouette.
- Reject a candidate that is safe but visually generic, flat, decorative, or worksheet-like.
- Reject a candidate that is attractive but ambiguous, unsafe, or causally disconnected.
- Reject generated-looking sameness: drifting faces or props, one texture over every material, centered/symmetric concept-board staging, interchangeable large-eyed mascots, random decorative symbols, or artifacts whose only defense is the prompt's intent. Preserve an overlay or pixel-diff of nominally fixed regions when continuity matters.

After two visual iterations below the benchmark, change the main verb, silhouette, composition, or rendering method. Do not keep adding particles, copy, badges, or glow.

### 5. Protect the art during implementation

- List the visual invariants that must survive implementation.
- For painterly scenes, author with reusable layers or locked references but deliver flattened state frames when flattening best preserves texture and seams.
- Keep UI copy, math, progress, and controls in DOM; do not bake them into generated art.
- Define the answer-shelf safe zone at every canonical viewport. Keep faces, the acting hand or tool tip, the subject's grounding or revealed feet, and the payoff prop above the shelf fade in every state.
- Implement `ready` and `payoff` first. Capture them inside the real problem panel before building all intermediate states.

If runtime loses depth, texture, scale contrast, or character acting twice in a row, change the rendering architecture. Do not defend a flat SVG decomposition merely because it is technically clean.

### 6. Verify runtime parity

- Capture every state at the canonical mobile and tablet widths.
- Capture a critical-path contact sheet from actual launch through the cold-open and its next meaningful destination. Do not mix rejected, HOLD, legacy, or unrelated visual lineages inside one child-facing flow; intentional world, observation, archive, and utility mode changes must remain documented and coherent.
- Compare source and runtime at the same viewport and crop.
- Re-score visual magnetism using runtime screenshots only.
- Confirm the rendered candidate ID, delivery flag, build revision, and cold-cache/PWA-update result on the same target used for the screenshots.
- Run correct, incorrect, reduced-motion, sound-off, keyboard, touch, responsive, PWA, and asset-budget checks.
- Run `npm run benchmark:fixed-ten` for runtime throughput parity. Fewer than 10 repetitions or fewer than 20 incorrect samples per lane is diagnostic only. Use all-correct for the parity decision, report the semantically different Study and Explore miss flows separately, and never present the fixed fixture as planner-authenticity evidence.

### 7. Run a blind silent test

- Hide copy, state names, intended story, and implementation notes.
- Ask only the questions in the reference and record answers verbatim.
- Do not count the author, implementing agent, or anyone shown the intended explanation as independent evidence.
- Keep production on the rollback default until all three gates pass.

## Evidence Rules

Use this order of authority:

1. Latest real runtime screenshot at a named viewport
2. Runtime recording or interaction trace
3. Composited UI mock at the real crop
4. Source illustration or direction board
5. Prompt, specification, ARIA text, or automated assertion

Attach candidate ID, viewport, evidence type, date, and confidence to every score. A source-image score must never be reported as a runtime score.

Store durable evidence under `docs/design/` and use absolute paths when showing it remotely.

## Stop Conditions

- Stop and redesign when the image requires explanatory copy to remove fear or bodily ambiguity.
- Stop and change rendering method when modularization removes the benchmark's material richness.
- Stop and regenerate when characters, camera, scale, or palette drift between frames.
- Stop when the real answer shelf or its fade hides a face, acting hand or tool tip, subject grounding or revealed feet, or the payoff prop at any canonical viewport. Reframe the art; copy and ARIA do not repair a hidden visual cause.
- Stop when the actual app target does not expose the intended build and visual candidate, or when a whole-flow contact sheet reveals old and new visual lineages mixed together. Do not report a mock, source asset, or local-only flag as an app change.
- Stop release when silent comprehension is below 4/5 or any observer reports a danger interpretation.
- Never call a HOLD candidate production-ready because tests, tempo, or maintainability passed.

---
name: sansu-ui-builder
description: Build or restyle Sansu screens and components with game-forward exploration, calm readable baselines, short high-energy peaks, and child-safe failure. Use for new UI, layout changes, component redesigns, responsive fixes, or UX polish.
---

# Sansu UI Builder

Use this skill when the task changes how Sansu looks, feels, or is navigated.

## Read First

1. `CONSTITUTION.md`
2. `docs/product/01_app_spec.md`
3. `docs/product/07_ui_design_guideline.md`
4. `docs/product/design_review_checklist.md`
5. `docs/product/14_ui_world_motion_spec.md`
6. `design-system/MASTER.md`
7. The target screen or component

For image-led exploration UI, also read `.agents/skills/sansu-art-direction-loop/SKILL.md` and `.agents/skills/sansu-art-direction-loop/references/value-gate.md` before implementation.

## Goals

- Make Sansu feel like a game children choose to replay, not a worksheet with decoration
- Keep calm, readable valleys and make meaningful discoveries or turning points feel vivid
- Preserve one-screen-one-purpose clarity while making in-run choices meaningful
- Reuse shared tokens and surfaces instead of page-local styling
- Ship UI that still feels intentional on mobile first, then tablet/desktop

## Required Rules

- Keep utility surfaces low-saturation and high-brightness. Keep exploration live worlds in their approved opaque color masses and material palette; allow short, stronger color, sound, glow, or motion at earned peaks
- Never turn a wrong answer, skip, low result, or temporary game loss into shame or ability judgment
- Keep game failure brief, understandable, recoverable, and quick to retry
- Avoid continuous loudness, social-ranking pressure, blinking, long forced sequences, and dark fear as the core fantasy
- Use `src/index.css` tokens and shared surface utilities before inventing new local values
- Keep one current objective or primary action clear; present route, return, or resource choices when they are meaningful
- Never show a route, teaser, or destination choice before a fixed presentation that ignores it. Auto-route fixed openings, and expose a choice only when the next visible node, action, or encounter honors the selection
- Ensure tap targets, contrast, focus visibility, and loading/error states stay usable
- Do not rely on color, motion, or sound alone to communicate state
- Respect reduced motion and keep the full flow understandable with sound off

## Working Flow

1. Identify the screen's primary purpose, current game action, and meaningful choice
2. Identify the approved visual candidate and every screen on the child-facing critical path; remove or deliberately isolate legacy/HOLD candidates instead of mixing render languages
3. When approved visual references exist, list the color masses, texture, scale contrast, depth, gaze, and physical acting that implementation must preserve
4. Identify its calm baseline and any earned peak moment; do not make every moment a peak
5. Check whether the change belongs in shared tokens/components before page-local CSS
6. Map the design to existing tokens and surfaces from `src/index.css`
7. Make action and world reaction visibly connected
8. Implement and compare the real `ready` and `payoff` states before expanding to all intermediate states
9. Change rendering architecture when layer splitting or reuse flattens an approved image's material richness; technical modularity does not excuse visual regression
10. Keep copy adventurous when useful, but child-safe and non-judgmental
11. Verify mobile density first, then larger layouts
12. Verify the complete `789 / 456 / 123 / 0` TenKey, physical `0-9` input, motion, reduced-motion fallback, sound-off comprehension, retry tempo, and fixed-question throughput
13. Capture the actual app target from launch through the next destination with build, flag, candidate ID, and cache/update state; source assets and local mocks do not close the change

## Output Expectations

When proposing or implementing a UI change, make sure you can explain:

- Main action on the screen
- Shared tokens/components reused
- Calm-baseline and high-energy-peak decisions
- Child-safety, failure, and information-hierarchy decisions
- Manual checks needed on affected layouts, states, sound-off, and reduced motion

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `npm run build`

For meaningful UI changes, also do a manual flow check on the affected screen states, including any game failure/retry path, sound off, and reduced motion.

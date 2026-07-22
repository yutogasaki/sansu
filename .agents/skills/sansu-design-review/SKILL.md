---
name: sansu-design-review
description: Review Sansu UI changes for replay appeal, calm-to-peak rhythm, child-safe failure, information hierarchy, accessibility, and design-system consistency. Use for UI review, screenshot review, or visual QA.
---

# Sansu Design Review

## Read First

1. `CONSTITUTION.md`
2. `docs/product/01_app_spec.md`
3. `docs/product/07_ui_design_guideline.md`
4. `docs/product/design_review_checklist.md`
5. `docs/product/14_ui_world_motion_spec.md`
6. `design-system/MASTER.md`
7. The target UI or diff

For image-led exploration review, also read `.agents/skills/sansu-art-direction-loop/SKILL.md` and `.agents/skills/sansu-art-direction-loop/references/value-gate.md` before scoring or issuing a release verdict. Missing required evidence is a HOLD, not an invitation to infer a pass.

## Review Areas

- Visual magnetism: desire to enter the world, character attachment, material touch, depth, focal color, and anticipation/payoff
- Game feel: action/reaction clarity, replay appeal, meaningful choices, and satisfying discoveries
- Choice honesty: every route, teaser, or destination choice visibly changes the following node, action, or encounter; a fixed opening must not masquerade as a branch
- Tone: calm readable baseline, vivid short peaks, no shame or ability judgment
- Failure: brief, understandable, recoverable, and inviting to retry
- Information design: one current objective, clear hierarchy, legible choices
- Visual system: shared tokens/components and intentional baseline/peak accents
- Whole-app continuity: one approved visual lineage across the child-facing critical path, with intentional mode changes and no legacy/HOLD mixture
- Motion and sound: meaningful cause/effect, no continuous attention capture, sound-off and reduced-motion equivalents
- Accessibility: contrast, tap targets, focus states, and multimodal state cues
- Maintainability: avoid one-off CSS and duplicated patterns

## Output Format

## Design Review Report

### Summary
- Visual magnetism: score / 60, candidate ID, viewport, evidence type
- Silent comprehension and safety: GO / HOLD / REJECT
- Runtime integrity: GO / HOLD / REJECT
- Whole-app continuity: GO / HOLD / REJECT
- Delivery truth: actual target, build revision, delivery flag, rendered candidate ID, cache/update state
- Tone alignment: OK / Attention / NG
- Game feel: OK / Attention / NG
- Failure safety: OK / Attention / NG
- Information design: OK / Attention / NG
- Accessibility: OK / Attention / NG
- Maintainability: OK / Attention / NG

### Findings
1. Finding
   - Evidence:
   - Impact:
   - Suggested change:

### Verification
- Manual checks
- Device or layout checks

## Rules

- Do not critique based on personal taste alone
- Tie every finding to repo design rules or UX impact
- Prefer the latest named-viewport runtime screenshot over prompts, source art, mockups, specifications, ARIA text, or automated assertions
- For release review, require an actual-target contact sheet from launch through the changed experience and its next destination; a single polished screen cannot prove whole-app continuity
- Never average visual magnetism, silent comprehension/safety, and runtime integrity into one compensating release score
- Attach candidate ID, viewport, evidence type, and confidence to every numeric score
- Do not treat an author or implementing agent who knows the intended story as independent silent-comprehension evidence
- Flag both continuous over-stimulation and overly muted UI that removes meaningful game feedback
- Do not reject bounce, zoom, saturation, sound, or celebration categorically; judge whether it is brief, earned, accessible, and safe

---
name: sansu-design-review
description: Review Sansu UI changes for calm tone, information hierarchy, accessibility, motion restraint, and design-system consistency. Use for UI review, screenshot review, or visual QA.
---

# Sansu Design Review

## Read First

1. `CONSTITUTION.md`
2. `docs/01_app_spec.md`
3. `docs/07_ui_design_guideline.md`
4. `docs/design_review_checklist.md`
5. `design-system/MASTER.md`
6. The target UI or diff

## Review Areas

- Tone: calm, gentle, non-competitive
- Information design: one primary action, clear hierarchy
- Visual system: shared tokens/components, restrained accent usage
- Motion: comprehension-first, no attention-seeking effects
- Accessibility: contrast, tap targets, focus states
- Maintainability: avoid one-off CSS and duplicated patterns

## Output Format

## Design Review Report

### Summary
- Tone alignment: OK / Attention / NG
- Information design: OK / Attention / NG
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
- Flag over-styled changes even if they look polished

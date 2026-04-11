---
name: sansu-ui-builder
description: Build or restyle screens and components for Sansu while preserving the repo's calm child-friendly design system. Use for new UI, layout changes, component redesigns, responsive fixes, or UX polish.
---

# Sansu UI Builder

Use this skill when the task changes how Sansu looks, feels, or is navigated.

## Read First

1. `CONSTITUTION.md`
2. `docs/01_app_spec.md`
3. `docs/07_ui_design_guideline.md`
4. `docs/design_review_checklist.md`
5. `design-system/MASTER.md`
6. The target screen or component

## Goals

- Keep Sansu calm, gentle, and trustworthy for children and parents
- Preserve one-screen-one-purpose clarity
- Reuse shared tokens and surfaces instead of page-local styling
- Ship UI that still feels intentional on mobile first, then tablet/desktop

## Required Rules

- Avoid loud gamification, score pressure, and flashy motion
- Prefer low-saturation, high-brightness surfaces and restrained accents
- Use `src/index.css` tokens and shared surface utilities before inventing new local values
- Keep one primary action per screen
- Ensure tap targets, contrast, focus visibility, and loading/error states stay usable
- If visual emphasis is needed, prefer spacing, grouping, hierarchy, and copy over stronger colors

## Working Flow

1. Identify the screen's single primary purpose
2. Check whether the change belongs in shared tokens/components before page-local CSS
3. Map the design to existing tokens and surfaces from `src/index.css`
4. Keep copy aligned with calm child-safe tone
5. Verify mobile density first, then larger layouts
6. Review motion and remove anything decorative-only

## Output Expectations

When proposing or implementing a UI change, make sure you can explain:

- Main action on the screen
- Shared tokens/components reused
- Tone and information hierarchy decisions
- Manual checks needed on affected layouts or states

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `npm run build`

For meaningful UI changes, also do a manual flow check on the affected screen states.

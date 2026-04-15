# Design Review Checklist

## Purpose

Use this checklist when reviewing UI changes for tone, consistency, and maintainability.
This is a review aid, not the primary design spec.

## Source Docs

- [/CONSTITUTION.md](/CONSTITUTION.md)
- [01_app_spec.md](01_app_spec.md)
- [07_ui_design_guideline.md](07_ui_design_guideline.md)
- [tasks/design-refresh-status.md](/docs/tasks/design-refresh-status.md)

## Checklist

### Tone

- Does the screen still feel calm and gentle?
- Does it avoid score-pressure, competition, or loud celebration?
- Is the wording safe for children and clear for parents?

### Information Design

- Is there one main action?
- Is the priority of information obvious at a glance?
- Did the change reduce or increase user hesitation?

### Visual System

- Are shared tokens/components used instead of page-local styling?
- Are accent colors limited and meaningful?
- Is density comfortable on both mobile and tablet?

### Motion

- Does motion help comprehension instead of drawing attention to itself?
- Are there any bounce, blinking, or exaggerated scale effects?

### Accessibility

- Is contrast acceptable?
- Are tap targets large enough?
- Is focus state visible where keyboard or assistive interaction matters?

### Regression / Maintainability

- Would this be easy to keep consistent on other screens?
- Did the change create one-off CSS or duplicate UI patterns?
- Should the shared design docs be updated?

## Output Expectation

If you review a UI change, summarize:

- What is aligned
- What is off-tone
- What should be commonized
- What needs manual device verification

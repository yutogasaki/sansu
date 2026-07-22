# Design Review Checklist

## Purpose

Use this checklist when reviewing UI changes for tone, consistency, and maintainability.
This is a review aid, not the primary design spec.

## Source Docs

- [/CONSTITUTION.md](/CONSTITUTION.md)
- [01_app_spec.md](01_app_spec.md)
- [07_ui_design_guideline.md](07_ui_design_guideline.md)
- [14_ui_world_motion_spec.md](14_ui_world_motion_spec.md)
- [tasks/design-refresh-status.md](/docs/tasks/design-refresh-status.md)

## Checklist

### Tone

- Does the screen make the next play, discovery, or meaningful choice inviting?
- Is the baseline readable and alive, with a clear main cause and limited competing motion rather than a muted, expressionless waiting state?
- Is the ordinary pre-success frame already appealing enough to touch, with meaningful peaks strengthening only the relevant 2–3 visual axes?
- Does it avoid shame, ability judgment, social comparison, and pressure even when game consequences are shown?
- Is failure brief, understandable, recoverable, and inviting to retry?
- Is the world adventurous without making fear, defeat, or enemy destruction its core?
- Is the wording safe for children and clear for parents?

### Information Design

- Is there one clear current objective or main action?
- Is the priority of information obvious at a glance?
- Are meaningful choices legible without adding setup choices or explanatory friction?
- Can the child understand what changed in the world after an action?

### Visual System

- Are shared tokens/components used instead of page-local styling?
- Is the screen using the correct mode: Utility glass, opaque live world, same-camera observation, or paper archive?
- In a live encounter, is color intentionally biased toward one dominant family rather than evenly distributing every theme color?
- Do world visuals support navigation, action feedback, discovery, or story rather than obscure the task?
- In a live encounter, can one actor, one subject, one math verb, the subject's return, and the actor's counter-pose be identified within three seconds?
- Does strangeness come from a specific silhouette and behavior rather than darkness, mystery icons, or generic glow?
- Can the actor and subject be distinguished at 64px in black silhouette, with at least one intentionally extreme proportion?
- Are live actors at least 116px high and the main subject at least 140px high or 150px wide at 390×844, with 72px of clear action space?
- Is the pop budget limited to at most three heightened axes among color, form, scale, expression, material, density, and motion?
- Do world, observation, and archive use distinct materials instead of one uniform paper filter or equal-card layout?
- Is the first discovery line a bodily, sensory, sonic, or physical fact, with progress language shown second?
- Is the live stage full-width and free of dark framing, glass cards, a global paper overlay, and evenly scattered decoration?
- At every canonical viewport, do faces, the acting hand or tool tip, subject grounding or revealed feet, and the payoff prop remain above the answer-shelf fade?
- Has the actor passed silhouette and multi-pose continuity review rather than relying on a one-off generated image?
- Is density intentionally uneven, with a readable low-density action corridor and one localized detail peak on both mobile and tablet?

### Motion

- Does motion communicate cause and effect or make a meaningful peak satisfying?
- Is `ready → anticipation → contact → reaction → settle` readable, short, and interruptible where needed, with the result held long enough to understand?
- Is the screen free of blinking, continuous attention grabbing, and meaningless repeated bounce/scale effects?
- Does reduced motion preserve state meaning and the next action?

### Sound

- Does sound reinforce action or discovery without carrying essential information alone?
- Are failure sounds brief and non-judgmental?
- Does the experience remain complete with sound off?

### Accessibility

- Is contrast acceptable?
- Are tap targets large enough?
- Is focus state visible where keyboard or assistive interaction matters?
- Are success, danger, and failure understandable without relying on color, motion, or sound alone?

### Regression / Maintainability

- Would this be easy to keep consistent on other screens?
- Does an actual-target contact sheet cover launch, the changed experience, and its next meaningful destination without mixing rejected, HOLD, legacy, or unrelated visual lineages?
- Are build revision, delivery flag, rendered candidate ID, and cache/update state recorded so the reviewed screen is the one users open?
- For arithmetic input, are `789 / 456 / 123 / 0`, clear, backspace, and confirm all visible and reachable without art or celebration covering them?
- Did the change create one-off CSS or duplicate UI patterns?
- Should the shared design docs be updated?

## Output Expectation

If you review a UI change, summarize:

- What is aligned
- What is off-tone or weakens game feel
- Whether the baseline/peak rhythm is appropriate
- What should be commonized
- What needs manual device, sound-off, or reduced-motion verification

# Sansu Design System Master

## Status

This file is an AI-facing design brief for implementation work.
It is derived from the real SSOT docs:

1. `docs/product/07_ui_design_guideline.md`
2. `docs/product/design_review_checklist.md`
3. `src/index.css`

If a design rule changes, update the SSOT docs first and then refresh this file.

## Product Profile

- Product: child learning PWA for math and English
- Core audience: children using the app directly, with parents observing and managing
- Experience goal: calm daily learning, not event-like excitement
- Primary emotional target: safe, quiet, steady progress

## Design Intent

- Gentle, quiet, and sustainable
- Clear enough for parents, soft enough for children
- More like a calm study companion than a game
- Motion and glow are allowed only as atmosphere, never as the main attraction

## Hard Constraints

- No loud gamification
- No high-saturation primary palette
- No score-pressure, ranking, or competitive framing
- No flashy celebration patterns
- No bounce, blinking, or aggressive scale effects
- No raw one-off styling when shared tokens or utilities can solve it

## Preferred Visual Pattern

- Single clear primary action per screen
- Low-density layouts with visible breathing room
- Soft layered backgrounds with restrained depth
- White or off-white semi-transparent surfaces over a calm gradient field
- Mild glass surfaces are acceptable when readability stays strong

## Color System

Use existing tokens first.

### Base Background

- `--theme-bg-1`: `#ffe5d9`
- `--theme-bg-2`: `#fff5f0`
- `--theme-bg-3`: `#e8f8f0`
- `--theme-bg-4`: `#d4f0e7`

These may drift by theme, but the look should stay low-saturation and bright.

### Accent

- `--app-accent`: `#2bbaa0`
- `--app-accent-strong`: `#24a08a`

Accent color is for emphasis and CTA support, not for emotional reward scoring.

### Text

- Primary text: `--color-dark` = `#2d3436`
- Secondary text: `--color-gray-500` = `#8395a7`

Avoid pure black.

### Surface Tokens

- `--app-surface`: `rgba(255, 255, 255, 0.72)`
- `--app-surface-strong`: `rgba(255, 255, 255, 0.92)`
- `--app-surface-soft`: `rgba(255, 255, 255, 0.56)`
- `--app-border`: `rgba(255, 255, 255, 0.5)`
- `--app-border-soft`: `rgba(255, 255, 255, 0.3)`

Use `app-glass`, `app-glass-strong`, `glass-light`, `card-surface`, and `app-pill` before creating local surface recipes.

## Typography

- Heading font: `Outfit` with `Noto Sans JP` fallback
- Body font: `Noto Sans JP`
- Tone: readable first, child-friendly without becoming babyish
- Body copy should stay short, calm, and lightly spaced
- Do not overuse bold or exclamation marks

## Layout Rules

- Mobile first
- One screen should usually hold one main decision and one secondary escape route
- Use space to create calm and meaning
- Avoid information-dense panels unless the screen genuinely needs them
- Keep the main container feeling comfortable at phone width first

## Components

### Primary Button

- Accent-led
- Clear size hierarchy, not aggressive depth
- Mild gradient or soft shadow is acceptable
- Press feedback should be small and quick

### Secondary Action

- Quiet visual weight
- Outline, text-only, or very soft surface treatment
- Present, but not competing with the primary action

### Cards

- Soft radius
- Border plus quiet shadow
- Prefer calm surface separation over heavy elevation

### Icons

- Rounded line icons
- Limited fill
- Avoid emoji-style iconography

## Motion

- Purpose: support comprehension, not excitement
- Allowed: fade, soft slide, tiny press response, slow atmospheric drift
- Timing: usually subtle and short
- Banned: bounce, blink, confetti-like celebration, repeated attention grabbing
- Respect reduced-motion expectations whenever motion meaning is not essential

## Copy And Interaction

- Gentle, non-judgmental, non-rushing
- One message should carry one intention
- Error states should explain the next safe action
- Success states should feel warm but restrained
- Parent clarity should never come at the cost of child safety or shame

## Accessibility And QA

- Keep tap targets comfortably touchable
- Ensure contrast is readable against soft surfaces
- Keep focus states visible when relevant
- Test the affected screen in loading, empty, success, and error states
- Verify mobile density before polishing larger layouts

## Anti-Patterns

- Bright neon or purple-heavy AI-looking gradients
- Sports, battle, or win/lose framing
- Giant hero animation for routine actions
- Red/green as the main meaning carrier
- Page-local hardcoded shadows, borders, and glass recipes
- Visually “premium” decisions that reduce calmness or readability

## Retrieval Rule

- `design-system/MASTER.md` is the default design brief
- `design-system/pages/*.md` may define page-specific overrides
- Page files should store only deviations from this master, not a rewritten full design system

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
- Experience goal: a math game children choose to replay, built around exploration, discovery, and meaningful decisions
- Primary emotional target: bright curiosity, safe suspense, satisfying discovery, and willingness to retry

## Design Intent

- Fun first without sacrificing child safety, learning integrity, or parent trust
- Readable, alive valleys punctuated by short, meaningful peaks; calm means one clear cause and limited competition, not muted color or an expressionless world
- Math actions should visibly move the world: digging, building, opening, discovering, and returning
- Game failure may create a brief, recoverable in-run consequence; it must never become shame or ability judgment
- Motion, color, sound, and glow may become the main attraction at a genuine discovery or turning point, then quickly settle

## Hard Constraints

- No continuous loudness, high saturation, or attention-seeking motion
- No shame, ability judgment, coercive score pressure, or social-ranking framing
- No blinking, long unskippable celebration, or repeated motion that blocks play
- No fear, death, enemy destruction, or collapse at zero health as the core fantasy
- No color-, motion-, or sound-only communication of important state
- No raw one-off styling when shared tokens or utilities can solve it

## Preferred Visual Pattern

- One clear current objective, with meaningful in-run choices shown when they matter
- Low-density layouts with visible breathing room
- Utility / parent / settings: soft layered backgrounds and white or off-white semi-transparent surfaces; mild glass is acceptable when readability stays strong
- Live world: opaque dominant color fields, extreme subject silhouettes, and visible actor-to-subject causality; glass and global desaturation are not allowed inside the stage
- Observation: keep the live camera and actor colors, adding pencil memory only to changed parts
- Archive: paper becomes the main material, with one large result and unequal smaller causal vignettes
- Peaks heighten at most three axes among color, form, scale, expression, material, density, and motion; ordinary live frames remain appealing before success

## Color System

Use existing tokens first.

### Base Background

- `--theme-bg-1`: `#ffe5d9`
- `--theme-bg-2`: `#fff5f0`
- `--theme-bg-3`: `#e8f8f0`
- `--theme-bg-4`: `#d4f0e7`

These may drift by theme. They govern Utility / parent / settings surfaces, not the live exploration field. Live habitats choose an opaque dominant color family per encounter.

### Accent

- `--app-accent`: `#2bbaa0`
- `--app-accent-strong`: `#24a08a`

Accent color is for Utility emphasis and CTA support. It does not constrain world art to one theme accent. Reused world colors should have semantic roles and must not encode ability or worth.

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

Use `app-glass`, `app-glass-strong`, `glass-light`, `card-surface`, and `app-pill` on Utility surfaces before creating local recipes. Do not use them inside a live exploration stage. The answering shelf may use one opaque shared surface.

### Exploration Tokens

The following tokens exist for current exploration surfaces, but they are role tokens rather than a palette that must appear together:

- `--explore-outline`: the single deep-teal ink line
- `--explore-cave-deep`, `--explore-cave-mid`: depth edges and dark-habitat layers only; not a default live-world frame
- `--explore-turquoise`: current page and discovered connections
- `--explore-moss`: ground and growth when the encounter calls for it
- `--explore-parchment`, `--explore-cream`, `--explore-paper-edge`: paper, highlights, and physical page depth
- `--explore-amber`: the one primary physical action or a brief earned light peak
- `--explore-coral`: a completed discovery or stamp

Do not distribute these colors evenly. A live frame starts from `dominant family 55–70% / secondary family 20–30% / opposing focus 3–8% / neutral rest`; use at most three hue families. `--explore-world-stroke` is for annotation and interface marks, not a uniform outline around every actor and background object. Use `--explore-press-depth` and `--explore-peak-duration` for tactile controls and short peaks.

## Typography

- Heading font: `Outfit` with `Noto Sans JP` fallback
- Body font: `Noto Sans JP`
- Tone: readable first, child-friendly without becoming babyish
- Body copy should stay short, calm, and lightly spaced
- Do not overuse bold or exclamation marks

## Layout Rules

- Mobile first
- One screen should communicate one current objective; a route, return, or resource choice may offer multiple meaningful options
- Use space to create calm, meaning, and a readable game state
- Avoid information-dense panels unless the screen genuinely needs them
- Keep the main container feeling comfortable at phone width first

## Components

### Primary Button

- Accent-led
- Clear size hierarchy; normal-state depth remains restrained
- Mild gradient or soft shadow is the baseline
- Dig, place, open, and commit actions may use stronger but brief tactile feedback

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

## World And Illustration

- Prefer a bright underground wonderland: crystals, glowing plants, underground lakes, flowers, fossils, star sand, root tunnels, small bridges, an exploration base, creatures, and secret maps
- Illustration should clarify direction, action results, discoveries, companion reactions, or the run's story
- Avoid zombies, skeletons, graves, blood, poison, dark fear staging, and combat-as-core imagery
- Never let scenery reduce problem, input, focus, or next-action readability

### Live Encounter: Ibitsu Ecology Pop / いびつ生態ポップ

- `docs/product/14_ui_world_motion_spec.md` is the exploration visual authority. The benchmark in `docs/design/research-library-2026-07-19/benchmark-yoshi-fukashigi.md` is evidence and rationale; v2 and v3 are rejected production-style targets
- Use one primary causal chain per scene: one lead actor, one subject, one math verb, the subject's unexpected return, and the actor's counter-pose. Background life and edge-cropped secondary creatures are allowed when they do not compete with that chain
- Keep the stage full-width and side-on, with at least 72px between actor and subject at 390×844. Deep teal is an outline, depth, or dark-habitat color rather than a default live-world frame
- Give each creature or plant one 64px black-silhouette hook, one proportion at least 2.5:1, one deliberately awkward feature, and one behavioral rule. Do not normalize every subject into a large-eyed cozy mascot
- Show `ready → anticipation → contact → reaction → settle` as separate moments. Do not put before, observation, and archive into one product screenshot
- Limit each frame's pop budget to three heightened axes. Do not maximize saturation, thick outline, glow, giant mouth, scale, particles, and decorative type at once
- Keep the actor and current subject in color during observation; add ink memory only to the changed parts and the immediately preceding action
- Archive the event as unequal causal vignettes with breathing room, not equal cards or a flowchart
- Character and creature art must come from approved, consistent pose/behavior sheets. DOM owns text and controls; authored visual assets own the main actors

### Research Library Return

- Treat the return as one physical sequence: the actual page completed in this run, then one real lever that starts another run, then supporting specimens and hints
- At phone width, the completed or current book is the large quiet focal object; amber is reserved for the 56px-or-larger primary lever
- Use the actual `researchPage`, `replayTeaser`, and restart action only. Do not invent shelves, collection percentages, persistent NEW states, or two route buttons before those data and actions exist
- Decorative page edges, doors, and forked trails may suggest a larger world only when they are unnamed, non-interactive, and hidden from assistive technology
- Keep labels and state in DOM/ARIA. SVG supplies cave, paper, route, discovery, and companion artwork only
- At 390×844, target the primary lever's bottom edge at or before 620px; preserve the DOM order `book → primary action → supporting information`
- Keep meaning-bearing scene copy at 12px or larger. Small kickers may not carry progress, consequence, or action meaning
- A decorative route hint must read as distant scenery: no button border, pressed depth, focus state, or pointer behavior
- The three-second hierarchy is `live companion → changed page subject → amber lever`; reserve the largest coral, turquoise, and amber areas for those roles
- Existing Research Library captures prove layout, data, DOM order, and accessibility only. They are not the visual-quality target; deep-teal framing, uniform cut-paper treatment, equal progress pills, and the small generic companion are scheduled for replacement

## Motion

- Baseline purpose: comprehension, orientation, and atmosphere
- Peak purpose: make a meaningful cause-and-effect moment satisfying and memorable
- Utility baseline allowed: fade, soft slide, tiny press response, and slow atmospheric drift
- Live-world baseline allowed: subject-specific gaze, weight shift, breathing, dangling, listening, or balance behavior that keeps the current cause readable
- Encounter reaction allowed: anticipation, contact, physical return, and settle; prepare the next problem while the reaction finishes
- Peak allowed: authored body comedy, a short local camera move, bridge wobble, companion recovery, and return-map animation
- Keep peaks short and return promptly to a readable resting state
- Banned: blink, long forced sequences, continuous multi-area motion, taunting defeat, and meaningless repeated bounce/scale
- Under reduced motion, preserve meaning with a fade, static state, shape change, or concise copy

## Sound

- Use short, friendly sound to reinforce actions, breakage, discovery, chains, and return
- Failure feedback should be brief and comic, never low, ominous, or scolding
- Sound must be optional; all state and navigation remain understandable with sound off

## Copy And Interaction

- Energetic when the adventure calls for it, while remaining non-judgmental and non-rushing
- One message should carry one intention
- Error states should explain the next safe action
- Success and discovery states may feel vivid and celebratory when brief and earned
- Game consequences may be named clearly, but never as evidence that the child is bad at math
- Parent clarity should never come at the cost of child safety or shame

## Accessibility And QA

- Keep tap targets comfortably touchable
- Ensure contrast is readable against soft surfaces
- Keep focus states visible when relevant
- Test the affected screen in loading, empty, success, and error states
- Verify mobile density before polishing larger layouts
- Verify sound-off and reduced-motion equivalents for game feedback
- Ensure success, danger, and failure are not communicated by color alone

## Anti-Patterns

- Bright neon or purple-heavy AI-looking gradients
- Uniform paper noise, outline weight, and detail density across every layer
- Triptych concept boards presented as gameplay screens
- Symmetric altar compositions filled with doors, tabs, question marks, and decorative symbols
- Interchangeable cozy mascots that only point at the interface
- Evenly balanced teal, cream, coral, amber, and moss across one screen
- Deep-teal framing, glass cards, or a global paper filter around a live encounter
- Progress-first discovery copy that says page, clue, saved, or complete before the physical fact
- Using darkness or a mystery icon in place of a creature's specific odd behavior
- A uniformly muted screen with no visible game response or discovery peak
- Social ranking, ability labels, or humiliating win/lose framing
- Giant hero animation for routine actions
- Dark horror, enemy defeat, or character collapse as the main fantasy
- Red/green as the main meaning carrier
- Page-local hardcoded shadows, borders, and glass recipes
- Visually “premium” decisions that reduce playability or readability

## Retrieval Rule

- `design-system/MASTER.md` is the default design brief
- `design-system/pages/*.md` may define page-specific overrides
- Page files should store only deviations from this master, not a rewritten full design system
- `docs/product/14_ui_world_motion_spec.md` governs exploration-world, motion, sound, companion, and failure details

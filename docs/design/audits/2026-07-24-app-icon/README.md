# Pokko App Icon v2 Audit

- Date: 2026-07-24
- Actual validation target: `http://127.0.0.1:5173/#/stats`
- Baseline revision: `d2317bc48d3ee79db15133547a0b6ac5b1faab42`
- Candidate ID: `pokko-icon-b2`
- Runtime locations: favicon, header mark, Apple touch icon, PWA any-purpose icon, PWA maskable icon

## Old Icon Failure

The old asset was a miniature scene containing Pokko, a root creature, a shovel, soil, and sky. At 32–40px it lost its face and primary silhouette, so it read as a tiny illustration rather than an app mark.

## Selected Contract

- One golden bean-shaped Pokko face
- One oversized diagonal green leaf hat
- One coral circle
- Thick deep-teal contour
- Warm cream full-bleed background
- No text, scene, prop, or secondary character

The selected regular icon remains identifiable at 32px. A separately generated maskable master keeps the same mark inside the central safe zone without an inset-square seam.

## Candidates

- Candidate A was characterful but used a generic expression.
- Candidate B had the strongest symbol but cropped the body.
- Candidate C was a clean glyph but lost the leaf-hat identity.
- The B2 iteration restored the complete bean body and safe margins; it is saved as `docs/design/brand/pokko-app-icon-v2-master.png`.
- `docs/design/brand/pokko-app-icon-v2-maskable-master.png`: selected maskable variant

## Generation Prompts

Built-in image generation was used in edit mode. The regular selected direction requested a complete yellow bean mascot, oversized diagonal leaf, coral circle, thick outline, minimal facial features, no text, and safe margins. The maskable pass preserved that exact symbol while scaling it into the central 72% safe zone and extending the cream background seamlessly to every edge.

## Gates

- Visual appeal at 32 / 40 / 64 / 180px: **GO**
- Generatedness: **GO for icon use**; large fields and a single silhouette survive reduction, with no miniature scene detail
- Runtime integrity: **GO**; all declared manifest and HTML icon sizes exist and pass the asset build
- Whole-app continuity: **GO**; the same mark is used by the browser favicon, records header, onboarding/brand surfaces, Apple touch icon, and PWA assets

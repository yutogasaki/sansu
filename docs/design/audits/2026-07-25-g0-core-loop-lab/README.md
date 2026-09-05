# G0 Core Loop Lab Audit — 2026-07-25

## Scope

This audit covers the development-only G0 whitebox at `/#/__dev/g0`.
It compares four core verbs without math, persistence, finished art, reward
screens, or production routing.

- Candidate ID: `g0-direct-stage-v1`
- Source revision: working tree on `47831f921aeeca137e58bc5606591732c8aa0bb3`
- Delivery: development-only lazy route
- Visual lineage: `g0-whitebox-v1`
- Seed: `audit-seed`
- Sound: off by default

Evaluator URL:

```text
http://127.0.0.1:5176/#/__dev/g0?variant=chain-excavation&seed=audit-seed
```

Participant URL:

```text
http://127.0.0.1:5176/#/__dev/g0?mode=participant&variant=chain-excavation&seed=audit-seed
```

`variant` accepts `chain-excavation`, `creature-experiment`,
`droplet-ricochet`, or `underground-craft`. Add `motion=reduce` to exercise
the reduced-motion presentation without changing the 360ms state timing.

## What was tested

- Each turn exposes two native buttons whose visible hit area is the physical
  stage object, not a separate choice card.
- One world tap is one accepted turn; three accepted turns resolve a payoff.
- A tap during reaction can buffer one next action without double advancing.
- Old reactions and duplicate action IDs cannot mutate a newer run.
- Switching comparison tabs during reaction does not freeze the inactive run.
- Replaying preserves completed evidence and starts a distinct run ID.
- Participant mode hides hypotheses, tabs, outcome copy, and metrics so the
  evaluator UI does not coach the child.
- The two target DOM positions remain stable when creature tools become
  fixtures, preserving focus. Payoff moves focus to replay.
- Reduced motion removes interpolation while preserving targets, outcome, and
  the same reaction timing.
- Sound toggles on and back off; sound remains off initially.
- The exit control returns to the normal app route.

## Captured paths

| Prototype | Input path | Outcome |
|---|---|---|
| Chain excavation | upper → lower → upper | `cross-burst` |
| Creature experiment | puff → press → high fixture | `hybrid:fixture-high` |
| Droplet ricochet | top → bottom → pin | `cross-pinball` |
| Underground craft | spring → spring → spring | `accordion-launch` |

All four paths reached payoff at turn 3 in both audited viewports.
Neither viewport had horizontal or vertical document overflow.

## Visual evidence

Order in each contact sheet:

```text
row 1: chain initial, chain payoff, creature initial, creature payoff
row 2: droplet initial, droplet payoff, craft initial, craft payoff
```

- [390 × 844 contact sheet](./contact-sheet-390.png)
- [768 × 1024 contact sheet](./contact-sheet-768.png)
- [Individual captures](./captures/)

The participant surface uses one shared sky/soil/coral treatment, a common
actor, large quiet fields, and persistent physical end states. It contains no
image assets, SVG illustration, gradients used as cinematic lighting, modal,
score, confetti, or full-screen result interruption.

## Non-compensating gate result

| Gate | Result | Evidence |
|---|---|---|
| Whitebox visual comparability | PASS | Shared palette, common actor and target affordance, no choice cards, both viewport sheets reviewed |
| Final visual appeal | HOLD | This is deliberately unfinished whitebox art and is not a production art candidate |
| Silent comprehension | HOLD | DOM semantics and physical state persistence pass; target-age observation with five children has not happened |
| Runtime integrity | PASS | Direct-tap state tests, browser interaction, viewport bounds, focus flow, reduced motion, and zero browser console errors |
| Fun / replay appeal | HOLD | Only child behavior can establish spontaneous replay and causal explanation |

No G0 result authorizes production promotion. The next decision is a
counterbalanced child session using participant mode. If fewer than 4/5
children voluntarily replay, explain the causal result, or continue after a
safe detour, change the verb or rule before making finished art.

# Dig Pop Painted v2 Runtime Audit

- Date: 2026-07-21
- Actual validation target: `http://127.0.0.1:5175/explore`
- Build revision: `2704ff3aa0e7+dirty`
- Delivery / feature-flag ID: `snap-root-v1`
- Rendered visual candidate ID: `dig-pop-painted-v2`
- Production default: `classic-v1`
- Cache / update evidence: fresh local dev process plus successful production build and PWA precache generation; this is not a production deployment

## Decision

| Gate | Verdict | Evidence |
|---|---|---|
| A — visual magnetism | **GO** | Eight real runtime screenshots score 52–53 / 60 and every visual axis is at least 8 / 10 |
| B — silent causality / safety | **HOLD** | Author screening is positive, but the required explanation-free five-observer test has not been run |
| C — runtime technical sub-gate | **GO** | Timings, zero-tap progression, complete TenKey, answer-leak, crop, regression, asset, and PWA checks pass |
| C — full runtime integrity | **HOLD** | The required old-fast-Study versus Explore fixed-ten-question throughput comparison is not recorded |
| Production | **HOLD** | A GO and the technical sub-gate do not compensate for missing B and throughput evidence; keep `classic-v1` |

The local validation app is intentionally different from production. A source edit, generated image, or passing local build is not evidence that the app users open has changed.

## Candidate lineage

`dig-pop-painted-v1` is historical source art, not the current runtime candidate. It scored **50 / 60, HOLD** because the background, characters, shovel, and camera drifted between independently generated states and the `dig-one → dig-two` change was weak.

`dig-pop-painted-v2` starts a new visual approval record. It uses one locked background, fixed character and prop references, and state-specific action overlays. Its story sentence is:

```text
dig the same soil -> the same root rises -> its feet appear ->
it pops out and a soft soil clump becomes a silly hat
```

The delivery slot remains `snap-root-v1`; reusing that flag does not transfer approval from any old braided-root, leaf-tug, or watering visual.

## Gate A — runtime visual evidence

| Viewport | ready | dig-one | dig-two | popped | Verdict |
|---|---:|---:|---:|---:|---|
| 390×844 | 52 | 53 | 52 | 53 | GO |
| 768×1024 | 52 | 53 | 53 | 53 | GO |

Every final frame has at least 8 / 10 on entering the world, character attachment, material touch, composition and depth, pop and focal color, and incident / payoff. The score uses runtime screenshots inside the real problem panel, not source masters.

### The gate caught a real regression

The first tablet `dig-two` runtime frame scored **50 / 60, HOLD**. The answer shelf hid both revealed feet and the shovel blade, so the image no longer proved “digging made the same root rise.” This was not repaired with copy.

| Evidence | World | Attachment | Material | Composition | Color | Incident / payoff | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| old tablet `dig-two` | 9 | 9 | 9 | 7 | 9 | 7 | 50 |
| reframed tablet `dig-two` | 9 | 9 | 9 | 8 | 9 | 9 | 53 |

Only the action overlay was moved upward; the locked background stayed fixed. Both feet, grounding points, the small character's pose, and the shovel blade now remain above the shelf fade. This failure is now a named HOLD condition in the repo-local art-direction skill and review checklist.

Runtime evidence:

- [390 ready](../../breakout-loop-2026-07-21/runtime-painted-v2-audit/390-ready.png)
- [390 dig one](../../breakout-loop-2026-07-21/runtime-painted-v2-audit/390-dig-one.png)
- [390 dig two](../../breakout-loop-2026-07-21/runtime-painted-v2-audit/390-dig-two.png)
- [390 popped](../../breakout-loop-2026-07-21/runtime-painted-v2-audit/390-popped.png)
- [768 ready](../../breakout-loop-2026-07-21/runtime-painted-v2-audit/768-ready.png)
- [768 dig one](../../breakout-loop-2026-07-21/runtime-painted-v2-audit/768-dig-one.png)
- [768 dig two — superseded HOLD](../../breakout-loop-2026-07-21/runtime-painted-v2-audit/768-dig-two-hold.png)
- [768 dig two — final](../../breakout-loop-2026-07-21/runtime-painted-v2-audit/768-dig-two.png)
- [768 popped](../../breakout-loop-2026-07-21/runtime-painted-v2-audit/768-popped.png)

Authoring evidence:

- [locked background](../../breakout-loop-2026-07-21/reference-art-pivot/locked-background-v2.png)
- [action sheet](../../breakout-loop-2026-07-21/reference-art-pivot/action-sheet-chroma-v2.png)
- [tablet-safe dig-two master](../../breakout-loop-2026-07-21/reference-art-pivot/dig-two-tablet-safe-zone-master-v2.png)

## Gate B — silent causality and safety

The author / implementation screening reads the four frames as “the small character digs; the same large root rises; its feet appear; it pops free; soft soil lands as a silly leaf-hat.” Both characters remain whole and grounded, there is no body or leaf pulling, and the shovel is used on soil rather than another body.

That screening is not independent evidence. Before production, show the copy-free four-state sequence to five people who have not seen the intended story and record answers verbatim. PASS requires:

- at least 4 / 5 name the same main verb and payoff;
- at least 4 / 5 want to continue or play;
- zero credible pain, restraint, severing, weapon, fear, trapped, or knocked-down interpretations.

Until then Gate B is HOLD.

## Gate C — runtime evidence

The local validation implementation preserves the existing problem generator, planner / writer / receipt boundary, and answer interaction.

| Check | Result |
|---|---|
| Correct answer to next operable input | 20 samples, range 111–125ms, P95 **124ms**; budget ≤650ms |
| Incorrect answer to same-problem retry | 20 samples, range 429–440ms, P95 **440ms**; budget ≤550ms |
| Delayed-support fallback | **531ms**, same problem, no late swap |
| Ordinary-question continuation | **0 additional taps** |
| Answer leak | **0** |
| Visible touch input | `789 / 456 / 123 / 0`, C, backspace, confirm |
| Physical input | `0-9`, Backspace, Delete, Enter |
| Viewport asset loading | exactly the four selected mobile or tablet frames, never all eight |
| Unit / integration | 76 files, **672 tests PASS** |
| Browser smoke | **22 scenarios PASS**, including 390px and tablet Snap Root, keyboard / TenKey, persistence failures, Explore routes, other encounters, and parent guard |
| Fresh full-smoke Snap Root sample | first incorrect **439ms**, delayed incorrect **532ms**, correct **115 / 129ms** |
| Lint / typecheck / build | PASS |
| PWA precache | **7.94 MiB / 12 MiB** |
| Explore artwork | **3.68 MiB / 8 MiB** |

This proves the timing and input sub-gate. It does not prove fixed-question throughput parity with the earlier fast Study flow. That same-ten-question comparison remains required, so Gate C as a whole is HOLD.

## Retrospective rules proven in this loop

1. A visual score cannot borrow points from tests, accessibility, or code quality.
2. A feature flag is not a visual candidate ID; approval never follows a reused slot.
3. Independently generating every state creates visible AI drift; lock camera, identities, props, and fixed regions.
4. A story that needs lore or labels is too abstract; keep one familiar verb, one target, three visible changes, and one physical payoff.
5. The real answer shelf is part of the composition. Any hidden face, acting hand / tool tip, grounding / revealed feet, or payoff prop is HOLD.
6. P95 alone does not prove the original rapid-question value; also compare fixed-question throughput and interruption count.
7. The reviewed artifact must identify the real target, revision, delivery flag, rendered candidate ID, and cache / update state.
8. Keep production on the rollback default until visual, silent, and runtime gates all pass independently.

## Remaining production blockers

1. Run and preserve the five-person blind silent test.
2. Compare the same fixed ten questions in old fast Study and current Explore; record answers per minute, correctness, post-correct wait, post-incorrect retry, and interruption count.
3. Capture the production candidate on the actual deploy target after a cold-cache or PWA update and verify the launch-to-next-destination contact sheet before changing the default.

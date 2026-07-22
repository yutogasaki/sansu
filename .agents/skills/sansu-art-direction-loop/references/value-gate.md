# Sansu Image-led Value Gate

## 1. Reference transfer table

| Area | TRANSFER | DO NOT TRANSFER |
|---|---|---|
| World | Concrete palette, depth layers, material contrast | Trademarks, copied characters, incidental artifacts |
| Characters | Silhouette, scale relationship, gaze, grounding, acting | Unsafe contact, disconnected bodies, pose drift |
| Story | Familiar action, same target, escalating physical response, readable payoff | Lore-dependent mechanics, unexplained badges, random spectacle |
| Runtime | Crop, focal hierarchy, texture, action/reaction | Text baked into images, blocking celebrations, hidden controls |

## 2. Visual magnetism score (60 points)

Score only the image shown. Do not include safety, tempo, accessibility, code quality, or learning correctness.

| Axis | 0-10 question |
|---|---|
| Enter the world | Does the frame create a place worth entering rather than a decorated exercise? |
| Character attachment | Are the characters specific, lovable, and relational rather than generic mascots? |
| Material touch | Do soil, leaves, sky, bodies, and props have distinct tactile surfaces? |
| Composition and depth | Are foreground, action plane, background, gaze, and negative space intentional? |
| Pop and focal color | Do large color masses feel joyful and guide attention immediately? |
| Incident and payoff | Does the still frame create anticipation, consequence, or a retellable joke? |

Current cold-open benchmark: user-approved picture-book references, **52/60**. Until the governing spec changes, require **52/60 or higher and no axis below 8** before full implementation.

### Generatedness and continuity screen

This screen is not a seventh score axis. It is a rejection check before the visual score can be trusted.

- Inspect the full sequence beside the benchmark, a 64px black silhouette, and an overlay or pixel-diff of regions meant to stay fixed.
- Reject frame-to-frame drift in faces, proportions, tools, camera, horizon, lighting, or background anchors.
- Reject one global texture across unrelated materials, interchangeable cozy mascots, centered concept-board symmetry, random icons, illegible pseudo-detail, and decorative spectacle without a physical cause.
- Record every visible artifact and either fix it or explain why it is an intentional authored feature. Prompt intent is not evidence.

## 3. Silent causality and safety gate

Show frames without UI copy or explanation. Ask each observer:

1. What happened?
2. What did the small character do?
3. What happened to the large character?
4. Did anything look painful, frightening, trapped, cut off, or confusing?
5. Would you like to see what happens next or play it?

Pass only when:

- at least 4 of 5 observers name the same main verb and payoff;
- zero observers report a credible danger interpretation;
- at least 4 of 5 want to continue.

Record answers verbatim. Author interpretation is screening evidence, not the final gate.

## 4. Runtime integrity gate

Record separately:

- correct-answer-to-next-input P95;
- incorrect-answer-to-retry P95;
- additional taps between ordinary questions;
- visible TenKey layout (`789 / 456 / 123 / 0`, clear, backspace, confirm) and physical `0-9` input;
- fixed-question throughput against the approved fast baseline;
- mobile and tablet crop results;
- answer-shelf safe-zone result for faces, acting hand/tool tip, subject grounding or revealed feet, and payoff prop;
- keyboard, touch, sound-off, and reduced-motion results;
- accessibility state labels;
- individual and total asset size;
- PWA precache result;
- regression command results.

For the current cold-open, PASS additionally requires:

- correct-answer-to-next-input P95 **650ms or less**;
- incorrect-answer-to-retry P95 **550ms or less**;
- **zero** additional taps between ordinary questions;
- **zero** answer leaks;
- every required digit remains visible, reachable, and unobscured at the canonical phone crop;
- faces, the acting hand or tool tip, subject grounding or revealed feet, and the payoff prop remain above the answer-shelf fade at every canonical viewport;
- fixed-question throughput does not fall below the approved fast baseline;
- passing 390×844 and 768×1024 crops, keyboard/touch, sound-off, reduced-motion, accessibility, asset-budget, PWA-precache, and required regression checks.

These are non-compensating release conditions, not score bonuses.

## 5. Audit manifest

```md
Visual candidate ID:
Delivery / feature-flag ID:
Actual app target:
Build revision:
Cache / update state:
Rendered candidate attribute:
Date:
Evidence type: source | mock | runtime screenshot | recording | observer test
Viewport:
Benchmark:

Visual magnetism: __ / 60
- Enter the world:
- Character attachment:
- Material touch:
- Composition and depth:
- Pop and focal color:
- Incident and payoff:

Silent test: __ / 5 understood; __ / 5 want more
Danger interpretations: __
Generatedness / continuity screen: PASS | HOLD | FAIL
Whole-flow contact sheet: path(s), mixed lineage count
TenKey / throughput: layout result, answers per minute, baseline delta
Runtime integrity: PASS | HOLD | FAIL
Verdict: GO | HOLD | REJECT
Remaining blockers:
```

## 6. Retrospective regression map

| Prior failure | Prevention rule | Required proof | HOLD when |
|---|---|---|---|
| “AIっぽい” | Specific silhouettes, distinct materials, locked identities and camera; no generic concept-board polish | Benchmark comparison, 64px silhouettes, four-state sheet, fixed-region overlay/diff, artifact log | Identity/prop/camera drifts, materials share one filter, or decoration has no physical cause |
| “頭でっかち” | One familiar verb, one target, three visible changes, one physical payoff; no lore or proper noun needed | Three-second verb/payoff read and blind answers verbatim | Explanation, badge, system name, or progress vocabulary is needed to understand the action |
| “意味不明” | Copy may confirm causality but never manufacture it | Blind 5-person silent test | Fewer than 4/5 agree on the same verb and payoff, or any credible danger reading appears |
| “サクサクを壊した” | Art reacts behind the unchanged answer loop; no ordinary-question CTA or blocking celebration | P95 timings, zero-tap trace, full `789/456/123/0` TenKey screenshot, fixed-question throughput | A required key disappears, input is covered, a tap is added, timing misses, or throughput falls |
| “混在世界観” | One approved visual lineage per child-facing critical path; mode changes are intentional and documented | Launch-to-next-destination contact sheet with candidate IDs | Rejected/HOLD/legacy art or an unrelated rendering language appears in the active flow |
| “テスト点がアート弱さを隠した” | Visual, silent/safety, and runtime gates never compensate | Three separately reported verdicts | A combined score, passing tests, or maintainability is used to waive weak art |
| “アプリで変わってない” | Prove the build the user opens, not only source or local mocks | Actual target, build revision, delivery flag, rendered candidate ID, cold-cache/PWA-update screenshot | Target identity is unknown, candidate attribute is absent, or only local/source evidence exists |
| “問題UIで絵の意味が消えた” | Reserve an answer-shelf safe zone before authoring and recheck every runtime crop | Named-viewport runtime frames with faces, acting hand/tool tip, subject grounding/feet, and payoff prop marked | Any required cause, contact, grounding, or payoff cue is under the shelf or fade |

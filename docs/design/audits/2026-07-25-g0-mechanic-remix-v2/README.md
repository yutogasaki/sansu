# G0 Mechanic Remix v2 — Runtime Audit

## Scope

This audit covers the development-only two-candidate graybox at
`/#/__dev/g0-v2`.

- Experiment ID: `g0-mechanic-remix-v2`
- Candidate A: `chain-shot`
- Candidate B: `number-vessel`
- Source base revision: `47831f9` with an uncommitted working tree
- Runtime target: local Vite development server
- Build revision: `development-local`
- Delivery flag: `snap-root-v1` (production Explore flag; it does not select this DEV route)
- Cache/update state: Vite development/HMR, not a production PWA build
- Formal status: **HOLD**

The frozen v1 comparison remains at `/#/__dev/g0`; its existing audit is not
overwritten. The diagnostic conditions for v2 are fixed in
[experiment-contract.md](./experiment-contract.md).

## Runtime coverage

Manual browser QA used normal click and keyboard input, not reducer injection.

| Surface | State or flow | Result |
|---|---|---|
| 390×844 evaluator | A initial, first reaction, `safe → safe`, replay carry | PASS |
| 390×844 evaluator | A `wild → recovery` | PASS |
| 390×844 evaluator | B initial, source selection, `2+2`, preview feed, `1+4` recipe | PASS |
| 390×844 evaluator | B three splits, 7/6 overflow, fourth-action compose recovery | PASS |
| 390×844 participant | B initial, `motion=reduce`, `order=ba` | PASS |
| 768×1024 evaluator | A and B initial states | PASS |
| Keyboard | B token selection and split with Enter | PASS |
| Candidate switch | Switch away during A reaction, then return after settle | PASS |
| Invalid v2 variant | `variant=chain-excavation` stops with an explicit version message | PASS |
| Legacy route | `/#/__dev/g0?variant=chain-excavation` still renders v1 | PASS |
| Sound | Initial OFF, ON, then OFF again | PASS |

At 390×844 and 768×1024 there was no horizontal overflow. The participant
surface fit its full stage and required controls inside the viewport. A first
pass found the chain counter overlapping the recovery target at phone width;
the counter was moved above the target field and the same state was rechecked.
No React or TypeError runtime logs were observed.

## Design Review Report

### Summary

- Visual magnetism:
  - A: **38 / 60**, `g0-mechanic-remix-v2/chain-shot`, 390×844 and 768×1024, live DEV runtime
  - B: **42 / 60**, `g0-mechanic-remix-v2/number-vessel`, 390×844 and 768×1024, live DEV runtime
  - These are graybox readability scores by an author who knows the intended rules, not independent art or child-appeal evidence.
- Silent comprehension and safety: **HOLD** — no independent child observation
- Runtime integrity: **GO** for the tested DEV route and states
- Whole-app continuity: **HOLD** — deliberately isolated from production Explore
- Delivery truth: local Vite, dirty working tree on `47831f9`, DEV-only route, no production cache claim
- Tone alignment: **OK**
- Game feel: **Attention** — materially different loops exist; replay appeal is not yet demonstrated
- Failure safety: **OK**
- Information design: **OK**
- Accessibility: **OK** for tested native controls, focus handoff, sound-off, and reduced motion; independent assistive review remains
- Maintainability: **OK**

### Findings

1. The candidates no longer compare four themes wrapped around one game.
   - Evidence: A accepts one world target and locks until its reaction settles.
     B selects a source quantity, then a destination, with a separate split
     verb and capacity state.
   - Impact: a preference now distinguishes action grammar, not only scenery.

2. Consequences are visible and recoverable without ability judgment.
   - Evidence: A changes `wild` into an available curved recovery target. B
     shows `7/6`, a changed vessel shape, and an explicit compose-to-open-space
     action before ending.
   - Impact: retry behavior can be observed without making a learning error the
     cause of failure.

3. The ordinary frames expose the next meaningful action before a payoff.
   - Evidence: target line style and shape distinguish A's choices without
     color alone. Quantity, dots, selection lift, next feed, and vessel slots
     expose B's state with sound off.
   - Impact: success animation is not carrying all of the attraction or state
     meaning.

4. Both candidates still have possible dominant strategies.
   - Evidence: A can finish `safe → safe`; B visibly names the signature
     `1+4=5`.
   - Impact: a child may complete once without wanting to explore another
     path. The diagnostic must record voluntary strategy change and should
     revise rules, not art, if it does not occur.

5. B uses tap-source then tap-destination as its shared pointer/keyboard
   grammar; it does not yet implement drag.
   - Impact: this is accessible and materially different from A, but the child
     study must check whether it feels like combining physical objects or like
     operating a form.

6. The graybox cannot establish production visual quality or fun.
   - Evidence: no finished actors, authored reactions, independent
     silent-comprehension test, or child replay observation exists.
   - Impact: no art production, production route replacement, or formal G0 PASS
     follows from this audit.

## Verdict

The v2 test instrument is ready for diagnostic A/B observation. Runtime
integrity is GO for the checked DEV states. Fun, silent comprehension, child
safety interpretation, whole-app continuity, and production adoption remain
HOLD until the experiment contract is executed with independent participants.

# G0 Mechanic Remix v2 — Diagnostic Experiment Contract

## Status and purpose

This document fixes the conditions for the `g0-mechanic-remix-v2` graybox
before observation begins.

This is a **diagnostic graybox contract**, not a formal G0 PASS protocol.
The observations may identify the stronger mechanic or the next revision to
test, but they cannot by themselves:

- approve either candidate for production;
- authorize finished-art production or G1 learning integration;
- satisfy a formal G0, G1, G2, learning-safety, or release gate;
- establish a durable product rule.

## Experiment identity

| Field | Fixed value |
|---|---|
| Candidate set ID | `g0-mechanic-remix-v2` |
| Development route | `/#/__dev/g0-v2` |
| Candidate A | `chain-shot` |
| Candidate B | `number-vessel` |
| Intended exposure | About 30 seconds per candidate |
| World actions | Minimum 2, maximum 4 per run |
| Finished art | Not used |
| Initial sound state | Off |

The 30-second duration is a facilitator guideline, not a score, countdown, or
failure condition. No timer is shown to the child. Do not interrupt an action
or reaction solely because the guideline elapsed; record the actual duration
and stop at the next understandable boundary.

## Comparison controls

1. Use both presentation orders, `A → B` and `B → A`, and keep their counts as
   balanced as practical.
2. Fix the order before the child starts. Do not change it in response to the
   first candidate's outcome or the child's reaction.
3. Use the same session seed for A and B for the same child. Record the exact
   seed; do not reroll a surprising or inconvenient result.
4. Start each candidate from a fresh candidate state. Evidence, resources, or
   learned state from the first candidate must not alter the second.
5. Keep the sound and motion condition the same across A and B for that child.
   Sound begins off and must remain optional.
6. Honor the device's reduced-motion preference and the explicit
   reduced-motion mode. Reduced motion must preserve the causal end state,
   consequence, recovery, and next available action; it must not merely remove
   the evidence needed to understand the mechanic.
7. Use whitebox shapes and only the visual detail needed to read targets,
   contact, consequence, and recovery. Finished illustration or unequal polish
   must not decide the comparison.
8. Keep each run within 2–4 accepted world actions. Retries caused by input
   rejection or an implementation fault are not world actions.

## Observation procedure

- Give no strategy explanation, candidate ranking, or preferred outcome before
  play.
- Let the child act on the world directly. A facilitator may resolve a device
  or accessibility problem but must record the intervention.
- After a run reaches an understandable stopping point, leave replay optional.
  Do not ask the child to replay before recording whether replay was
  spontaneous.
- Ask for a causal explanation only after the unprompted behavior has been
  observed. Use a neutral prompt such as「なにをして、どうなった？」and do
  not supply the mechanic's rule inside the question.
- Record behavior and the child's words separately from the evaluator's
  interpretation.

## Primary observations

These are observations, not formal PASS thresholds.

| Observation | What to record |
|---|---|
| Spontaneous replay | Whether the child starts another run without being instructed to do so, and when |
| Different strategy | Whether a later run intentionally changes a target, order, timing, or risk choice; record the action sequence rather than inferring intent from the outcome alone |
| Causal explanation | Whether the child can describe what they acted on, what changed, and the perceived connection between them |
| Retry after recovery | After a recoverable consequence has visibly settled and a safe next action is available, whether the child resumes play or tries another approach |
| Safe interpretation | The child's description of the event, including any reading of danger, pain, blame, shame, punishment, or inability to recover |

Also record candidate, presentation order, seed, actual duration, accepted world
actions, replay count, sound state, motion state, facilitator intervention,
build revision, and any incomplete or aborted run.

## Stop lines

Stop the affected session immediately and record the reason when:

- the child shows distress or describes the experience as dangerous, painful,
  blaming, shaming, or punishing;
- a failure or consequence appears unrecoverable, or the child cannot identify
  a safe way to continue;
- the wrong candidate, order, seed, sound state, or motion condition is loaded;
- a visible timer, evaluator coaching, or finished-art advantage contaminates
  the observation;
- duplicate input, stale reaction, focus loss, clipped controls, or another
  runtime fault changes the accepted world-action sequence;
- reduced motion, sound off, keyboard or assistive interaction removes
  information required to understand the state or continue safely.

Do not repair a contaminated run and count it as clean evidence. Mark it
diagnostic or excluded, retain the reason, and rerun only under a newly recorded
session identity.

If the primary observations do not support replay, strategy change, causal
understanding, recovery, and a safe interpretation, revise the mechanic or
experiment before adding finished art or connecting real learning logic.

## Evidence boundary

The four-candidate `g0-direct-stage-v1` audit and this two-candidate remix use
different candidate sets, action grammars, exposure conditions, and
instrumentation. Therefore:

- do not directly compare their replay counts, durations, path counts,
  completion rates, or other numeric values;
- do not pool v1 and v2 observations into one rate or threshold;
- do not describe a numeric difference from v1 as improvement or regression.

The old v1 evidence may be cited only as historical context or as a source of
qualitative hypotheses. Any future formal comparison requires a new
pre-registered protocol with a shared baseline, population, presentation order,
instrumentation, exclusion rules, and PASS thresholds.

# Prepared staged Boolean diagnostic — not executed

Static reading finds no obvious operand reuse or context bug in the original loop. `body=solids[2]` remains the branch, the operand list is captured before deletion, every operand is distinct, and each modifier is applied to the explicitly active body before its operand is removed. A returned operator status was not recorded originally; this diagnostic records it and verifies body/operand object and data identities.

This is one bounded reproduction of the exact original order: branch union terrain threshold, aligned opening, round junction, native interior. It reuses raw planned top triangles, the sealed extrusion helper, the original native floor evaluated in the saved failed scene, and original materials. No shape, width, height, epsilon, solver setting or face-deletion repair is introduced. The original context and failed body are never operands or modified. Only fresh temporary object/data copies receive modifiers; nothing is saved or rendered.

Record input and before/after each step: face/vertex/edge counts, edge valence, duplicate coordinate faces, degenerate faces, signed volume, object/context identity and operator result. Record the first operand that increases duplicates. Horizontal coplanar overlap is a bounded report at existing EPS, not a self-intersection clearance claim. Closed/manifold original input does not rule out ribbon self-intersection, especially the radial/gallery turn or flat junction.

If the first duplicate-producing step had two closed operands and this Blender exposes MANIFOLD, a separate comparison uses exact untouched copies of that step's pre-operation data. It is not adopted into the continued EXACT sequence and gives no runtime/source acceptance. No other solver sweep is planned.

Read `preparation.json` for the sealed command: one Blender, CPU2, RSS2560MiB,60s. The same immutable supervisor applies resource limits; actual child PID/UTC and short-lived RSS observations must be recorded externally. No execution until root reviews and schedules. Any failure retains partial report and log; no retry.

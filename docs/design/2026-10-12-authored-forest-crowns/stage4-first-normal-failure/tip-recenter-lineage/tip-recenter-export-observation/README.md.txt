# Tip-recenter export observation — unexecuted preparation

This is an observation-only copy of the first sealed tip probe. It runs only the six-incident-sharp input control and tip-recenter output. The earlier old-pivot result and failed export stay immutable in `../tip-recenter-probe/`.

The same Float64 field/Jacobian, source NORMAL transport, .002 guard, 1e-6 diagnostic world-error bound, original four exact-zero exclusions and 148 retained faces are used. No geometry, owner transform, source normal or tolerance repair is introduced. The geometry/oracle/runner/test files are byte-identical. The export still operates on the same diagnostic object; no export-only copy or scene repair.

Before export the actual oracle record and POS / loop indices / corner NORMAL / matrix / sharp flags / material values are flushed. After export those same components and individual hashes are flushed before the original combined digest-and-flags assertion. A repeated failure remains a HOLD; the raw attributes identify what changed. No global update or normal setter is added.

Only if the existing assertion passes does the already prepared standalone GLB → Blender import → GLB comparison continue. There is no full build or render. Local nonzero faces do not resolve the four tiny faces collapsing after a Float32 world cast.

One fresh `execution-01` / `attempt-01`; CPU2, RSS2GiB, 60s; no automatic retry. Root authorized one execution after seal. Other source owners' files and app are untouched.

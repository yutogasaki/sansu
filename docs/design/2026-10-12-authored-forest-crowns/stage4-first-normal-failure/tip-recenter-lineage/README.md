# Single-leaf source-normal representation diagnostic

The final single-leaf diagnostic passed; this does not adopt the forest composition, all101 deformations, runtime, joint/actor gates or M1. All prior failures remain here in original decoded bytes.

The successful input is l14/source node2239, hanging-leaf0. The original152 faces remain untouched. The derived diagnostic excludes exactly four source-zero faces0/2/98/100, retains148 nonzero local triangles, preserves raw source NORMAL using the same inverse-transpose field Jacobian, splits six source-normal fan edges and stores tip-relative Float32 positions with compensated child translation. The owner/root matrix stays unchanged. Four microscopic retained faces still collapse after a Float32 world cast; local validity is a distinct result.

Final [summary](tip-recenter-evaluated-baseline/terminal-summary.json) and [full result](tip-recenter-evaluated-baseline/attempt-01/result.json): raw input NORMAL maxL2 .000499945; desired Blender .000593805; GLB1/2 .000625178; reimport .000598594. All are below .002. Both GLBs retain exact148 triangles/PBR; maximum world error7.608781644e-7 is below the unchanged1e-6 diagnostic bound. Original442 source meshes/parents/materials stayed exact during clone evaluation. Stable authoring552objects/444meshes/199materials stayed exact across the complete roundtrip, with no restore/repair.

Run PID52306 exited0, 2026-10-12 06:11:04.064496–06:11:28.251803 UTC, sampled peak630,128,640B. CPU2/RSS2GiB/60s bounds stayed fixed. These source diagnostics may overlap other authorized functional tasks and provide no performance acceptance.

## Preserved sequence

1. `tip-recenter-probe`: original-pivot comparison fails, tip reaches first export; combined digest assertion stops. Active record was not flushed before that assertion; this missing observation is explicit.
2. `tip-recenter-export-observation`: identifies only child matrix translation changing; raw POSITION/NORMAL/triangles/material/sharp/parent stay exact.
3. `tip-recenter-isolated-export`: first meaningful failure is2scene/131mesh output, then diagnostic-object transform guard, then RSS limit. Do not reorder this as an initial memory failure.
4. `tip-recenter-active-scene`: explicit active-scene selection completes both exports/reimport but fails exact authoring-scene guard on the two newly created clones.
5. `tip-recenter-evaluated-baseline`: one view-layer evaluation completes new clone construction before the authoring snapshot. Raw parent/basis math proves the Float32 composition; all original source data remain exact. Complete numeric roundtrip passes.

The final step synchronizes clone construction before comparison; it does not loosen a transform guard or repair a post-export mutation. Earlier source-space field/normal collapse tracing is in `preassignment-basis/`.

## Replay and byte identity

[Archive proof](archive-proof.json) maps every original absolute path to archived bytes or a hash-verified existing durable input. It binds all replay inputs, source-before/source-after and decoded-destination SHA256. Restore paths using this map to reproduce the original commands, whose fixed temporary roots remain recorded; do not run archived scripts blindly from this differently nested directory. Historical Markdown is `.md.txt` unchanged. Existing gzip stays byte-identical; large plain JSON uses deterministic gzip. Source assets are reused by exact SHA, not regenerated.

Original fixed extraction: [role GLB](../../extraction-attempt02/role-separated-originals.glb), [c1 context](../../extraction-attempt02/fixed-c1-context.glb), [bindings](../../extraction-attempt02/bindings.json). Earlier [source import-normal correspondence](../normal-debug/README.md), [zero-face comparison](../zero-face-comparison/README.md), and [sharp-fan comparison](../sharp-fan-comparison/README.md) remain separate complete archives.

Generalization is preparation only: vertex38/six-sharp and the tip anchor are not blanket rules for all roles. Fixed27, original materials/owners/roots and previously passed roles retain their boundaries. Independent child observation remains N=0.

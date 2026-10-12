# Ordinary four-tree layout planning — bounded result

Only A reached a complete layout and a store/restore check. B/C remain proposals with recorded partial command success. None is a whole-island art or variable-terrain completion claim.

Input: current `authored-shoulder-reference-mature.json`, source-shading native05 world, normal `authoredWorldFrame` options `{water:true,cove:true,shoulder}`. The source closure was bundled once. No live app, source asset, candidate, browser or Blender was changed. See [input parity](input-parity.json).

## Three exact sequences

Each starts independently from the same initial fixture. Coordinates are `(x,z)`, commands are ordinary `applyIntent` `move` commands.

| Arrangement | Ordered moves | Recorded status |
| --- | --- | --- |
| A: west open center | l28→(4,-4), l14→(1,-4), l15→(2,-2), l29→(3,-2) | All four complete; negative path case |
| B: east shore line | l14→(12,-9), l15→(12,-8), l28→(12,-7), l29→(12,-5) | First two complete; remaining unverified |
| C: split west/east | l14→(4,-7), l15→(12,-7), l28→(1,-7), l29→(13,-5) | First move complete; remaining unverified |

A deliberately moves l28 first to free `(1,-4)` for l14. All other targets were initially empty and passed actual current `canPlace` plus floor support inventory. Initial legality does not establish the unexecuted later commands of B/C.

The fixed source owners remain l14 (willow/big), l15 (birch/big), l28 (spire/mature), l29 (birch/mature). Growth remains 18. The other 31 owners, including shoulder l33/l34/l35, remain byte-equivalent through every recorded command. Successful checkpoints retain 35 owners, 75 rights, 9170 drops, unchanged town/nature/land and no new owner or right. This analysis does not invoke the concurrently generalized forest factory; its seven rich tree owners are a renderer concern, not asserted from these domain results.

## Completed A result

[Final state](west-open-center-state.json) and [full result](west-open-center-result.json) are available. Each of the four final positions has placement support. Spatially the middle is open, but the domain walking graph loses access to 31 of 35 owners. Thus this is a useful negative example of legal tree placement closing routes, not a safe open courtyard.

The moved owners derive as `P01:l14` lane/seeded, `P01:l15` corner/seeded (l15+l29), and `P01:l28` lane/seeded. P02 disappears. Ordinary `canPlace` for saplings checks support and occupancy, not global accessibility. This domain graph result excludes the actual gallery mesh, its known entry problem, canopy/body clearance and animation.

A additionally uses `store l15` then `unstore l15 at (2,-2)`. The stored phase still owns all 35 objects and 75 rights, with 34 placed objects. After unstore, the A state is exact except command receipts and derived place-progress records. This restores the A layout, not the original fixture.

## Bounded execution limits

The first combined analysis completed A's moves and store/unstore, then exhausted a 3GiB Node heap during an unnecessary all-four return-to-base sequence. Its first raw failure is preserved in `execution.log.txt` and `execution-result.json` (118.7s, exit -6). This was not a PASS or a renderer test.

The smaller sequential replay preserves all real frame/canPlace/ordinary-command/invariant checks. A completed in 28.7s. B recorded two moves and invariants, then hit the same heap bound in 48.4s (exit -6). C recorded one move before the 100s outer bound; only its owned process group was terminated (exit -15). No timeout or heap limit was raised. B/C final state, derivePlaces and path outcomes are unknown. No further layout search, precision analysis or base-restoration loop was started.

The first B operation `l14→(12,-9)` is a confirmed ordinary move with inventory/maturity/rights invariant checks and can be used as a narrow real-UI art-continuity target. A final state can be used only with its path-failure label. The pending B/C sequences are not successful layout evidence.

See [summary](summary.json), [initial legal-cell inventory](inventory.json), [exact proposed moves](arrangements.json), [B partial commands](east-shore-line-progress.json), [C partial commands](split-west-east-progress.json), and [short execution records](short-execution-result.json).

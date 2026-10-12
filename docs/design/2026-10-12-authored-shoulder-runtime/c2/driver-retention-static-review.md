# c2 shoulder driver retention — static review

Read-only review of `/private/tmp/sansu-authored-shoulder-c2/candidate/tools/e2e-authored-shoulder.mjs`, SHA256 `2fbbf7bd3d86e807a2673649924ee0d6aace213e2a57b5efeed091b2614f5f17`. No projection, browser, test, build, measurement or implementation was run. Lines below refer to this frozen driver unless named otherwise.

The removed outer Map is no longer an unbounded root: `frame` directly delegates at 93–96. There is no new report field holding a frame or IslandWorld. This reduces one known retention cause, but it does not establish that the full journey fits the default heap.

## Exact lifetime findings

- `checkFrame` returns `projected` at 151, and `checkSettled` forwards it at 162. Callers can therefore keep a full compiled world while they retain the returned record. This is an ordinary strong reference, independent of domain LRU eviction.
- Acquisition `initial` at 264 is last read at 265 when computing `oldPlaces`/`geometryHash`. It is not referenced by the later purchase callbacks. V8 may release this dead local before function return; lexical scope alone does not prove it retains a world throughout acquisition. A short setup block or a helper returning only oldPlaces/geometryHash would make the intended lifetime explicit.
- Each purchase's `current` at 269 is genuinely needed through `applyIntent(...current.projected.world)` at 279, spanning preview and screenshot awaits. It has no use after 279 and does not escape into `report`. It is per-iteration, not an accumulating array of frames. `previewCheck` returns revision/root telemetry only (228), not its `checked.projected`.
- `fixedEdits.initial` at 315 is explicitly used again at 350 for `initial.revision`; it therefore keeps the entire baseline frame through move/store/restore. After the setup placement check, only the scalar revision is needed. Keeping `initialRevision` instead of `initial` is the clearest low-risk release boundary. Benefit is unmeasured: baseline is also among the few states frequently reused by the domain cache, so this may not reduce the actual current sequence's retained-world count.
- `fixedEdits.committed` (323, replaced at 328 and 341) contains a frame across awaits but is only used for `physicalProof(committed.proof)` at 324/329/346. Retaining that plain proof instead would remove an unnecessary frame reference. This is one overwritten variable, not three accumulated frames. `capture` at 167 temporarily holds a frame across screenshot awaits, then returns it; current call sites discard its result.
- `report.captures` at 173–175 stores host/metadata strings, JSON-parsed proofs/poses, rights and reference data. It excludes `projected`. Rights are copied cells (`space.ts:34–35`), so they do not point back to a world. Report scope state/old-place roles/history, preview root telemetry and pointer floor coordinates also contain data rather than compiled-world closures. These records can still consume bounded capture/report memory; no byte size is inferred here.

## Across acquisition → fixed

`await acquisition()` finishes before `fixedReference()` starts (459–460). Completed acquisition locals do not intentionally escape into the next function. `loadScope` closes the old browser context before creating the next one (230–232), but this does not clear Node-domain caches.

The module-level `base`, `domain`, and `shoulder` remain live for the whole run (83/407/454–455). `authoredWorldFrame` retains up to three final frames plus its one extension, keyed by that base; `authoredWaterFrame` separately retains up to three upstream water frames keyed by the extension. Both caches persist across the two browser scopes and evict normally as new states arrive. A final-frame hit can bypass refreshing the upstream water cache, so their sets need not be identical. The prior domain allocation review remains applicable: several compiled worlds/support indices and temporary composition stages can coexist even with no outer Map.

The three-state comparison measured ~1,668.89 MiB retained after commit-l33 with index sharing. It did not exercise all acquisition states, fixed edits, actual browser allocations, screenshots or the complete report. It cannot be extrapolated to a full-run PASS or an inevitable OOM. More world variants and composition transients still represent meaningful default-heap risk.

## Additional handle boundary

`whole()` obtains an ElementHandle at 179 and never explicitly disposes it after the detached-node wait at 181. Installed Playwright's `client/channelOwner.js:42–44` keeps channel owners in connection/parent maps; `_dispose` at 94–101 removes them, while `client/jsHandle.js:70–72` exposes disposal. The safe future boundary is `try/finally` disposal after the wait. This is distinct from Node-domain world retention. The static code does not prove that the detached DOM handle retains a React world or GPU resource; report it as a handle cleanup opportunity, not the identified cause of the domain OOM. Context close already gives a broader browser-side cleanup boundary.

## Recommended scope if a later repair is needed

1. Preserve every assertion and source/candidate check. Replace long-lived checked/frame records with the few scalars/plain telemetry actually needed: setup oldPlaces/hash, fixed initialRevision/rights, and committed physical proof. This removes unnecessary references without changing caching or query semantics.
2. Dispose the `whole()` ElementHandle once its existing wait completes.
3. Do not preemptively change the frozen c2 candidate, add GC as an application fix, clear private domain caches, raise heap, split scopes into new processes, or rebuild base between scopes based on this static review. Those alter execution/memory conditions or increase compilation work and need separate evidence/authorization. Current cache capacity and repeated composition remain the main measured cost; the proposed scalar/handle release boundaries have no quantified savings yet.

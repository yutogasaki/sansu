# Local ridge ROI diagnostic — attempt 02 prepared, not executed

This is a separate harness-only follow-up against immutable `/private/tmp/sansu-authored-shoulder-c2/candidate` and root's existing server on **5359**. It does not use current live application sources. Do not execute before root reviews and authorizes this attempt.

Prepared command:

```sh
python3 /private/tmp/sansu-floor-shading-diagnostic-c2/roi-face-normal-attempt-02/run-once.py --start
```

Fresh outputs are `actual-02/` and `execution-02/`; neither exists. No automatic retry is allowed. The wrapper owns only its new Node process group, with a 900 second wall deadline and a 4 GiB observed process-tree RSS limit sampled every 0.5 seconds. It never signals root's Vite server. Other bounded source diagnostics may overlap; elapsed time is not performance evidence.

Attempt 01 exited 1 before any capture or ROI material change because Node's strict comparison distinguishes in-memory `-0` from persisted JSON `0` in the projection matrix. Its source/dependency checks and cleanup succeeded. The original directory and its 30 files remain unchanged; a byte-identical failure archive is at `docs/design/2026-10-12-authored-shoulder-runtime/c2/floor-diagnostic/roi-attempt-01/` in the live repository. This follow-up does not replace that failure or reinterpret it as a pass.

## Exactly what changed

Only the static-target **projection comparison** maps `Object.is(value, -0)` to `0`. It applies no tolerance or other numeric transformation. MatrixWorld and between-capture invariants remain exact. A pure helper check demonstrates that the smallest positive nonzero value still fails, length mismatch fails, and original arrays are not changed.

Before the first assertion after each observed stage, the full observation is placed in `report.preAssertObservations` and written to `<stage>-pre-assert.json`. Camera matrices include original numeric values, lossless number tokens (`"-0"` where applicable), negative-zero indices, exact mismatch indices and canonical projection arrays. Plain JSON numeric values alone cannot retain negative zero; the tokens and indices explicitly preserve that distinction. The expected projection is the existing JSON target, not a newly guessed matrix. The helper's constructed example is marked as a synthetic static check, not runtime evidence.

The original console 404 remains unclassified: its log had no URL or location. Static candidate inspection found no favicon link in the authored entry, while the root index has an icon reference for a different page. An automatic browser favicon request is only a hypothesis. See [404 evidence](404-classification.json). **No 404 or favicon exemption is installed.** All console errors, page errors, HTTP >=400 responses and request failures remain fatal, including shader compilation errors.

New error evidence records UTC timestamps, `console.location()`, failing response URL/status/statusText/method/resource type/content type, and the first 1,024 response-body characters or a body-read error. It also records failed requests. Listeners remain active through cleanup/close, and pending body evidence is drained before final report persistence, including first failure. This is error observability, not suppression.

## Unchanged causal test

Three captures are required: **shadow-off baseline → ROI face-normal → restored-shadow-off**. The original target.json, shader vertex text and shader fragment text are byte-identical to attempt 01. Only material 0 is cloned; no floor position, normal, color, index, group, support, or state geometry is modified.

Inside the same small world-space ROI, the shader assigns both `normal` and `nonPerturbedNormal` to the derivative face normal after `normal_fragment_begin` and before normal-map/lighting chunks. Derivatives are evaluated before conditional assignments; outside the ROI, original normal derivatives still supply geometry roughness. The original material, receiveShadow flag and Scene hook must be restored, and the single clone must be disposed. Full shader compilation evidence remains required in the actual run; static string checks do not establish GPU compilation.

The same source 6,460 / installed 6, driver dependencies, actual rendered version, source triangle/index/group, prior floor buffers, camera, lights and renderer checks remain. Canonical state excludes only the inherited `applied`/`placeProgress` fields; walking topology excludes only instantaneous poses, with raw values retained. Completion alone is not visual acceptance, a geometry repair, performance evidence, or an M1 pass.

## Prepared checks and hashes

JavaScript syntax, Python AST, installed Three shader-string injection, and the signed-zero-only helper checks passed without a browser. See [readiness](readiness.json), [driver diff](attempt-01-to-02.diff), [comparison check](comparison-check.json), and [shader check](static-check.json).

- Driver SHA256: `08989783cc4e4ab90d2384be54acd38dc23e5084012ed0010d9e234a9242e6eb`
- Wrapper SHA256: `1cc870d32f0939a32660dd02754ad572e223f947d603ef7e271d459d75b9ec0d`
- Target SHA256: `d7ecf37dfdce5eec6b7d331a1faf6afa446a34c9ef01e5581ea9f4a0f0f9d819`

No diagnostic execution, browser, application build or core check has been started for attempt 02.

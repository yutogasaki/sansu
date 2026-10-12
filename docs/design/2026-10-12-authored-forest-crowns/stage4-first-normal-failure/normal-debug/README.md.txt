# Stage4 first-role normal readback diagnostic

**Prepared, not executed.** This directory does not change stage4's sealed build, field, normal method, .002 guard, or first failed scene. A successful diagnostic process would not make the source build pass.

One CPU2 Blender process, observed RSS2GiB, 60 seconds. It imports the same fixed context and role-separated-originals in the same order, then calls the **unchanged original `deform.apply`** on original role copies until the first exception. No joint/section work, stage4 rebuild, normal-recalculate operator, render or `.blend` save.

The original exception frame supplies actual `old_positions`, `old_normals`, per-vertex normal transport, `expected`, `actual`, transforms and residual. This avoids substituting an instrumented deformation implementation for the failing one. The output identifies failing name/owner/role/source index/ordinal and completed/attempted counts. All input/output positions, expected/stored corner normals, loop→vertex/edge/polygon mapping, smooth/sharp flags and attributes are saved to `failing-role-raw.json.gz`.

The 24 largest differences include original-f32 finite-difference Jacobian and a separate pure-Python-float64 field finite difference, converted to a float32 Matrix only for inversion. This is a comparison of numerical operands, not a proof of geometric surface-normal correctness. Original expected versus Blender stored values are the primary storage/readback observation.

On throwaway clones only, record:

1. Repeated original failed-mesh read without an update.
2. Failed-data copy immediate read.
3. Copy `mesh.update()` then read.
4. `view_layer.update()` then read.
5. Resubmit exactly the original expected normals on the copy; read immediately and after explicit updates. No new normal calculation is substituted.
6. Pristine original-input clone passed through the same unmodified `deform.apply`, retaining the same guard. Compare positions, expected normals and stored normals to the first failure.

Updates may refresh Blender caches, which is the observation under test. No hypothesis is preselected: inverse-transpose operands, custom-normal storage, smooth-fan grouping and stale caches remain distinguishable possibilities. Same-vertex corner lists expose whether multiple expected normals are represented differently in a shared fan. No tolerance increase, edge-split repair, topology change, smoothing-flag change or broad normal recalculation is attempted.

Expected outputs: `attempt-01/result.json`, full compressed raw operands, role order, completed-before-failure, clone normals and before/after input hashes; runner UTC/PID/.25s sampled RSS/execution log. Raw stage4 failure/Blend and all read code/assets are hash-bound before and after. First diagnostic failure is retained without retry.

Command is sealed in `readiness.json`; await root's diagnostic window before launch.

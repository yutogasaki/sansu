# First trunk ray diagnostic

This source-only diagnostic reopens the preserved failed stage2 scene. It does not regenerate, deform, save the Blender scene, render, or alter any joint condition. No geometry acceptance is implied.

The first `willow-actual-trunk-and-lobes` pair is `role-l14-2743` (fixed original trunk) and `role-l14-2234` (deformed lobe 0). The exact proposal/field reconstructs the builder's two guesses and `.45 * .46 * .585 * .35 * .6` overlap-ball radius. Input hashes are required before opening the scene.

The original `joints.overlap_ball`, `Volume.inside` and `Volume.clearance` run first without instrumentation. Their first failure is saved immediately. The same call then runs with a transparent BVH proxy on the trunk only: its original hit tuple is returned unchanged. A wrapper around trunk clearance records the candidate point without changing its result. The 128 intersection limit, 100-unit ray extent, directions, weld check and `1e-7` step remain unchanged.

The proxy records hit/triangle/distance and calculates the identical next-origin expression for diagnostics only. The next actual ray call is compared to that recorded next origin. Float32 bit patterns, adjacent representable spacing and double-precision intended increments distinguish a rounded zero step from a merely small nonzero step. No offset correction is attempted.

Authorized command: `SANSU_FOREST_RAY_DEBUG_APPROVED=1 python3 /private/tmp/sansu-authored-forest-crown-study/stage2/ray-debug/run-once.py`.

One Blender process, CPU2, wall limit 90 seconds and sampled RSS stop at 3 GiB. The RSS guard is observed once per second, not an allocation limit. No retry. Original failed scene and scripts stay unchanged; new raw, trace and run metadata are under this directory only. An exit 0 means the expected failure was reproduced and measured, not that joints passed.

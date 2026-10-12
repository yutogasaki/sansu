# P02 sixteen-step source entry view

PREPARED, NOT EXECUTED. One read-only entry close view of exactly the v5 scene used by the whole view. Source visual/runtime remain HOLD. Geometry, materials, camera input and original source bytes unchanged. The renderer differs from the passed whole helper only by enabling the existing entry-section camera choice. The old camera is authored [3.5,2.55,-4.45] → [3.5,2.2,-8.45], ortho4.7, near.1.

Only growing-reachable-paths.visible_shadow=false is applied exactly as in the v5 whole. This is an explicit difference from old v4 views; no geometry repair or concealed contact adjustment. CPU2/60sec/RSS2560MiB,1280px/Cycles16samples, one fresh run, first failure preserved, no retry. Renderer preserves source/mesh/material and all other shadow flags, does not save the scene.

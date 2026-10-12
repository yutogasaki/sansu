# FAILED/HOLD shape diagnostic — prepared, not executed

One whole source image will show the 105 existing deformations in the immutable `../attempt-01/failed-stage.blend`. That scene stopped before the first joint proof and contains no generated connecting boughs. This view is for coarse art judgment only; failed joints, runtime status and N=0 remain unchanged.

`render-failed-whole.py` verifies the failed-scene SHA, opens it without saving, and calls the exact original `stage1_support.add_views()` helper. That restores the original planned whole camera, lights and environment/ocean appearance. As in the existing stage2 render, it uses 1280px, Cycles CPU16 samples and 2 threads. No source mesh, material, normal, visibility, light recipe or pixel content is repaired. All source mesh digests and materials must remain identical before and after adding the view and rendering.

The output is explicitly named `FAILED-HOLD-source-whole.png` in a fresh `attempt-01/`, with a manifest retaining its failed status and parent source failure. It is not a new accepted candidate or actual application image. Known black path dots, absence of residents and source-render differences remain visible and documented. No image overlay or retouch is applied.

Command after the parent's serial window: `SANSU_FOREST_FAILED_SHAPE_APPROVED=1 .../Blender -b --threads 2 --python-exit-code 1 --python .../failed-shape-view/render-failed-whole.py`. Use one Blender process, CPU2, 120-second render bound and observed RSS3GiB stop. Expected time is unmeasured for this scene; earlier whole source renders took seconds. Do not launch concurrently with the other source survey. There is no retry and no scene/GLB export.

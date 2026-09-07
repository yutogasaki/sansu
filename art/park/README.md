# Small Park — Blender source

Working candidate: `park-resin-blender-v1`. Blender 5.2.1 LTS, created through Blender MCP with native meshes, curves, materials and a small rig. No external image-to-3D service or runtime 3D dependency.

Open `park-resin-v1.blend`. The scene contains independent named collections for the doll, six toys, the base, bubble halves and studio. The initial unrelated Blender scene was preserved. The reference image is packed into the blend and also provided in `reference/ref-01.png`.

## Reproduce

From the repository root, with Blender and Python/Pillow available:

```sh
blender -b art/park/park-resin-v1.blend --python tools/park/export_assets.py -- assets
python3 tools/park/pack_assets.py
blender -b art/park/park-resin-v1.blend --python tools/park/export_assets.py -- beauty
```

On the author's Mac, the executable is `/Applications/Blender.app/Contents/MacOS/Blender`. The source scripts themselves derive paths from the repository location. `blockout` and `portrait` modes produce geometry/face inspection renders. PNG RGBA originals are regenerated under `renders/`; WebP assets go to `public/assets/park/resin-v1/`. The packer asserts that alpha bytes remain unchanged.

`tools/park/create_scene.py` is the procedural construction source. It can also be run in Blender via MCP. It rebuilds only the scene marked with this candidate ID, preserving unrelated scenes. Rebuilding replaces manual edits inside the generated scene; export existing edits without rebuilding. Object `park_origin` values are the local authoring origins used when relocating exports.

## Controls and geometry

- +X forward, +Y depth, +Z up. Actor 1 U; slot spacing 1.5 U.
- The working doll is about two heads tall to retain a readable face at 64 CSS px, following the chosen image. This adjusts the v0.2 text's initial 2.2–2.4-head proposal and remains an art-review choice.
- Orthographic camera: yaw 25°, elevation 15°, roll 0°. All exports 120 px/U with recorded canvas and foot pivots.
- Gate normal −15° from +X toward −Y. Open floor, 1.435 U external height. The closed oval in the generated reference would block the feet, so the bottom was opened.
- Plinth extends from −1.3 U to the last slot +1.55 U. Finish is last slot +1.25 U; feet stay on the board.
- High jump apex offset 3.2 U. The initial 1.9/2.6 U proposals did not provide sufficient clearance over the full orb overlap during the shorter end jump.
- `ROOT_PATH` belongs to application translation. `ROOT_POSE`, named joint controls and `Doll rig` bones provide local acting. Sprite renders keep path translation zero. The saved 24-frame clip contains contact, takeoff, apex, landing/pop and settle markers.
- Eight representative poses, two actor colors. These are sprite poses, not eight complete 24fps animation sequences.
- Trampoline membrane has a `Compression` shape key. Gate/slide fronts are separate collections. Soap center remains transparent and does not require background refraction.

`asset-manifest.json` records camera, color management, dimensions, pivots, alpha bounds, semantic timing and budgets. Application timing and rules remain authoritative; sprite rendering never saves game or learning events.

## Review status

This is an implemented working candidate, not a claim of final art approval or independent child-observation success. See `docs/design/park-blender-runtime.md` and its runtime audit for the verified scope.

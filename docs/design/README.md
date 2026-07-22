# Visual Production Workspace

`docs/design/` is the workspace for visual exploration and production inputs.

- Keep raw generations, prompts, contact sheets, comparisons, and concept art here.
- Put only approved runtime-ready finals under `public/assets/`.
- Production exploration scenes use `scene-*` filenames so the PWA can include them explicitly.
- Keep the [Sprite Forge comparison](./sprite-forge-comparison-2026-07-19/index.html) and [retired PNG fallbacks](./legacy-ikimono-png/README.md) here; neither directory is copied into the production build.
- The [Research Library benchmark](./research-library-2026-07-19/benchmark-yoshi-fukashigi.md) separates reusable discovery-loop principles from protected character and interface expressions before implementation.
- `npm run assets:check` rejects oversized production art, legacy PNG fallbacks, and any production input placed anywhere under `public/`.

Runtime ikimono art is WebP. If it cannot be loaded, the shared React component renders a code-native SVG fallback, so production does not depend on the legacy PNG archive.

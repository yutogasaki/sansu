# Superseded Explore Runtime Assets

- Date: 2026-07-21
- Purpose: preserve visual-loop evidence without shipping inactive candidates
- Production status: excluded from `public/` and PWA precache

`LightBridgeEncounter` uses only `scene-*-flow-v3.webp`. Earlier full-size JPG and `pop-v2` frames are archived under `light-bridge/`.

`RootTangleEncounter` uses only `scene-*-dense-v3.webp`. Earlier full-size JPG and `pop-v2` frames are archived under `root-tangle/`.

These files remain comparison evidence. Moving them back into `public/assets/explore/` requires a new runtime reference, named-viewport visual review, and asset-budget verification; their existence in this audit directory is not production approval.

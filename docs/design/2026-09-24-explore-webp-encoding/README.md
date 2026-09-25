# Explore artwork delivery encoding, 2026-09-24

## Decision

Keep the existing `pokko-field-v1` artwork, camera, stage sequence, visual candidate IDs, and offline behavior. Replace 26 production JPEG files with same-dimension WebP files encoded at quality 90 (Pillow 11.3.0, method 6). The existing rapid-trail WebP is unchanged. Source JPEG bytes remain recoverable from repository history; no second copy ships in `public`.

This is a delivery-size change, not a new art direction or a formal approval of the current Explore art. The parent behavior spec does not change; the format-specific flattened-delivery line in `14_ui_world_motion_spec.md` now names WebP. [Per-file measurements and hashes](encoding-manifest.json) bind each encoded file to its former source.

## Size and image comparison

| Measure | Before | Candidate | Change |
|---|---:|---:|---:|
| 26 converted frames | 5,060,150 B | 3,014,088 B | −2,046,062 B (−40.4%) |
| 27 production Explore images | 4.92 MiB | 2.97 MiB | −1.95 MiB |
| Life-enabled PWA precache | 9.98 MiB | 8.03 MiB | −1.95 MiB |
| Precache entry count | 125 | 125 | unchanged |

All frames retain their original dimensions. Across the 26 pairs, minimum SSIM was 0.93945 at source size, 0.97682 after scaling to 390 px, and 0.95958 after scaling to 768 px. These are image-difference diagnostics, not a visual approval score. The [source/encoding comparison at 390 px](compare-mobile.png) includes ready, dig-two, popped, firefly payoff, and root-tangle payoff. At that size I did not find a changed silhouette, hand/tool tip, foot, prop, or action cue. Detail texture is slightly smoother in the encoded image.

## Actual local runtime evidence

- Target: local Life-enabled production preview `http://127.0.0.1:5298`, app version `development-local:8ed34acc-7846-4e96-85c2-f00faf3fde21`, delivery `snap-root-v1`, lineage `pokko-field-v1`, rendered cold-open candidate `dig-pop-carry-bloom-v3`.
- [Phone 390×844 critical stage contact](critical-phone-contact.png) and [tablet 768×1024 critical stage contact](critical-tablet-contact.png) show `ready → dig-one → dig-two → popped` from a disposable Chromium context with the actual production bundle. All four stage images decoded from `.webp`; no page error occurred. These are cold-open frames, not a complete release-flow contact sheet.
- [WebKit iPhone 13 emulation ready frame](runtime-phone.png) and [WebKit tablet ready frame](runtime-tablet.png) show the real page crop and full TenKey. The emulation decoded the WebP online without a page error. Installed iPhone Safari remains unmeasured.
- Chromium phone/tablet contexts installed a real service worker with 27 Explore WebP entries and no Explore JPEG entries. Offline reload decoded `scene-ready.webp` at 1280×720 in both widths with no page error. Playwright WebKit's `context.setOffline(true)` caused an internal navigation/fetch error; that lane is not counted as an offline relaunch pass.
- The final Life-enabled local build has version `development-local:72aea2d4-ebef-437a-8592-2f280a7e1127` and source hash `9a48c0a4b7900fe6d10e587f5439605fb9292533e7978eba3eca8eef46e61718`. A real service-worker update from the prior JPEG build (`development-local:f57c2cf0-0a14-4c43-86e5-b7194f2b3533`) passed at phone/tablet widths: each held a partially answered learning plan during the update, reloaded once at the safe point, and retained ownership and the same next question after offline restart. The stage contacts above were captured from the earlier, source-equivalent WebP build identified in their bullet.

## Verification

- Life-enabled `verify:core`: docs, UI guard, lint, typecheck, full Vitest suite, production build, and `assets:check` passed.
- Classic `e2e:smoke`: all critical routes and Explore encounters passed.
- Life old-JPEG to new-WebP two-build service-worker update: phone/tablet passed as described above.
- Classic `e2e:pwa-update`: four guarded update/recovery cases passed. Classic `e2e:pwa-two-build`: real update, protected form and persistence, stale-worker recovery, offline/cache retention passed.
- Fixed-ten Study/Explore throughput ran all four cells 10 times. The technical gates passed (Explore Q1/Q2 operable p95 122 ms; incorrect same-question operable p95 450.6 ms). The report has `evidence.eligible=false` and `pass=false` because this shared worktree has uncommitted changes (`cleanRevision=false`); it is a diagnostic, not the versioned release audit.

## Separate gates

- **Visual appeal:** local source/encoded parity screen passed for the inspected frames; formal image-led approval remains HOLD with the existing visual candidate.
- **Silent comprehension and safety:** image content and framing were retained, but no new independent observer test was run. Human N=0; this gate remains HOLD.
- **Runtime integrity:** local source, build, cached-image, crop, classic PWA, and Life old-to-new PWA checks passed. Fixed-ten's technical gates passed, but its formal evidence gate remains HOLD due to the dirty shared revision. A real installed iPhone launch remains unmeasured.

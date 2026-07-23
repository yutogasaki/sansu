import { describe, expect, it } from "vitest";
import {
  extractPrecacheUrls,
  isDeprecatedExploreArtworkPath,
  isExploreArtworkPath,
  isLegacyIkimonoPngPath,
  isNonProductionAssetPath,
} from "./asset-policy.mjs";

describe("asset production policy", () => {
  it.each([
    "visual-tests/sprite-comparison/raw.png",
    "assets/explore/root-tangle/style-concept-v3.jpg",
    "assets/explore/new-pack/raw/source.png",
    "assets/explore/new-pack/concept-sketch.webp",
    "assets/explore/new-pack/scene-concept.webp",
    "assets/explore/new-pack/prompt-used.txt",
    "assets/moodboard/reference-forest.jpg",
  ])("keeps %s out of production precache", (assetPath) => {
    expect(isNonProductionAssetPath(assetPath)).toBe(true);
  });

  it("normalizes Windows paths before applying the production boundary", () => {
    expect(isNonProductionAssetPath("assets\\explore\\draft\\scene-open.jpg")).toBe(true);
    expect(isNonProductionAssetPath("assets\\explore\\root-tangle\\scene-open.jpg")).toBe(false);
  });

  it.each([
    "assets/explore/root-tangle/scene-open.jpg",
    "ikimono/0-1.webp",
    "icons/icon-192.png",
  ])("accepts the production path %s", (assetPath) => {
    expect(isNonProductionAssetPath(assetPath)).toBe(false);
  });

  it("accepts only final exploration artwork as production art", () => {
    expect(isExploreArtworkPath("assets/explore/root-tangle/scene-open.jpg")).toBe(true);
    expect(isExploreArtworkPath("assets/explore/new-pack/scene-complete.avif")).toBe(true);
    expect(isExploreArtworkPath(
      "assets/explore/opening-snap-root-carry-bloom-v3/scene-dig-two.jpg",
    )).toBe(true);
    expect(isExploreArtworkPath("assets/explore/new-pack/raw-scene.png")).toBe(false);
  });

  it.each([
    "assets/explore/firefly-flower/scene-waiting-dew-path-pokko-v3.jpg",
    "assets/explore/light-bridge/scene-idle-leaf-dew-path-pokko-v6.jpg",
    "assets/explore/root-tangle/scene-tangled-dew-path-pokko-v6.jpg",
    "assets/explore/opening-snap-root-painted/scene-ready-tablet.jpg",
  ])("rejects deprecated HOLD artwork from production delivery: %s", (assetPath) => {
    expect(isDeprecatedExploreArtworkPath(assetPath)).toBe(true);
  });

  it("keeps the carry-bloom candidates outside the deprecated contract", () => {
    expect(isDeprecatedExploreArtworkPath(
      "assets/explore/firefly-flower/scene-waiting-carry-bloom-pokko-v4.jpg",
    )).toBe(false);
  });

  it("recognizes only runtime ikimono PNGs as legacy fallbacks", () => {
    expect(isLegacyIkimonoPngPath("ikimono/0-1.png")).toBe(true);
    expect(isLegacyIkimonoPngPath("ikimono\\9-3.PNG")).toBe(true);
    expect(isLegacyIkimonoPngPath("ikimono/0-1.webp")).toBe(false);
    expect(isLegacyIkimonoPngPath("icons/icon-192.png")).toBe(false);
  });

  it("extracts and deduplicates Workbox precache URLs", () => {
    const source = 'precacheAndRoute([{url:"index.html"},{url:"a.webp"},{url:"a.webp"}])';
    expect(extractPrecacheUrls(source)).toEqual(["index.html", "a.webp"]);
  });
});

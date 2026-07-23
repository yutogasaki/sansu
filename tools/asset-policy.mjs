export const ASSET_BUDGETS = Object.freeze({
  maxPrecacheBytes: 12 * 1024 * 1024,
  maxExploreArtworkBytes: 8 * 1024 * 1024,
  maxExploreArtworkFileBytes: 800 * 1024,
});

const normalizeAssetPath = (value) => value
  .replaceAll("\\", "/")
  .replace(/^\.\//, "");

const NON_PRODUCTION_SEGMENT = /(?:^|\/)(?:visual-tests|raw|concept|draft|source|comparison)(?:\/|$)/i;
const NON_PRODUCTION_FILENAME_TOKEN = /(?:^|[-_.])(?:raw|concept|draft|source|comparison|prompt|moodboard|reference)(?:[-_.]|$)/i;
const DEPRECATED_EXPLORE_ARTWORK = new Set([
  "assets/explore/firefly-flower/scene-dew-trail-dew-path-pokko-v3.jpg",
  "assets/explore/firefly-flower/scene-light-path-dew-path-pokko-v3.jpg",
  "assets/explore/firefly-flower/scene-ringing-petals-dew-path-pokko-v3.jpg",
  "assets/explore/firefly-flower/scene-waiting-dew-path-pokko-v3.jpg",
  "assets/explore/firefly-flower/scene-warm-bud-dew-path-pokko-v3.jpg",
  "assets/explore/light-bridge/scene-complete-leaf-dew-path-pokko-v6.jpg",
  "assets/explore/light-bridge/scene-crossed-leaf-dew-path-pokko-v6.jpg",
  "assets/explore/light-bridge/scene-idle-leaf-dew-path-pokko-v6.jpg",
  "assets/explore/root-tangle/scene-crossed-dew-path-pokko-v6.jpg",
  "assets/explore/root-tangle/scene-open-dew-path-pokko-v6.jpg",
  "assets/explore/root-tangle/scene-tangled-dew-path-pokko-v6.jpg",
  "assets/explore/opening-snap-root-painted/scene-ready.jpg",
  "assets/explore/opening-snap-root-painted/scene-ready-tablet.jpg",
  "assets/explore/opening-snap-root-painted/scene-dig-one.jpg",
  "assets/explore/opening-snap-root-painted/scene-dig-one-tablet.jpg",
  "assets/explore/opening-snap-root-painted/scene-dig-two.jpg",
  "assets/explore/opening-snap-root-painted/scene-dig-two-tablet.jpg",
  "assets/explore/opening-snap-root-painted/scene-popped.jpg",
  "assets/explore/opening-snap-root-painted/scene-popped-tablet.jpg",
]);

export const isNonProductionAssetPath = (value) => {
  const normalized = normalizeAssetPath(value);
  const filename = normalized.slice(normalized.lastIndexOf("/") + 1);
  return NON_PRODUCTION_SEGMENT.test(normalized)
    || NON_PRODUCTION_FILENAME_TOKEN.test(filename);
};

export const isExploreArtworkPath = (value) => {
  const normalized = normalizeAssetPath(value);
  return normalized.startsWith("assets/explore/")
    && /\.(?:avif|jpe?g|png|svg|webp)$/i.test(normalized)
    && !isNonProductionAssetPath(normalized);
};

export const isDeprecatedExploreArtworkPath = (value) => (
  DEPRECATED_EXPLORE_ARTWORK.has(normalizeAssetPath(value))
);

export const isLegacyIkimonoPngPath = (value) => {
  const normalized = normalizeAssetPath(value);
  return /^ikimono\/[^/]+\.png$/i.test(normalized);
};

export const extractPrecacheUrls = (serviceWorkerSource) => {
  const urls = [...serviceWorkerSource.matchAll(/\burl:"([^"]+)"/g)]
    .map((match) => match[1]);
  return [...new Set(urls)];
};

export const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
};

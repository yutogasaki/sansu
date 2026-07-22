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

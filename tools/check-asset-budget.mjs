import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ASSET_BUDGETS,
  extractPrecacheUrls,
  formatBytes,
  isExploreArtworkPath,
  isLegacyIkimonoPngPath,
  isNonProductionAssetPath,
} from "./asset-policy.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const DIST_DIR = path.join(ROOT, "dist");

const walkFiles = async (directory, prefix = "") => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkFiles(absolutePath, relativePath));
    } else if (entry.isFile()) {
      files.push({ relativePath, absolutePath });
    }
  }

  return files;
};

const main = async () => {
  const errors = [];
  const publicFiles = await walkFiles(PUBLIC_DIR);
  const exploreArtwork = [];

  for (const file of publicFiles) {
    const fileSize = (await stat(file.absolutePath)).size;
    if (isNonProductionAssetPath(file.relativePath)) {
      errors.push(
        `${file.relativePath}: production inputs belong under docs/design, not public`,
      );
      continue;
    }

    if (isLegacyIkimonoPngPath(file.relativePath)) {
      errors.push(
        `${file.relativePath}: legacy PNG belongs under docs/design/legacy-ikimono-png`,
      );
      continue;
    }

    if (!isExploreArtworkPath(file.relativePath)) continue;
    exploreArtwork.push({ ...file, fileSize });
    if (fileSize > ASSET_BUDGETS.maxExploreArtworkFileBytes) {
      errors.push(
        `${file.relativePath}: ${formatBytes(fileSize)} exceeds the per-image budget `
        + `(${formatBytes(ASSET_BUDGETS.maxExploreArtworkFileBytes)})`,
      );
    }
  }

  const exploreArtworkBytes = exploreArtwork.reduce((sum, file) => sum + file.fileSize, 0);
  if (exploreArtworkBytes > ASSET_BUDGETS.maxExploreArtworkBytes) {
    errors.push(
      `production explore artwork totals ${formatBytes(exploreArtworkBytes)}, exceeding `
      + `${formatBytes(ASSET_BUDGETS.maxExploreArtworkBytes)}`,
    );
  }

  const serviceWorkerSource = await readFile(path.join(DIST_DIR, "sw.js"), "utf8");
  const precacheUrls = extractPrecacheUrls(serviceWorkerSource);
  if (precacheUrls.length === 0) {
    errors.push("dist/sw.js does not contain a readable Workbox precache manifest");
  }

  let precacheBytes = 0;
  for (const url of precacheUrls) {
    if (isNonProductionAssetPath(url)) {
      errors.push(`${url}: non-production asset leaked into the PWA precache`);
    }
    if (isLegacyIkimonoPngPath(url)) {
      errors.push(`${url}: large PNG fallback leaked into the PWA precache; use WebP`);
    }

    const outputPath = path.join(DIST_DIR, url);
    try {
      precacheBytes += (await stat(outputPath)).size;
    } catch {
      errors.push(`${url}: precache entry has no matching dist file`);
    }
  }

  if (precacheBytes > ASSET_BUDGETS.maxPrecacheBytes) {
    errors.push(
      `PWA precache totals ${formatBytes(precacheBytes)}, exceeding `
      + `${formatBytes(ASSET_BUDGETS.maxPrecacheBytes)}`,
    );
  }

  const precacheSet = new Set(precacheUrls);
  for (const file of exploreArtwork) {
    if (!precacheSet.has(file.relativePath)) {
      errors.push(`${file.relativePath}: production encounter artwork is missing from precache`);
    }
  }

  const ikimonoWebp = publicFiles
    .filter((file) => /^ikimono\/.*\.webp$/i.test(file.relativePath));
  for (const file of ikimonoWebp) {
    if (!precacheSet.has(file.relativePath)) {
      errors.push(`${file.relativePath}: offline WebP is missing from precache`);
    }
  }

  if (errors.length > 0) {
    console.error("FAIL assets:check");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log("PASS assets:check");
  console.log(
    `- PWA precache: ${precacheUrls.length} unique files, ${formatBytes(precacheBytes)} `
    + `/ ${formatBytes(ASSET_BUDGETS.maxPrecacheBytes)}`,
  );
  console.log(
    `- Explore artwork: ${exploreArtwork.length} production files, `
    + `${formatBytes(exploreArtworkBytes)} / ${formatBytes(ASSET_BUDGETS.maxExploreArtworkBytes)}`,
  );
  console.log("- Production-input contract: docs/design only; absent from public and precache");
};

main().catch((error) => {
  console.error("FAIL assets:check");
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});

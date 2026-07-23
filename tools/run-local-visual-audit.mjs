#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdtempSync,
  promises as fs,
  realpathSync,
  renameSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = path.resolve(
  fileURLToPath(new URL("../", import.meta.url)),
);
const AUDIT_ROOT = path.join(REPOSITORY_ROOT, "docs", "design", "audits");
const HOST = "127.0.0.1";
const PORT = 4187;
const BASE_URL = `http://${HOST}:${PORT}`;
const DELIVERY_ID = "snap-root-v1";
const VISUAL_LINEAGE_ID = "pokko-field-v1";
const PROVENANCE_SCHEMA_VERSION = "sansu-exact-clean-build-v1";
const WRAPPER_ID = "sansu-local-visual-audit-v1";
const PROVENANCE_ENV_NAME = "SANSU_VISUAL_AUDIT_BUILD_PROVENANCE_PATH";
const TARGET_ATTESTATION_FILE = "sansu-visual-audit-target.json";
const PREVIEW_START_TIMEOUT_MS = 30_000;
const CHILD_STOP_TIMEOUT_MS = 5_000;
const APP_TITLE_MARKER = "<title>ポッコのふしぎずかん</title>";
const NPM_EXECUTABLE = process.platform === "win32" ? "npm.cmd" : "npm";

const KNOWN_LEGACY_EVIDENCE_FILES = new Set([
  "docs/design/breakout-loop-2026-07-21/runtime-painted-v2-audit/390-dig-one.png",
  "docs/design/breakout-loop-2026-07-21/runtime-painted-v2-audit/390-dig-two.png",
  "docs/design/breakout-loop-2026-07-21/runtime-painted-v2-audit/390-popped.png",
  "docs/design/breakout-loop-2026-07-21/runtime-painted-v2-audit/768-dig-one.png",
  "docs/design/breakout-loop-2026-07-21/runtime-painted-v2-audit/768-dig-two.png",
  "docs/design/breakout-loop-2026-07-21/runtime-painted-v2-audit/768-popped.png",
  "docs/design/breakout-loop-2026-07-21/runtime-painted-v2-audit/768-ready.png",
]);

const NON_RUNTIME_PATH_PREFIXES = [
  ".agents/",
  ".claude/",
  ".github/",
  "design-system/",
  "docs/",
];

const NON_RUNTIME_ROOT_FILES = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "CONSTITUTION.md",
  "README.md",
  "design-qa.md",
]);

const managedChildren = new Set();
const transient = {
  auditRoot: null,
  tempRoot: null,
  stagingDir: null,
  strictTempPrefix: null,
};

let cleanupPromise;
let receivedSignal;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fail = (message) => {
  throw new Error(message);
};

const pathEntryExists = async (candidatePath) => {
  try {
    await fs.lstat(candidatePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
};

const isPathInside = (candidatePath, parentPath) => (
  candidatePath === parentPath
  || candidatePath.startsWith(`${parentPath}${path.sep}`)
);

const runSync = (
  command,
  args,
  {
    cwd = REPOSITORY_ROOT,
    env = process.env,
    trim = true,
    allowFailure = false,
  } = {},
) => {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    fail(
      `${command} ${args.join(" ")} failed: `
      + `${result.stderr || result.stdout || `exit ${result.status}`}`,
    );
  }
  const stdout = result.stdout || "";
  return {
    ...result,
    stdout: trim ? stdout.trim() : stdout,
  };
};

const runGit = (
  repositoryRoot,
  args,
  { trim = true, allowFailure = false } = {},
) => runSync(
  "git",
  ["-C", repositoryRoot, ...args],
  { trim, allowFailure },
);

const parseStatusRecords = (rawStatus) => {
  const records = rawStatus.split("\0");
  const entries = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    const status = record.slice(0, 2);
    const paths = [record.slice(3)];
    if (status.includes("R") || status.includes("C")) {
      const originalPath = records[index + 1];
      if (!originalPath) {
        fail(`Could not parse renamed Git path: ${record}`);
      }
      paths.push(originalPath);
      index += 1;
    }
    entries.push({ status, path: paths[0], paths });
  }
  return entries;
};

const isAllowedNonRuntimePath = (candidatePath) => (
  KNOWN_LEGACY_EVIDENCE_FILES.has(candidatePath)
  || NON_RUNTIME_ROOT_FILES.has(candidatePath)
  || NON_RUNTIME_PATH_PREFIXES.some((prefix) => candidatePath.startsWith(prefix))
);

const readMainRepositoryState = (repositoryRoot) => {
  const repositoryTopLevel = path.resolve(
    runGit(repositoryRoot, ["rev-parse", "--show-toplevel"]).stdout,
  );
  if (repositoryTopLevel !== repositoryRoot) {
    fail(
      `Local visual audit must run from the Sansu repository; got ${repositoryTopLevel}`,
    );
  }

  const headRevision = runGit(
    repositoryRoot,
    ["rev-parse", "--verify", "HEAD^{commit}"],
  ).stdout;
  const sourceTreeSha = runGit(
    repositoryRoot,
    ["rev-parse", "--verify", "HEAD^{tree}"],
  ).stdout;
  if (!/^[0-9a-f]{40}$/.test(headRevision)) {
    fail(`Expected a full lowercase Git commit SHA, got: ${headRevision}`);
  }
  if (!/^[0-9a-f]{40}$/.test(sourceTreeSha)) {
    fail(`Expected a full lowercase Git tree SHA, got: ${sourceTreeSha}`);
  }

  const rawStatus = runGit(
    repositoryRoot,
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    { trim: false },
  ).stdout;
  const dirtyEntries = parseStatusRecords(rawStatus);
  const dirtyRuntimeInputs = dirtyEntries.filter(({ paths }) => (
    paths.some((candidatePath) => !isAllowedNonRuntimePath(candidatePath))
  ));
  if (dirtyRuntimeInputs.length > 0) {
    fail(
      "Local visual audit refuses dirty runtime/build inputs. "
      + `Commit or restore them first: ${JSON.stringify(dirtyRuntimeInputs)}`,
    );
  }

  const knownLegacyEvidence = dirtyEntries.filter(({ paths }) => (
    paths.some((candidatePath) => KNOWN_LEGACY_EVIDENCE_FILES.has(candidatePath))
  ));
  return {
    headRevision,
    sourceTreeSha,
    dirtyEntryCount: dirtyEntries.length,
    knownLegacyEvidenceCount: knownLegacyEvidence.length,
  };
};

const readDetachedCheckoutState = (
  checkoutRoot,
  expectedRevision,
  expectedTreeSha,
) => {
  const headRevision = runGit(
    checkoutRoot,
    ["rev-parse", "--verify", "HEAD^{commit}"],
  ).stdout;
  const sourceTreeSha = runGit(
    checkoutRoot,
    ["rev-parse", "--verify", "HEAD^{tree}"],
  ).stdout;
  const branch = runGit(
    checkoutRoot,
    ["rev-parse", "--abbrev-ref", "HEAD"],
  ).stdout;
  const rawStatus = runGit(
    checkoutRoot,
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    { trim: false },
  ).stdout;

  if (
    headRevision !== expectedRevision
    || sourceTreeSha !== expectedTreeSha
    || branch !== "HEAD"
    || rawStatus !== ""
  ) {
    fail(
      "Detached audit checkout no longer matches the exact source commit: "
      + JSON.stringify({
        expectedRevision,
        headRevision,
        expectedTreeSha,
        sourceTreeSha,
        branch,
        status: parseStatusRecords(rawStatus),
      }),
    );
  }
  return { headRevision, sourceTreeSha, branch, clean: true };
};

const resolveAuditRoot = async () => {
  const repositoryRoot = await fs.realpath(REPOSITORY_ROOT);
  if (repositoryRoot !== REPOSITORY_ROOT) {
    fail(
      `Repository path must be canonical for local visual audit: `
      + `${REPOSITORY_ROOT} -> ${repositoryRoot}`,
    );
  }
  const auditRootStat = await fs.lstat(AUDIT_ROOT);
  if (!auditRootStat.isDirectory() || auditRootStat.isSymbolicLink()) {
    fail(`Visual audit root must be a real directory: ${AUDIT_ROOT}`);
  }
  const auditRoot = await fs.realpath(AUDIT_ROOT);
  if (
    auditRoot !== AUDIT_ROOT
    || !isPathInside(auditRoot, repositoryRoot)
  ) {
    fail(
      `Visual audit root must resolve inside the canonical repository: ${auditRoot}`,
    );
  }
  return { repositoryRoot, auditRoot };
};

const parseOutputDir = async (repositoryRoot, auditRoot) => {
  let cliOutputDir;
  for (let index = 2; index < process.argv.length; index += 1) {
    const argument = process.argv[index];
    if (argument === "--help" || argument === "-h") {
      console.log(
        "Usage: npm run e2e:visual-audit:local -- "
        + "--output-dir docs/design/audits/<new-directory>\n"
        + "Or set SANSU_VISUAL_AUDIT_OUTPUT_DIR to that new direct child.",
      );
      return null;
    }
    if (argument === "--output-dir") {
      cliOutputDir = process.argv[index + 1];
      if (!cliOutputDir) fail("--output-dir requires a value");
      index += 1;
      continue;
    }
    if (argument.startsWith("--output-dir=")) {
      cliOutputDir = argument.slice("--output-dir=".length);
      if (!cliOutputDir) fail("--output-dir requires a value");
      continue;
    }
    fail(`Unknown argument: ${argument}`);
  }

  const environmentOutputDir = process.env.SANSU_VISUAL_AUDIT_OUTPUT_DIR?.trim();
  if (
    cliOutputDir
    && environmentOutputDir
    && path.resolve(repositoryRoot, cliOutputDir)
      !== path.resolve(repositoryRoot, environmentOutputDir)
  ) {
    fail(
      "--output-dir and SANSU_VISUAL_AUDIT_OUTPUT_DIR point to different directories",
    );
  }
  const requestedOutputDir = cliOutputDir || environmentOutputDir;
  if (!requestedOutputDir) {
    fail(
      "Provide a new evidence directory with --output-dir "
      + "or SANSU_VISUAL_AUDIT_OUTPUT_DIR",
    );
  }

  const outputDir = path.resolve(repositoryRoot, requestedOutputDir);
  const outputName = path.basename(outputDir);
  if (
    path.dirname(outputDir) !== auditRoot
    || outputName === "."
    || outputName === ".."
    || outputName.startsWith(".")
  ) {
    fail(
      "Visual audit output must be a visible, direct new child of "
      + `${auditRoot}: ${outputDir}`,
    );
  }
  if (await pathEntryExists(outputDir)) {
    fail(`Visual audit output already exists; refusing to overwrite: ${outputDir}`);
  }
  return outputDir;
};

const sanitizeEnvironment = (additionalEntries = {}) => ({
  ...Object.fromEntries(
    Object.entries(process.env).filter(([name]) => (
      !name.startsWith("VITE_")
      && !name.startsWith("SANSU_")
    )),
  ),
  ...additionalEntries,
});

const spawnManagedChild = (command, args, options = {}) => {
  if (receivedSignal) {
    fail(`Refusing to start ${command} after ${receivedSignal}`);
  }
  const child = spawn(command, args, {
    cwd: REPOSITORY_ROOT,
    stdio: "inherit",
    windowsHide: true,
    detached: process.platform !== "win32",
    ...options,
  });
  managedChildren.add(child);
  const forgetChild = () => managedChildren.delete(child);
  child.once("exit", forgetChild);
  child.once("error", forgetChild);
  return child;
};

const runChild = (command, args, options = {}) => new Promise(
  (resolve, reject) => {
    const child = spawnManagedChild(command, args, options);
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} failed`
          + (signal ? ` with signal ${signal}` : ` with exit code ${code}`),
        ),
      );
    });
  },
);

const childHasExited = (child) => (
  !child || child.exitCode !== null || child.signalCode !== null
);

const waitForChildExit = async (child, timeoutMs) => {
  const startedAt = Date.now();
  while (!childHasExited(child) && Date.now() - startedAt < timeoutMs) {
    await delay(50);
  }
  return childHasExited(child);
};

const stopChildTree = async (child) => {
  if (childHasExited(child) || !child.pid) return;

  if (process.platform === "win32") {
    spawnSync(
      "taskkill",
      ["/pid", String(child.pid), "/t", "/f"],
      { stdio: "ignore", windowsHide: true },
    );
    if (!(await waitForChildExit(child, CHILD_STOP_TIMEOUT_MS))) {
      fail(`Could not stop Windows child process tree ${child.pid}`);
    }
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
  if (await waitForChildExit(child, CHILD_STOP_TIMEOUT_MS)) return;
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
  if (!(await waitForChildExit(child, CHILD_STOP_TIMEOUT_MS))) {
    fail(`Could not stop child process group ${child.pid}`);
  }
};

const removeStrictChildTempDirs = async () => {
  if (!transient.auditRoot || !transient.strictTempPrefix) return;
  let entries;
  try {
    entries = await fs.readdir(transient.auditRoot);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  const matchingEntries = entries.filter((entry) => (
    entry.startsWith(transient.strictTempPrefix)
  ));
  await Promise.all(matchingEntries.map((entry) => (
    fs.rm(
      path.join(transient.auditRoot, entry),
      { recursive: true, force: true },
    )
  )));
};

const cleanupTransientArtifacts = () => {
  if (cleanupPromise) return cleanupPromise;
  cleanupPromise = (async () => {
    const cleanupFailures = [];
    const children = [...managedChildren];
    const childResults = await Promise.allSettled(
      children.map((child) => stopChildTree(child)),
    );
    cleanupFailures.push(
      ...childResults
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason),
    );
    const artifactResults = await Promise.allSettled([
      removeStrictChildTempDirs(),
      transient.stagingDir
        ? fs.rm(transient.stagingDir, { recursive: true, force: true })
        : Promise.resolve(),
      transient.tempRoot
        ? fs.rm(transient.tempRoot, { recursive: true, force: true })
        : Promise.resolve(),
    ]);
    cleanupFailures.push(
      ...artifactResults
        .filter((result) => result.status === "rejected")
        .map((result) => result.reason),
    );
    if (cleanupFailures.length > 0) {
      throw new AggregateError(
        cleanupFailures,
        "Could not fully clean local visual audit transient state",
      );
    }
  })();
  return cleanupPromise;
};

const sha256Bytes = (contents) => (
  createHash("sha256").update(contents).digest("hex")
);

const sha256File = async (filePath) => (
  sha256Bytes(await fs.readFile(filePath))
);

const readDistDigest = async (distDir) => {
  const canonicalDistDir = await fs.realpath(distDir);
  if (canonicalDistDir !== distDir) {
    fail(`Built dist path must be canonical: ${distDir} -> ${canonicalDistDir}`);
  }

  const files = [];
  const walk = async (directory, relativeDirectory = "") => {
    const entries = await fs.readdir(directory);
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry);
      const relativePath = relativeDirectory
        ? path.join(relativeDirectory, entry)
        : entry;
      const stat = await fs.lstat(absolutePath);
      if (stat.isSymbolicLink()) {
        fail(`Built dist must not contain symlinks: ${absolutePath}`);
      }
      if (stat.isDirectory()) {
        await walk(absolutePath, relativePath);
        continue;
      }
      if (!stat.isFile()) {
        fail(`Built dist contains a non-regular entry: ${absolutePath}`);
      }
      files.push({
        absolutePath,
        relativePath: relativePath.split(path.sep).join("/"),
      });
    }
  };
  await walk(distDir);
  files.sort((left, right) => {
    if (left.relativePath < right.relativePath) return -1;
    if (left.relativePath > right.relativePath) return 1;
    return 0;
  });
  if (files.length === 0) {
    fail(`Built dist is empty: ${distDir}`);
  }

  const aggregate = createHash("sha256");
  let totalBytes = 0;
  for (const file of files) {
    const contents = await fs.readFile(file.absolutePath);
    const byteLength = contents.byteLength;
    const fileSha256 = sha256Bytes(contents);
    totalBytes += byteLength;
    aggregate.update(file.relativePath, "utf8");
    aggregate.update("\0");
    aggregate.update(String(byteLength), "utf8");
    aggregate.update("\0");
    aggregate.update(fileSha256, "utf8");
    aggregate.update("\n");
  }

  return {
    path: canonicalDistDir,
    sha256: aggregate.digest("hex"),
    fileCount: files.length,
    totalBytes,
  };
};

const assertDistDigestUnchanged = (initialDigest, finalDigest) => {
  if (
    initialDigest.path !== finalDigest.path
    || initialDigest.sha256 !== finalDigest.sha256
    || initialDigest.fileCount !== finalDigest.fileCount
    || initialDigest.totalBytes !== finalDigest.totalBytes
  ) {
    fail(
      "Built dist changed during the visual audit: "
      + JSON.stringify({ initialDigest, finalDigest }),
    );
  }
};

const readBuiltVersion = async (distDir, expectedRevision) => {
  const versionPath = path.join(distDir, "version.json");
  let rawVersion;
  let version;
  try {
    rawVersion = await fs.readFile(versionPath);
    version = JSON.parse(rawVersion.toString("utf8"));
  } catch (error) {
    fail(`Could not read built version metadata at ${versionPath}: ${error.message}`);
  }
  if (
    version.revision !== expectedRevision
    || version.delivery !== DELIVERY_ID
    || version.visualLineage !== VISUAL_LINEAGE_ID
  ) {
    fail(
      "Built version metadata does not match the requested exact source target: "
      + JSON.stringify(version),
    );
  }
  return {
    version,
    rawSha256: sha256Bytes(rawVersion),
  };
};

const assertBuiltVersionUnchanged = (initialVersion, finalVersion) => {
  if (
    initialVersion.rawSha256 !== finalVersion.rawSha256
    || JSON.stringify(initialVersion.version) !== JSON.stringify(finalVersion.version)
  ) {
    fail(
      "Built version.json changed during the visual audit: "
      + JSON.stringify({ initialVersion, finalVersion }),
    );
  }
};

const probePreview = async (expectedRevision, targetNonce) => {
  const requestHeaders = {
    "cache-control": "no-cache, no-store, must-revalidate",
    pragma: "no-cache",
  };
  const cacheBust = randomUUID();
  const [indexResponse, versionResponse, targetAttestationResponse] = await Promise.all([
    fetch(`${BASE_URL}/?localVisualAudit=${cacheBust}`, {
      headers: requestHeaders,
      signal: AbortSignal.timeout(2_000),
    }),
    fetch(`${BASE_URL}/version.json?localVisualAudit=${cacheBust}`, {
      headers: requestHeaders,
      signal: AbortSignal.timeout(2_000),
    }),
    fetch(`${BASE_URL}/${TARGET_ATTESTATION_FILE}?localVisualAudit=${cacheBust}`, {
      headers: requestHeaders,
      signal: AbortSignal.timeout(2_000),
    }),
  ]);
  if (
    !indexResponse.ok
    || !versionResponse.ok
    || !targetAttestationResponse.ok
  ) return false;
  const [html, version, targetAttestation] = await Promise.all([
    indexResponse.text(),
    versionResponse.json(),
    targetAttestationResponse.json(),
  ]);
  return (
    html.includes(APP_TITLE_MARKER)
    && version.revision === expectedRevision
    && version.delivery === DELIVERY_ID
    && version.visualLineage === VISUAL_LINEAGE_ID
    && targetAttestation.schemaVersion === "sansu-local-visual-audit-target-v1"
    && targetAttestation.wrapperId === WRAPPER_ID
    && targetAttestation.revision === expectedRevision
    && targetAttestation.nonce === targetNonce
  );
};

const waitForPreview = async (preview, expectedRevision, targetNonce) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < PREVIEW_START_TIMEOUT_MS) {
    if (childHasExited(preview)) {
      fail(
        `Vite preview exited before becoming ready on fixed target ${BASE_URL}`,
      );
    }
    try {
      if (await probePreview(expectedRevision, targetNonce)) return;
    } catch {
      // The fixed loopback port is not ready yet.
    }
    await delay(250);
  }
  fail(
    `Vite preview did not serve the expected revision within `
    + `${PREVIEW_START_TIMEOUT_MS}ms: ${BASE_URL}`,
  );
};

const createDetachedCheckout = async (
  repositoryRoot,
  tempRoot,
  revision,
  sourceTreeSha,
  environment,
) => {
  const checkoutRoot = path.join(tempRoot, "checkout");
  await runChild(
    "git",
    [
      "clone",
      "--no-checkout",
      "--no-local",
      "--quiet",
      "--",
      repositoryRoot,
      checkoutRoot,
    ],
    { cwd: tempRoot, env: environment },
  );
  await runChild(
    "git",
    ["checkout", "--detach", "--quiet", revision],
    { cwd: checkoutRoot, env: environment },
  );
  readDetachedCheckoutState(
    checkoutRoot,
    revision,
    sourceTreeSha,
  );

  const sourceNodeModules = await fs.realpath(
    path.join(repositoryRoot, "node_modules"),
  );
  const nodeModulesStat = await fs.stat(sourceNodeModules);
  if (!nodeModulesStat.isDirectory()) {
    fail(`Repository node_modules is not a directory: ${sourceNodeModules}`);
  }
  await fs.symlink(
    sourceNodeModules,
    path.join(checkoutRoot, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  readDetachedCheckoutState(
    checkoutRoot,
    revision,
    sourceTreeSha,
  );
  return checkoutRoot;
};

const verifyStagingDirectory = async (stagingDir, auditRoot) => {
  const stat = await fs.lstat(stagingDir);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    fail(`Strict visual audit staging output is not a real directory: ${stagingDir}`);
  }
  const canonicalStagingDir = await fs.realpath(stagingDir);
  if (
    canonicalStagingDir !== stagingDir
    || path.dirname(canonicalStagingDir) !== auditRoot
  ) {
    fail(`Strict visual audit staging output escaped its audit root: ${stagingDir}`);
  }
};

const handleSignal = (signal) => {
  if (receivedSignal) return;
  receivedSignal = signal;
  void cleanupTransientArtifacts().finally(() => {
    process.removeListener("SIGINT", handleSigint);
    process.removeListener("SIGTERM", handleSigterm);
    process.kill(process.pid, signal);
  });
};

const handleSigint = () => handleSignal("SIGINT");
const handleSigterm = () => handleSignal("SIGTERM");

const main = async () => {
  const { repositoryRoot, auditRoot } = await resolveAuditRoot();
  transient.auditRoot = auditRoot;
  const outputDir = await parseOutputDir(repositoryRoot, auditRoot);
  if (!outputDir) return;

  const startState = readMainRepositoryState(repositoryRoot);
  const createdTempRoot = mkdtempSync(
    path.join(os.tmpdir(), "sansu-local-visual-audit-"),
  );
  transient.tempRoot = realpathSync(createdTempRoot);
  let stagingName;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidateName = (
      `.${path.basename(outputDir)}.wrapper-${randomUUID()}`
    );
    const candidatePath = path.join(auditRoot, candidateName);
    if (!(await pathEntryExists(candidatePath))) {
      stagingName = candidateName;
      transient.stagingDir = candidatePath;
      break;
    }
  }
  if (!transient.stagingDir) {
    fail("Could not reserve a unique visual audit staging path");
  }
  transient.strictTempPrefix = `.${stagingName}.tmp-`;
  const provenancePath = path.join(
    transient.tempRoot,
    "build-provenance.json",
  );

  const sanitizedEnvironment = sanitizeEnvironment();
  const checkoutRoot = await createDetachedCheckout(
    repositoryRoot,
    transient.tempRoot,
    startState.headRevision,
    startState.sourceTreeSha,
    sanitizedEnvironment,
  );
  const packageLockPath = path.join(checkoutRoot, "package-lock.json");
  const packageLockSha256 = await sha256File(packageLockPath);
  const npmVersion = runSync(
    NPM_EXECUTABLE,
    ["--version"],
    { cwd: checkoutRoot, env: sanitizedEnvironment },
  ).stdout;
  const buildEnvironment = sanitizeEnvironment({
    NODE_ENV: "production",
    SANSU_BUILD_REVISION: startState.headRevision,
    VITE_EXPLORE_EXPERIENCE: DELIVERY_ID,
    VITE_SHOW_LAYOUT_DEBUG: "",
  });

  console.log(
    `Building detached exact source ${startState.headRevision} `
    + `(${startState.sourceTreeSha}) for ${DELIVERY_ID}. `
    + `Allowed non-runtime dirt in the main checkout: `
    + `${startState.dirtyEntryCount} entries `
    + `(${startState.knownLegacyEvidenceCount} known legacy evidence files).`,
  );
  await runChild(
    NPM_EXECUTABLE,
    ["run", "build"],
    { cwd: checkoutRoot, env: buildEnvironment },
  );

  const distDir = path.join(checkoutRoot, "dist");
  const targetNonce = randomUUID();
  const targetAttestationPath = path.join(distDir, TARGET_ATTESTATION_FILE);
  const targetAttestationBytes = Buffer.from(`${JSON.stringify({
    schemaVersion: "sansu-local-visual-audit-target-v1",
    wrapperId: WRAPPER_ID,
    revision: startState.headRevision,
    sourceTreeSha: startState.sourceTreeSha,
    nonce: targetNonce,
  }, null, 2)}\n`, "utf8");
  await fs.writeFile(targetAttestationPath, targetAttestationBytes, { flag: "wx" });
  const initialVersion = await readBuiltVersion(
    distDir,
    startState.headRevision,
  );
  const initialDistDigest = await readDistDigest(distDir);
  readDetachedCheckoutState(
    checkoutRoot,
    startState.headRevision,
    startState.sourceTreeSha,
  );

  const provenance = {
    schemaVersion: PROVENANCE_SCHEMA_VERSION,
    wrapperId: WRAPPER_ID,
    revision: startState.headRevision,
    sourceTreeSha: startState.sourceTreeSha,
    delivery: DELIVERY_ID,
    visualLineage: VISUAL_LINEAGE_ID,
    baseUrl: BASE_URL,
    createdAt: new Date().toISOString(),
    packageLockSha256,
    nodeVersion: process.version,
    npmVersion,
    targetAttestation: {
      path: TARGET_ATTESTATION_FILE,
      nonce: targetNonce,
      sha256: sha256Bytes(targetAttestationBytes),
    },
    dist: initialDistDigest,
  };
  const provenanceBytes = Buffer.from(
    `${JSON.stringify(provenance, null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(provenancePath, provenanceBytes, { flag: "wx" });

  const viteCli = path.join(
    checkoutRoot,
    "node_modules",
    "vite",
    "bin",
    "vite.js",
  );
  const preview = spawnManagedChild(
    process.execPath,
    [
      viteCli,
      "preview",
      "--host",
      HOST,
      "--port",
      String(PORT),
      "--strictPort",
    ],
    { cwd: checkoutRoot, env: buildEnvironment },
  );
  await waitForPreview(preview, startState.headRevision, targetNonce);
  console.log(`Verified detached exact-build target at ${BASE_URL}.`);

  const auditEnvironment = sanitizeEnvironment({
    SANSU_VISUAL_AUDIT_BASE_URL: BASE_URL,
    SANSU_VISUAL_AUDIT_EXPECTED_REVISION: startState.headRevision,
    SANSU_VISUAL_AUDIT_OUTPUT_DIR: transient.stagingDir,
    [PROVENANCE_ENV_NAME]: provenancePath,
  });
  await runChild(
    process.execPath,
    [path.join(checkoutRoot, "tools", "e2e-smoke.mjs"), "--visual-audit"],
    { cwd: checkoutRoot, env: auditEnvironment },
  );

  if (!(await probePreview(startState.headRevision, targetNonce))) {
    fail("Detached exact-build target changed after strict visual audit");
  }
  await removeStrictChildTempDirs();
  await verifyStagingDirectory(transient.stagingDir, auditRoot);

  const endState = readMainRepositoryState(repositoryRoot);
  if (
    endState.headRevision !== startState.headRevision
    || endState.sourceTreeSha !== startState.sourceTreeSha
  ) {
    fail(
      "Main repository changed during the visual audit: "
      + JSON.stringify({ startState, endState }),
    );
  }
  readDetachedCheckoutState(
    checkoutRoot,
    startState.headRevision,
    startState.sourceTreeSha,
  );
  if (await sha256File(packageLockPath) !== packageLockSha256) {
    fail("Detached package-lock.json changed during the visual audit");
  }
  if (
    sha256Bytes(await fs.readFile(provenancePath))
    !== sha256Bytes(provenanceBytes)
  ) {
    fail("Build provenance JSON changed during the visual audit");
  }
  const finalVersion = await readBuiltVersion(
    distDir,
    startState.headRevision,
  );
  assertBuiltVersionUnchanged(initialVersion, finalVersion);
  const finalDistDigest = await readDistDigest(distDir);
  assertDistDigestUnchanged(initialDistDigest, finalDistDigest);

  await stopChildTree(preview);
  const publicationState = readMainRepositoryState(repositoryRoot);
  if (
    publicationState.headRevision !== startState.headRevision
    || publicationState.sourceTreeSha !== startState.sourceTreeSha
  ) {
    fail(
      "Main repository changed before visual evidence publication: "
      + JSON.stringify({ startState, publicationState }),
    );
  }
  readDetachedCheckoutState(
    checkoutRoot,
    startState.headRevision,
    startState.sourceTreeSha,
  );
  if (await sha256File(packageLockPath) !== packageLockSha256) {
    fail("Detached package-lock.json changed before evidence publication");
  }
  if (
    sha256Bytes(await fs.readFile(provenancePath))
    !== sha256Bytes(provenanceBytes)
  ) {
    fail("Build provenance JSON changed before evidence publication");
  }
  const publicationVersion = await readBuiltVersion(
    distDir,
    startState.headRevision,
  );
  assertBuiltVersionUnchanged(initialVersion, publicationVersion);
  const publicationDistDigest = await readDistDigest(distDir);
  assertDistDigestUnchanged(initialDistDigest, publicationDistDigest);
  if (await pathEntryExists(outputDir)) {
    fail(`Visual audit output appeared during capture: ${outputDir}`);
  }
  await verifyStagingDirectory(transient.stagingDir, auditRoot);
  const atomicPublicationState = readMainRepositoryState(repositoryRoot);
  if (
    atomicPublicationState.headRevision !== startState.headRevision
    || atomicPublicationState.sourceTreeSha !== startState.sourceTreeSha
  ) {
    fail(
      "Main repository changed at atomic evidence publication: "
      + JSON.stringify({ startState, atomicPublicationState }),
    );
  }
  renameSync(transient.stagingDir, outputDir);
  transient.stagingDir = null;
  console.log(
    `Exact detached-build visual audit passed for `
    + `${startState.headRevision}; evidence written to ${outputDir}`,
  );
};

process.once("SIGINT", handleSigint);
process.once("SIGTERM", handleSigterm);

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
}).finally(async () => {
  try {
    await cleanupTransientArtifacts();
  } catch (error) {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  }
  if (!receivedSignal) {
    process.removeListener("SIGINT", handleSigint);
    process.removeListener("SIGTERM", handleSigterm);
  }
});

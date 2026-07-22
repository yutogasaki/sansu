import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const HOST = "127.0.0.1";
const PORT_CANDIDATES = [4273, 4274, 4275];
const APP_TITLE_MARKER = "<title>ポッコのふしぎずかん</title>";
const SERVER_TIMEOUT_MS = 30_000;
const STEP_TIMEOUT_MS = 15_000;
const RECOVERY_PROTECTION_WAIT_MS = 4_500;
const LOAD_COUNT_KEY = "sansu-pwa-e2e-load-count";
const HASH_CHANGE_COUNT_KEY = "sansu-pwa-e2e-hashchange-count";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const probeServer = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) return { reachable: true, expected: false };
    const html = await response.text();
    return { reachable: true, expected: html.includes(APP_TITLE_MARKER) };
  } catch {
    return { reachable: false, expected: false };
  }
};

const waitForServer = async (url) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < SERVER_TIMEOUT_MS) {
    if ((await probeServer(url)).expected) return;
    await delay(250);
  }
  throw new Error(`Production preview did not become ready: ${url}`);
};

const startPreviewServer = (port) => {
  const child = spawn(
    process.platform === "win32" ? "cmd.exe" : "sh",
    process.platform === "win32"
      ? ["/c", `npm run preview -- --host ${HOST} --port ${port} --strictPort`]
      : ["-c", `npm run preview -- --host ${HOST} --port ${port} --strictPort`],
    { stdio: "pipe", windowsHide: true },
  );

  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  return child;
};

const stopPreviewServer = (child) => {
  if (!child) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
};

const startDedicatedPreview = async () => {
  for (const port of PORT_CANDIDATES) {
    const baseUrl = `http://${HOST}:${port}`;
    if ((await probeServer(baseUrl)).reachable) continue;

    const server = startPreviewServer(port);
    try {
      await waitForServer(baseUrl);
      return { baseUrl, server };
    } catch (error) {
      stopPreviewServer(server);
      throw error;
    }
  }

  throw new Error(`No dedicated production-preview port is free: ${PORT_CANDIDATES.join(", ")}`);
};

const installPwaE2EControl = async (page) => {
  await page.addInitScript(({ loadCountKey, hashChangeCountKey }) => {
    window.__SANSU_PWA_E2E__ = true;
    const nextLoadCount = Number(sessionStorage.getItem(loadCountKey) || "0") + 1;
    sessionStorage.setItem(loadCountKey, String(nextLoadCount));
    if (sessionStorage.getItem(hashChangeCountKey) === null) {
      sessionStorage.setItem(hashChangeCountKey, "0");
    }
    window.addEventListener("hashchange", () => {
      const nextHashChangeCount = Number(
        sessionStorage.getItem(hashChangeCountKey) || "0",
      ) + 1;
      sessionStorage.setItem(hashChangeCountKey, String(nextHashChangeCount));
    });
  }, {
    loadCountKey: LOAD_COUNT_KEY,
    hashChangeCountKey: HASH_CHANGE_COUNT_KEY,
  });
};

const getLoadCount = (page) => page.evaluate(
  (key) => Number(sessionStorage.getItem(key) || "0"),
  LOAD_COUNT_KEY,
);

const getHashChangeCount = (page) => page.evaluate(
  (key) => Number(sessionStorage.getItem(key) || "0"),
  HASH_CHANGE_COUNT_KEY,
);

const requestDeferredUpdate = async (page, version) => {
  await page.evaluate((requestedVersion) => {
    window.dispatchEvent(new CustomEvent("sansu:pwa-e2e-reload", {
      detail: { version: requestedVersion },
    }));
  }, version);
};

const requestDeferredRecovery = async (page, version) => {
  await page.evaluate((requestedVersion) => {
    window.dispatchEvent(new CustomEvent("sansu:pwa-e2e-recovery", {
      detail: { version: requestedVersion },
    }));
  }, version);
};

const setCriticalPersistence = async (page, active) => {
  await page.evaluate((nextActive) => {
    window.dispatchEvent(new CustomEvent("sansu:pwa-e2e-persistence", {
      detail: { active: nextActive },
    }));
  }, active);
};

const navigateWithReactRouter = async (page, destination) => {
  await page.evaluate((to) => {
    window.dispatchEvent(new CustomEvent("sansu:pwa-e2e-navigate", {
      detail: { to },
    }));
  }, destination);
};

const waitForMarkedNavigation = (page, version) => page.waitForRequest((request) => {
  if (!request.isNavigationRequest() || request.frame() !== page.mainFrame()) return false;
  return new URL(request.url()).searchParams.get("__app-update") === version;
}, { timeout: STEP_TIMEOUT_MS });

const assertUpdateStillDeferred = async (
  page,
  loadCountBefore,
  markerRequests,
  markerCountBefore,
  waitMs = 250,
) => {
  await delay(waitMs);
  assert(
    await getLoadCount(page) === loadCountBefore,
    "A protected session reloaded before reaching a safe checkpoint",
  );
  assert(
    markerRequests.length === markerCountBefore,
    "A protected session emitted an early update navigation",
  );
};

const verifyOnboardingSafeHandoff = async (page, markerRequests) => {
  const version = "safe-router-handoff";
  await page.goto("/#/onboarding");
  await page.getByRole("button", { name: "たんけんを はじめる" }).waitFor();

  const loadCountBefore = await getLoadCount(page);
  await page.getByRole("button", { name: "たんけんを はじめる" }).click();
  await requestDeferredUpdate(page, version);
  await requestDeferredUpdate(page, version);
  await assertUpdateStillDeferred(page, loadCountBefore, markerRequests, 0);

  const markedNavigation = waitForMarkedNavigation(page, version);
  await page.getByRole("textbox", { name: "あだ名でOK" }).fill("PWAテスト");
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByRole("button", { name: /小学 1 年生/ }).click();
  await page.getByRole("button", { name: /さんすう だけ/ }).click();
  await page.getByRole("button", { name: /足し算まで/ }).click();
  await markedNavigation;

  await page.waitForFunction(
    ({ countKey, expected }) => Number(sessionStorage.getItem(countKey) || "0") === expected,
    { countKey: LOAD_COUNT_KEY, expected: loadCountBefore + 1 },
    { timeout: STEP_TIMEOUT_MS },
  );
  await page.waitForFunction(() => location.hash === "#/explore", undefined, {
    timeout: STEP_TIMEOUT_MS,
  });

  assert(await getHashChangeCount(page) === 0, "React Router handoff unexpectedly relied on hashchange");
  assert(markerRequests.length === 1, `Expected one safe-router reload, got ${markerRequests.length}`);
};

const verifyProtectedRouterHandoff = async (page, markerRequests) => {
  const version = "protected-router-recovery";
  const markerCountBefore = markerRequests.length;
  await page.goto("/#/explore");
  const firstNumberKey = page.getByRole("button", { name: "1" }).first();
  await firstNumberKey.waitFor();
  await firstNumberKey.click();

  const loadCountBefore = await getLoadCount(page);
  const hashChangeCountBefore = await getHashChangeCount(page);
  await requestDeferredRecovery(page, version);
  await requestDeferredRecovery(page, version);
  await assertUpdateStillDeferred(
    page,
    loadCountBefore,
    markerRequests,
    markerCountBefore,
    RECOVERY_PROTECTION_WAIT_MS,
  );

  await setCriticalPersistence(page, true);
  const markedNavigation = waitForMarkedNavigation(page, version);
  await navigateWithReactRouter(page, "/study");
  await assertUpdateStillDeferred(
    page,
    loadCountBefore,
    markerRequests,
    markerCountBefore,
  );
  await setCriticalPersistence(page, false);
  await markedNavigation;
  await page.waitForFunction(
    ({ countKey, expected }) => Number(sessionStorage.getItem(countKey) || "0") === expected,
    { countKey: LOAD_COUNT_KEY, expected: loadCountBefore + 1 },
    { timeout: STEP_TIMEOUT_MS },
  );
  await page.waitForFunction(() => location.hash === "#/study", undefined, {
    timeout: STEP_TIMEOUT_MS,
  });

  assert(
    await getHashChangeCount(page) === hashChangeCountBefore,
    "Protected React Router handoff unexpectedly relied on hashchange",
  );
  assert(
    markerRequests.length === markerCountBefore + 1,
    `Expected one protected-router recovery reload, got ${markerRequests.length - markerCountBefore}`,
  );
};

const verifySameRouteBattleCheckpoint = async (page, markerRequests) => {
  const version = "battle-cancel";
  const markerCountBefore = markerRequests.length;
  await page.goto("/#/battle/play");
  await page.getByRole("button", { name: "スタート！" }).waitFor();

  const gradeButtons = page.getByRole("button", { name: "1ねんせい" });
  await gradeButtons.nth(0).click();
  await gradeButtons.nth(1).click();
  await page.getByRole("button", { name: "スタート！" }).click();
  await page.getByRole("button", { name: "✕ やめる" }).waitFor();

  const loadCountBefore = await getLoadCount(page);
  await requestDeferredUpdate(page, version);
  await requestDeferredUpdate(page, version);
  await assertUpdateStillDeferred(
    page,
    loadCountBefore,
    markerRequests,
    markerCountBefore,
  );

  const markedNavigation = waitForMarkedNavigation(page, version);
  await page.getByRole("button", { name: "✕ やめる" }).click();
  await markedNavigation;
  await page.waitForFunction(
    ({ countKey, expected }) => Number(sessionStorage.getItem(countKey) || "0") === expected,
    { countKey: LOAD_COUNT_KEY, expected: loadCountBefore + 1 },
    { timeout: STEP_TIMEOUT_MS },
  );
  await page.waitForFunction(() => location.hash === "#/battle/play", undefined, {
    timeout: STEP_TIMEOUT_MS,
  });

  assert(
    markerRequests.length === markerCountBefore + 1,
    `Expected one same-route checkpoint reload, got ${markerRequests.length - markerCountBefore}`,
  );
};

const main = async () => {
  if (!existsSync("dist/index.html")) {
    throw new Error("dist/index.html is missing. Run npm run build before e2e:pwa-update.");
  }

  let previewServer;
  let browser;

  try {
    const preview = await startDedicatedPreview();
    previewServer = preview.server;
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      baseURL: preview.baseUrl,
      reducedMotion: "reduce",
      serviceWorkers: "block",
      viewport: { width: 1024, height: 768 },
    });
    const page = await context.newPage();
    const markerRequests = [];
    page.on("request", (request) => {
      if (!request.isNavigationRequest() || request.frame() !== page.mainFrame()) return;
      if (new URL(request.url()).searchParams.has("__app-update")) {
        markerRequests.push(request.url());
      }
    });
    await installPwaE2EControl(page);

    await verifyOnboardingSafeHandoff(page, markerRequests);
    console.log("PASS PWA onboarding safe-router handoff");
    await verifyProtectedRouterHandoff(page, markerRequests);
    console.log("PASS PWA protected router recovery handoff");
    await verifySameRouteBattleCheckpoint(page, markerRequests);
    console.log("PASS PWA same-route battle checkpoint");

    await context.close();
  } finally {
    if (browser) await browser.close();
    if (previewServer) stopPreviewServer(previewServer);
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

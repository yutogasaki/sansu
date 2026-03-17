import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";

const HOST = "127.0.0.1";
const PORT_CANDIDATES = [4173, 4174, 4175];
const APP_TITLE_MARKER = "<title>Sansu App</title>";
const DEV_START_TIMEOUT_MS = 45_000;
const STEP_TIMEOUT_MS = 15_000;
const SCENARIO_TIMEOUT_MS = 60_000;
let activeBaseUrl = `http://${HOST}:${PORT_CANDIDATES[0]}`;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const buildBaseUrl = (port) => `http://${HOST}:${port}`;

const waitForHash = async (page, pattern) => {
  await page.waitForFunction(
    ({ source, flags }) => new RegExp(source, flags).test(window.location.hash),
    { source: pattern.source, flags: pattern.flags },
    { timeout: STEP_TIMEOUT_MS }
  );
};

const probeServer = async (url) => {
  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      return { reachable: true, expected: false };
    }
    const html = await res.text();
    return { reachable: true, expected: html.includes(APP_TITLE_MARKER) };
  } catch {
    return { reachable: false, expected: false };
  }
};

const waitForServer = async (url, timeoutMs) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { expected } = await probeServer(url);
    if (expected) {
      return;
    }
    await delay(500);
  }
  throw new Error(`Sansu dev server did not become ready within ${timeoutMs}ms: ${url}`);
};

const startDevServer = (port) => {
  const child = spawn(
    process.platform === "win32" ? "cmd.exe" : "sh",
    process.platform === "win32"
      ? ["/c", `npm run dev -- --host ${HOST} --port ${port} --strictPort`]
      : ["-c", `npm run dev -- --host ${HOST} --port ${port} --strictPort`],
    { stdio: "pipe", windowsHide: true }
  );

  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));

  return child;
};

const stopDevServer = (child) => {
  if (!child) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
};

const getServerSession = async () => {
  for (const port of PORT_CANDIDATES) {
    const url = buildBaseUrl(port);
    const probe = await probeServer(url);

    if (probe.expected) {
      console.log(`Using existing Sansu dev server on ${url}.`);
      return { baseUrl: url, devServer: null, startedByScript: false };
    }

    if (probe.reachable) {
      console.log(`Port ${port} is serving a different app. Skipping.`);
      continue;
    }

    console.log(`Starting dev server on ${url}...`);
    const devServer = startDevServer(port);

    try {
      await waitForServer(url, DEV_START_TIMEOUT_MS);
      console.log(`Dev server ready on ${url}.`);
      return { baseUrl: url, devServer, startedByScript: true };
    } catch (error) {
      stopDevServer(devServer);
      throw error;
    }
  }

  throw new Error(`Unable to find a free port for Sansu dev server. Tried: ${PORT_CANDIDATES.join(", ")}`);
};

const clearClientStorage = async (page) => {
  await page.addInitScript(() => {
    localStorage.clear();
    try {
      indexedDB.deleteDatabase("SansuDatabase");
    } catch {
      // ignore
    }
  });
};

const runScenario = async (name, fn) => {
  const started = Date.now();
  let timeoutId;
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`timeout after ${SCENARIO_TIMEOUT_MS}ms`));
        }, SCENARIO_TIMEOUT_MS);
      }),
    ]);
    console.log(`PASS ${name} (${Date.now() - started}ms)`);
    return true;
  } catch (err) {
    console.error(`FAIL ${name}:`, err instanceof Error ? err.message : err);
    return false;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const completeOnboarding = async (page) => {
  await page.goto("/#/onboarding", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "はじめる" }).click();
  await page.getByPlaceholder("あだ名でOK").fill("E2E");
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByRole("button", { name: /小学 1 年生/ }).click();
  await page.getByRole("button", { name: /さんすう だけ/ }).click();
  await page.getByRole("button", { name: /数をかぞえる・くらべる/ }).click();
  await waitForHash(page, /#\/$/);
};

const waitForHomeReady = async (page) => {
  await page.getByRole("button", { name: "まなぶ" }).waitFor({ timeout: STEP_TIMEOUT_MS });
};

const scenarioOnboardingShown = async (browser) => {
  const context = await browser.newContext({ baseURL: activeBaseUrl });
  const page = await context.newPage();
  await clearClientStorage(page);

  await page.goto("/#/", { waitUntil: "domcontentloaded" });
  await waitForHash(page, /#\/onboarding/);
  await page.getByRole("button", { name: "はじめる" }).waitFor({ timeout: STEP_TIMEOUT_MS });

  await context.close();
};

const scenarioOnboardingToHome = async (browser) => {
  const context = await browser.newContext({ baseURL: activeBaseUrl });
  const page = await context.newPage();
  await clearClientStorage(page);

  await completeOnboarding(page);
  await waitForHomeReady(page);

  await context.close();
};

const scenarioHomeToStudy = async (browser) => {
  const context = await browser.newContext({ baseURL: activeBaseUrl });
  const page = await context.newPage();
  await clearClientStorage(page);

  await completeOnboarding(page);
  await waitForHomeReady(page);
  await Promise.all([
    waitForHash(page, /#\/study/),
    page.getByRole("button", { name: "まなぶ" }).click(),
  ]);
  await page.getByText(/問目/).first().waitFor({ timeout: STEP_TIMEOUT_MS });

  await context.close();
};

const scenarioHomeToSettings = async (browser) => {
  const context = await browser.newContext({ baseURL: activeBaseUrl });
  const page = await context.newPage();
  await clearClientStorage(page);

  await completeOnboarding(page);
  await waitForHomeReady(page);
  await Promise.all([
    waitForHash(page, /#\/settings/),
    page.getByRole("button", { name: /せってい/i }).click(),
  ]);
  await page.getByText(/設定|せってい/).first().waitFor({ timeout: STEP_TIMEOUT_MS });

  await context.close();
};

const scenarioAlbumDetailModal = async (browser) => {
  const context = await browser.newContext({ baseURL: activeBaseUrl });
  const page = await context.newPage();
  await clearClientStorage(page);

  await completeOnboarding(page);
  await page.evaluate(() => {
    localStorage.setItem(
      "sansu_ikimono_gallery",
      JSON.stringify([
        {
          profileId: localStorage.getItem("sansu_active_profile"),
          generation: 1,
          name: "もこ",
          birthDate: "2026-01-01T00:00:00.000Z",
          departedDate: "2026-01-29T00:00:00.000Z",
          species: 2,
        },
      ]),
    );
  });

  await Promise.all([
    waitForHash(page, /#\/stats/),
    page.getByRole("button", { name: /きろく/i }).click(),
  ]);

  await page.getByRole("button", { name: /もこ の ふわふわを みる/ }).click();
  await page.getByRole("heading", { name: "もこ" }).waitFor({ timeout: STEP_TIMEOUT_MS });
  await page.getByRole("button", { name: "また みにくる" }).waitFor({ timeout: STEP_TIMEOUT_MS });

  await context.close();
};

const scenarioParentsGateShown = async (browser) => {
  const context = await browser.newContext({ baseURL: activeBaseUrl });
  const page = await context.newPage();

  await page.addInitScript(() => {
    localStorage.setItem("sansu_active_profile", "fake-profile-id");
  });

  await page.goto("/#/parents", { waitUntil: "domcontentloaded" });
  await page.getByText("ほごしゃ かくにん").waitFor({ timeout: STEP_TIMEOUT_MS });
  await page.getByRole("button", { name: "やめる" }).click();
  await waitForHash(page, /#\/(settings|onboarding)/);

  await context.close();
};

const main = async () => {
  let devServer;
  let startedByScript = false;
  let browser;

  try {
    const session = await getServerSession();
    activeBaseUrl = session.baseUrl;
    devServer = session.devServer;
    startedByScript = session.startedByScript;

    browser = await chromium.launch({ headless: true });

    const results = [];
    results.push(await runScenario("redirects to onboarding when no profile", () => scenarioOnboardingShown(browser)));
    results.push(await runScenario("completes onboarding and lands on home", () => scenarioOnboardingToHome(browser)));
    results.push(await runScenario("starts study from home", () => scenarioHomeToStudy(browser)));
    results.push(await runScenario("opens settings from footer", () => scenarioHomeToSettings(browser)));
    results.push(await runScenario("opens fuwafuwa album detail from stats", () => scenarioAlbumDetailModal(browser)));
    results.push(await runScenario("guards /parents route behind parent gate", () => scenarioParentsGateShown(browser)));

    const ok = results.every(Boolean);
    if (!ok) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (startedByScript && devServer) stopDevServer(devServer);
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";

const BASE_URL = "http://127.0.0.1:4173";
const DEV_START_TIMEOUT_MS = 45_000;
const STEP_TIMEOUT_MS = 15_000;
const SCENARIO_TIMEOUT_MS = 60_000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const waitForServer = async (url, timeoutMs) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return;
    } catch {
      // retry
    }
    await delay(500);
  }
  throw new Error(`Dev server did not become ready within ${timeoutMs}ms: ${url}`);
};

const startDevServer = () => {
  const child = spawn(
    process.platform === "win32" ? "cmd.exe" : "sh",
    process.platform === "win32"
      ? ["/c", "npm run dev -- --host 127.0.0.1 --port 4173 --strictPort"]
      : ["-c", "npm run dev -- --host 127.0.0.1 --port 4173 --strictPort"],
    { stdio: "pipe", windowsHide: true }
  );

  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));

  return child;
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
  try {
    await Promise.race([
      fn(),
      (async () => {
        await delay(SCENARIO_TIMEOUT_MS);
        throw new Error(`timeout after ${SCENARIO_TIMEOUT_MS}ms`);
      })(),
    ]);
    console.log(`PASS ${name} (${Date.now() - started}ms)`);
    return true;
  } catch (err) {
    console.error(`FAIL ${name}:`, err instanceof Error ? err.message : err);
    return false;
  }
};

const scenarioOnboardingShown = async (browser) => {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await clearClientStorage(page);

  await page.goto("/#/", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/#\/onboarding/, { timeout: STEP_TIMEOUT_MS });
  await page.getByRole("button", { name: "はじめる" }).waitFor({ timeout: STEP_TIMEOUT_MS });

  await context.close();
};

const scenarioOnboardingToHome = async (browser) => {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  await clearClientStorage(page);

  await page.goto("/#/onboarding", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "はじめる" }).click();
  await page.getByPlaceholder("あだ名でOK").fill("E2E");
  await page.getByRole("button", { name: "次へ" }).click();

  await page.getByRole("button", { name: /小学 1 年生/ }).click();
  await page.getByRole("button", { name: /さんすう だけ/ }).click();
  await page.getByRole("button", { name: /数をかぞえる・くらべる/ }).click();

  await page.waitForURL(/#\/$/, { timeout: STEP_TIMEOUT_MS });
  await page.getByRole("button", { name: /この子と進む|このこ と すすむ/ }).waitFor({ timeout: STEP_TIMEOUT_MS });

  await context.close();
};

const scenarioParentsGateShown = async (browser) => {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();

  await page.addInitScript(() => {
    localStorage.setItem("sansu_active_profile", "fake-profile-id");
  });

  await page.goto("/#/parents", { waitUntil: "domcontentloaded" });
  await page.getByText("ほごしゃ かくにん").waitFor({ timeout: STEP_TIMEOUT_MS });
  await page.getByRole("button", { name: "やめる" }).click();
  await page.waitForURL(/#\/(settings|onboarding)/, { timeout: STEP_TIMEOUT_MS });

  await context.close();
};

const main = async () => {
  let devServer;
  let startedByScript = false;
  let browser;

  try {
    try {
      const res = await fetch(BASE_URL);
      if (!res.ok) throw new Error("not-ready");
      console.log("Using existing dev server.");
    } catch {
      console.log("Starting dev server...");
      devServer = startDevServer();
      startedByScript = true;
      await waitForServer(BASE_URL, DEV_START_TIMEOUT_MS);
      console.log("Dev server ready.");
    }

    browser = await chromium.launch({ headless: true });

    const results = [];
    results.push(await runScenario("redirects to onboarding when no profile", () => scenarioOnboardingShown(browser)));
    results.push(await runScenario("completes onboarding and lands on home", () => scenarioOnboardingToHome(browser)));
    results.push(await runScenario("guards /parents route behind parent gate", () => scenarioParentsGateShown(browser)));

    const ok = results.every(Boolean);
    if (!ok) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (startedByScript && devServer) {
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(devServer.pid), "/t", "/f"], { stdio: "ignore" });
      } else {
        devServer.kill("SIGTERM");
      }
    }
  }
};

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

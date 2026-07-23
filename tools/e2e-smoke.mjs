import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const HOST = "127.0.0.1";
const PORT_CANDIDATES = [4173, 4174, 4175];
const APP_TITLE_MARKER = "<title>ポッコのふしぎずかん</title>";
const DEV_START_TIMEOUT_MS = 45_000;
const STEP_TIMEOUT_MS = 15_000;
const SCENARIO_TIMEOUT_MS = 60_000;
const RAPID_LOOP_CI_BUDGET_MS = 1_500;
const RAPID_LOOP_CORRECT_PRODUCT_BUDGET_MS = 650;
const RAPID_LOOP_INCORRECT_PRODUCT_BUDGET_MS = 550;
const WRITE_VISUAL_AUDIT = process.env.SANSU_WRITE_VISUAL_AUDIT === "1";
const VISUAL_AUDIT_MODE = process.argv.includes("--visual-audit");
const VISUAL_AUDIT_EXPECTED_REVISION = process.env.SANSU_VISUAL_AUDIT_EXPECTED_REVISION;
const VISUAL_AUDIT_BUILD_PROVENANCE_PATH =
  process.env.SANSU_VISUAL_AUDIT_BUILD_PROVENANCE_PATH;
const VISUAL_AUDIT_TARGET_ATTESTATION_FILE = "sansu-visual-audit-target.json";
const VISUAL_AUDIT_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
];
const VISUAL_AUDIT_STAGE_ORDER = [
  "cold-launch",
  "ready",
  "dig-one",
  "dig-two",
  "popped",
  "route-choice",
  "q4-ordinary",
  "major-encounter-idle",
  "major-encounter-correct",
  "q7-before",
  "q7-observation",
  "field-book",
  "q8",
  "return",
  "relaunch",
  "base",
];
const VISUAL_AUDIT_SETTLE_TIMEOUT_MS = 5_000;
const PAINTED_ENCOUNTER_FOCALS = {
  "explore-encounter-light-bridge:light-bridge-idle": {
    actorFace: [170, 1080],
    actorFeet: [170, 1230],
    actionPayoff: [390, 750],
  },
  "explore-encounter-light-bridge:light-bridge-complete": {
    actorFace: [170, 1080],
    actorFeet: [170, 1230],
    actionPayoff: [390, 750],
  },
  "explore-encounter-light-bridge:light-bridge-crossed": {
    actorFace: [420, 690],
    actorFeet: [420, 805],
    actionPayoff: [390, 750],
  },
  "explore-encounter-root-tangle:root-tangle-tangled": {
    actorFace: [220, 1080],
    actorFeet: [220, 1230],
    actionPayoff: [390, 700],
  },
  "explore-encounter-root-tangle:root-tangle-crossed": {
    actorFace: [440, 1110],
    actorFeet: [430, 1215],
    actionPayoff: [390, 900],
  },
};
const ROOT_TANGLE_OBSERVATION_FOCALS =
  PAINTED_ENCOUNTER_FOCALS["explore-encounter-root-tangle:root-tangle-crossed"];
const FIREFLY_PAINTED_STAGE_CONTRACT = {
  waiting: {
    asset: "/assets/explore/firefly-flower/scene-waiting-pokko-v2.jpg",
    actorFace: [220, 560],
    actorFeet: [220, 635],
    actionPayoff: [585, 320],
  },
  "dew-trail": {
    asset: "/assets/explore/firefly-flower/scene-dew-trail-pokko-v2.jpg",
    actorFace: [220, 555],
    actorFeet: [220, 625],
    actionPayoff: [405, 560],
  },
  "warm-bud": {
    asset: "/assets/explore/firefly-flower/scene-warm-bud-pokko-v2.jpg",
    actorFace: [220, 555],
    actorFeet: [220, 625],
    actionPayoff: [570, 315],
  },
  "ringing-petals": {
    asset: "/assets/explore/firefly-flower/scene-ringing-petals-pokko-v2.jpg",
    actorFace: [220, 555],
    actorFeet: [220, 625],
    actionPayoff: [565, 360],
  },
};
const REQUIRED_VISUAL_ASSET_SHA256 = {
  "/assets/explore/light-bridge/scene-idle-leaf-pokko-v5.jpg":
    "ee53836b54cb2437647cac86ee90a8156432c194ec70488be166a6831e7bd898",
  "/assets/explore/light-bridge/scene-complete-leaf-pokko-v5.jpg":
    "98a473dc1cd432a3684a5f3e42fc34154566a75ee2f925e0011662ea274ca357",
  "/assets/explore/light-bridge/scene-crossed-leaf-pokko-v5.jpg":
    "853f9537b7dad34aceff142378a0ae728e3868a76075780969cfc205a963e785",
  "/assets/explore/root-tangle/scene-tangled-pokko-v4.jpg":
    "665f97d12bdb3da0889038e13c67ee140692e2cf942acf128283fcab78ec9ef2",
  "/assets/explore/root-tangle/scene-open-pokko-v4.jpg":
    "4f9c76f483c1b1414dce6e45f7773a0c1492c227d7c194ae73bca3d57c4e0dc8",
  "/assets/explore/root-tangle/scene-crossed-light-path-pokko-v5.jpg":
    "78b1cc26bff82c73bfe4b42663cef6358f4d72a2561908011ee5d9d4ea45c1f5",
  "/assets/explore/route-choice/scene-fork-two-pokko-v1.jpg":
    "b5ad845b04ffb238a7e701045941b895cec9b090fd3da3b46ab9dc2e51153438",
  "/assets/explore/route-choice/scene-fork-three-pokko-v1.jpg":
    "781c922d55e398caf686189193ff523409140647687e9ad4123ff9ccdb3d029e",
  "/assets/explore/firefly-flower/scene-waiting-pokko-v2.jpg":
    "2d96afa4d80565e30f841055b30718dcd58ee12a3207f73fec2876ef8493090f",
  "/assets/explore/firefly-flower/scene-dew-trail-pokko-v2.jpg":
    "982b357d69a1eea639fbce74b0bde18a4de095170a23c98b2e7aff3c1096c5ef",
  "/assets/explore/firefly-flower/scene-warm-bud-pokko-v2.jpg":
    "3ca693589f8086182224eb0e8056940721e94cc1f90c4eb1ed3997269b3f7df7",
  "/assets/explore/firefly-flower/scene-ringing-petals-pokko-v2.jpg":
    "bb78fd27b1fa3c892232f1c5b2881d531ce98518c8fb3a0cafececd7158fa49c",
};
const LEGACY_VISUAL_AUDIT_DIR = path.resolve(
  "docs/design/breakout-loop-2026-07-21/runtime-painted-v2-audit",
);
let activeBaseUrl = `http://${HOST}:${PORT_CANDIDATES[0]}`;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const writeVisualAuditScreenshot = async (page, path) => {
  if (!WRITE_VISUAL_AUDIT) return;
  await page.screenshot({ path });
};

const buildBaseUrl = (port) => `http://${HOST}:${port}`;

const waitForHash = async (page, pattern) => {
  await page.waitForFunction(
    ({ source, flags }) => new RegExp(source, flags).test(window.location.hash),
    { source: pattern.source, flags: pattern.flags },
    { timeout: STEP_TIMEOUT_MS }
  );
};

const waitForExploreEnergy = async (page, expectedEnergy) => {
  await page.waitForFunction(
    (expected) => Number(
      document.querySelector('[role="progressbar"][aria-label="ひかり"]')
        ?.getAttribute("aria-valuenow"),
    ) === expected,
    expectedEnergy,
    { timeout: STEP_TIMEOUT_MS },
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
  throw new Error(`Pokko dev server did not become ready within ${timeoutMs}ms: ${url}`);
};

const startDevServer = (port) => {
  const child = spawn(
    process.platform === "win32" ? "cmd.exe" : "sh",
    process.platform === "win32"
      ? ["/c", `npm run dev -- --host ${HOST} --port ${port} --strictPort`]
      : ["-c", `npm run dev -- --host ${HOST} --port ${port} --strictPort`],
    {
      stdio: "pipe",
      windowsHide: true,
      // The regression suite owns the classic baseline explicitly. Local
      // development can default to the active Root Pull validation candidate
      // without silently changing the suite's expected opening contract.
      env: { ...process.env, VITE_EXPLORE_EXPERIENCE: "classic-v1" },
    }
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
  let reusableServerUrl = null;

  for (const port of PORT_CANDIDATES) {
    const url = buildBaseUrl(port);
    const probe = await probeServer(url);

    if (probe.expected) {
      reusableServerUrl ||= url;
      console.log(`Pokko is already running on ${url}; looking for a dedicated smoke-test port.`);
      continue;
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

  if (reusableServerUrl) {
    console.log(`All smoke-test ports are occupied; reusing ${reusableServerUrl}.`);
    return { baseUrl: reusableServerUrl, devServer: null, startedByScript: false };
  }

  throw new Error(`Unable to find a free port for Pokko dev server. Tried: ${PORT_CANDIDATES.join(", ")}`);
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

const countIndexedDbRows = async (page, storeName) => page.evaluate((requestedStore) => (
  new Promise((resolve, reject) => {
    const request = indexedDB.open("SansuDatabase");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(requestedStore, "readonly");
      const countRequest = transaction.objectStore(requestedStore).count();
      countRequest.onerror = () => reject(countRequest.error);
      countRequest.onsuccess = () => resolve(countRequest.result);
      transaction.oncomplete = () => database.close();
    };
  })
), storeName);

const clearIndexedDbRows = async (page, storeName) => page.evaluate((requestedStore) => (
  new Promise((resolve, reject) => {
    const request = indexedDB.open("SansuDatabase");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(requestedStore, "readwrite");
      const clearRequest = transaction.objectStore(requestedStore).clear();
      clearRequest.onerror = () => reject(clearRequest.error);
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
    };
  })
), storeName);

const seedDueMathSkills = async (page, skillIds) => page.evaluate((requestedSkillIds) => (
  new Promise((resolve, reject) => {
    const request = indexedDB.open("SansuDatabase");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(["profiles", "memoryMath"], "readwrite");
      const profilesRequest = transaction.objectStore("profiles").getAll();
      profilesRequest.onerror = () => reject(profilesRequest.error);
      profilesRequest.onsuccess = () => {
        const profile = profilesRequest.result[0];
        if (!profile?.id) {
          reject(new Error("active E2E profile was not found"));
          return;
        }
        const dueAt = "2000-01-01T00:00:00.000Z";
        const memory = transaction.objectStore("memoryMath");
        requestedSkillIds.forEach((id) => memory.put({
          profileId: profile.id,
          id,
          strength: 1,
          nextReview: dueAt,
          totalAnswers: 1,
          correctAnswers: 0,
          incorrectAnswers: 1,
          skippedAnswers: 0,
          updatedAt: dueAt,
          status: "active",
          isWeak: false,
        }));
      };
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
    };
  })
), skillIds);

const readExplorePersistenceSnapshot = async (page) => page.evaluate(() => (
  new Promise((resolve, reject) => {
    const request = indexedDB.open("SansuDatabase");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(["exploreRuns", "exploreRunEvents"], "readonly");
      const runsRequest = transaction.objectStore("exploreRuns").getAll();
      const eventsRequest = transaction.objectStore("exploreRunEvents").getAll();
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => {
        resolve({ runs: runsRequest.result, events: eventsRequest.result });
        database.close();
      };
    };
  })
));

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
    console.error(`FAIL ${name}:`, err instanceof Error ? err.stack ?? err.message : err);
    return false;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const completeOnboarding = async (
  page,
  mathCheck = /数をかぞえる・くらべる/,
  gradeCheck = /小学 1 年生/,
  openingExperience,
) => {
  const openingSearch = openingExperience
    ? `/?explore_experience=${encodeURIComponent(openingExperience)}`
    : "/";
  await page.goto(`${openingSearch}#/onboarding`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "はじめる" }).click();
  await page.getByPlaceholder("あだ名でOK").fill("E2E");
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByRole("button", { name: gradeCheck }).click();
  await page.getByRole("button", { name: /さんすう だけ/ }).click();
  await page.getByRole("button", { name: mathCheck }).click();
  await waitForHash(page, /#\/explore$/);
};

const waitForExploreFirstProblemReady = async (page, openingArtSelector = ".makimodon-art") => {
  await waitForHash(page, /#\/explore$/);
  await page.locator("#explore-problem-title").waitFor({ timeout: STEP_TIMEOUT_MS });
  const attempt = page.getByTestId("explore-attempt");
  await attempt.waitFor({ timeout: STEP_TIMEOUT_MS });
  assert(
    await attempt.getAttribute("data-attempt-number") === "1",
    "the zero-tap opening should expose the first playable problem",
  );
  assert(
    await page.locator("#explore-path-choice-title").count() === 0,
    "the fixed cold open should not ask the child to choose a route that it cannot honor",
  );
  assert(
    await page.locator(".explore-route-card").count() === 0,
    "the fixed cold open should not flash route cards before its first problem",
  );
  assert(
    await page.locator(".explore-world").getAttribute("data-run-steps") === "0",
    "the first problem should remain the first run step",
  );
  assert(await page.locator("#explore-intro-title").count() === 0, "launch should skip the old explore intro");
  assert(
    await page.locator(openingArtSelector).isVisible(),
    `the first problem should expose its fixed opening art (${openingArtSelector})`,
  );
};

const navigateHash = async (page, hash, pattern) => {
  await page.evaluate((nextHash) => {
    window.location.hash = nextHash;
  }, hash);
  await waitForHash(page, pattern);
};

const waitForStudyReady = async (page) => {
  await page.getByText(/問目/).first().waitFor({ timeout: STEP_TIMEOUT_MS });
};

const completeSessionBySkipping = async (page, totalQuestions) => {
  for (let index = 0; index < totalQuestions; index += 1) {
    await page.getByRole("button", { name: /スキップ/ }).waitFor({ timeout: STEP_TIMEOUT_MS });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /次へ/ }).waitFor({ timeout: STEP_TIMEOUT_MS });
    await page.getByRole("button", { name: /次へ/ }).click();

    if (index < totalQuestions - 1) {
      await page.getByRole("button", { name: /スキップ/ }).waitFor({ timeout: STEP_TIMEOUT_MS });
    }
  }
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

const scenarioOnboardingToExploreProblem = async (browser, viewport) => {
  const context = await browser.newContext({
    baseURL: activeBaseUrl,
    ...(viewport ? { viewport } : {}),
  });
  const page = await context.newPage();
  await clearClientStorage(page);

  await completeOnboarding(page);
  await waitForExploreFirstProblemReady(page);
  if (viewport) {
    await assertExploreProblemViewportFit(page, viewport);
  }

  await context.close();
};

const scenarioStudyRoute = async (browser) => {
  const context = await browser.newContext({ baseURL: activeBaseUrl });
  const page = await context.newPage();
  await clearClientStorage(page);

  await completeOnboarding(page);
  await navigateHash(page, "/study", /#\/study/);
  await waitForStudyReady(page);
  await page.getByRole("button", { name: "スキップ", exact: true }).dblclick();
  await page.getByText(/スキップOK|とばして だいじょうぶ/).waitFor({ timeout: STEP_TIMEOUT_MS });
  const attemptCount = await countIndexedDbRows(page, "logs");
  assert(attemptCount === 1, `double submit should persist one attempt; got ${attemptCount}`);
  await page.getByRole("button", { name: /次へ|つぎへ/ }).click();
  await waitForStudyReady(page);

  await context.close();
};

const scenarioReviewRoute = async (browser) => {
  const context = await browser.newContext({ baseURL: activeBaseUrl });
  const page = await context.newPage();
  await clearClientStorage(page);

  await completeOnboarding(page);
  await navigateHash(
    page,
    "/study?session=review&force_review=1",
    /#\/study\?session=review&force_review=1/,
  );
  await waitForStudyReady(page);

  await context.close();
};

const scenarioSettingsRoute = async (browser) => {
  const context = await browser.newContext({ baseURL: activeBaseUrl });
  const page = await context.newPage();
  await clearClientStorage(page);

  await completeOnboarding(page);
  await navigateHash(page, "/settings", /#\/settings/);
  await page.getByText(/設定|せってい/).first().waitFor({ timeout: STEP_TIMEOUT_MS });

  await context.close();
};

const scenarioLegacyAlbumHidden = async (browser) => {
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

  await navigateHash(page, "/stats", /#\/stats/);

  await page.getByRole("button", { name: /もっと(?:\s*みる|見る)/ }).click();
  assert(
    await page.getByText(/ふわふわ アルバム/).count() === 0,
    "legacy fuwafuwa album should stay out of the child-facing records screen until art integration is complete",
  );

  await context.close();
};

const scenarioStatsToPeriodicTest = async (browser) => {
  const context = await browser.newContext({ baseURL: activeBaseUrl });
  const page = await context.newPage();
  await clearClientStorage(page);

  await completeOnboarding(page);
  await page.evaluate(() => {
    localStorage.setItem("sansu_event_check_pending", "1");
  });

  await navigateHash(page, "/stats", /#\/stats/);

  await Promise.all([
    waitForHash(page, /#\/study\?session=periodic-test/),
    page.getByRole("button", { name: /挑戦|ちょうせん/ }).click(),
  ]);
  await waitForStudyReady(page);
  await completeSessionBySkipping(page, 20);
  await page.getByRole("button", { name: /記録を見る|きろく を みる/ }).waitFor({ timeout: STEP_TIMEOUT_MS });
  await Promise.all([
    waitForHash(page, /#\/stats/),
    page.getByRole("button", { name: /記録を見る|きろく を みる/ }).click(),
  ]);

  await context.close();
};

const scenarioExploreLaunchAndReturn = async (browser, viewport) => {
  const context = await browser.newContext({
    baseURL: activeBaseUrl,
    reducedMotion: "reduce",
    ...(viewport ? { viewport } : {}),
  });
  const page = await context.newPage();
  await clearClientStorage(page);

  await completeOnboarding(page, /足し算まで/);
  await waitForExploreFirstProblemReady(page);
  const returningRunId = await page.locator(".explore-world").getAttribute("data-run-id");
  await solveMakimodonOpening(page);
  if (viewport) {
    const routeLayout = await page.locator(".explore-path-choice").evaluate((element) => {
      const art = element.querySelector(".explore-route-fork-art-frame");
      const returnAction = element.querySelector(".explore-path-return");
      const artBounds = art?.getBoundingClientRect();
      const returnBounds = returnAction?.getBoundingClientRect();
      return {
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        art: artBounds ? {
          display: window.getComputedStyle(art).display,
          top: artBounds.top,
          bottom: artBounds.bottom,
          height: artBounds.height,
        } : null,
        returnAction: returnBounds ? {
          top: returnBounds.top,
          bottom: returnBounds.bottom,
          height: returnBounds.height,
        } : null,
        viewportHeight: window.innerHeight,
      };
    });
    assert(
      routeLayout.scrollHeight <= routeLayout.clientHeight + 1,
      `${viewport.width}x${viewport.height} route choice must not need internal scroll: ${JSON.stringify(routeLayout)}`,
    );
    assert(
      routeLayout.art?.display !== "none"
        && routeLayout.art.height >= 140
        && routeLayout.art.bottom <= viewport.height,
      `${viewport.width}x${viewport.height} route art must remain visible: ${JSON.stringify(routeLayout)}`,
    );
    assert(
      routeLayout.returnAction?.bottom <= viewport.height,
      `${viewport.width}x${viewport.height} route return action must remain visible: ${JSON.stringify(routeLayout)}`,
    );
  }
  await page.getByRole("button", { name: "ここまでを ノートに のこす" }).click();
  await page.locator("#return-summary-title").waitFor({ timeout: STEP_TIMEOUT_MS });
  const returnSnapshot = await readExplorePersistenceSnapshot(page);
  const returnedRun = returnSnapshot.runs.find((candidate) => candidate.runId === returningRunId);
  const returnedEvents = returnSnapshot.events.filter((event) => (
    event.runId === returningRunId && event.type === "run_ended"
  ));
  assert(returnedRun?.status === "returned", `route-break return should finish returned; got ${returnedRun?.status}`);
  assert(returnedEvents.length === 1, `route-break return should write one end event; got ${returnedEvents.length}`);
  assert(returnedEvents[0].payload?.status === "returned", "route-break receipt should preserve returned meaning");
  await page.getByRole("button", { name: "あそびメニューへ" }).click();
  await waitForHash(page, /#\/battle/);

  await context.close();
};

const scenarioRootPullV2Opening = async (browser) => {
  const context = await browser.newContext({
    baseURL: activeBaseUrl,
    reducedMotion: "reduce",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await clearClientStorage(page);

  await completeOnboarding(
    page,
    /足し算まで/,
    /小学 1 年生/,
    "root-pull-v2",
  );
  const world = page.locator(".explore-world");
  assert(
    await world.getAttribute("data-opening-experience") === "root-pull-v2",
    "the validation URL should hold Root Pull v2 for the full UI run",
  );
  await waitForExploreFirstProblemReady(page, ".root-pull-opening-art");

  const rootPullArt = page.locator(".root-pull-opening-art");
  await rootPullArt.waitFor({ timeout: STEP_TIMEOUT_MS });
  assert(await rootPullArt.getAttribute("data-asset-set") === "v2", "Root Pull should request v2 art");
  assert(
    await rootPullArt.getAttribute("data-reduced-motion") === "true",
    "Root Pull v2 should preserve physical states under reduced motion",
  );
  for (const digit of ["1", "2", "3"]) {
    assert(
      await page.getByRole("button", { name: digit, exact: true }).isVisible(),
      `Root Pull v2 should keep numeric key ${digit}`,
    );
  }

  const expectedRestingStages = ["small-pull", "bigger-pull"];
  for (const expectedStage of expectedRestingStages) {
    const attemptKey = await page.getByTestId("explore-attempt").getAttribute("data-attempt-key");
    assert(attemptKey, `Root Pull ${expectedStage} should start from an identified attempt`);
    await solveExploreNumericProblem(page);
    await waitForNewExploreAttempt(page, attemptKey);
    assert(
      await rootPullArt.getAttribute("data-stage") === expectedStage,
      `Root Pull should settle on ${expectedStage} before the next answer`,
    );
  }

  await solveExploreNumericProblem(page);
  await page.locator('.root-pull-opening-art[data-stage="comic-release"]')
    .waitFor({ timeout: RAPID_LOOP_CI_BUDGET_MS });
  const payoffVariant = await rootPullArt.getAttribute("data-payoff-variant");
  assert(
    payoffVariant === "dirt-hat" || payoffVariant === "leaf-hat",
    `Root Pull v2 should expose one authored payoff variant; got ${payoffVariant}`,
  );
  await waitForExploreRouteBreak(page);
  assert(await page.getByRole("dialog").count() === 0, "inline payoff should not open a dialog");
  assert(
    await page.getByRole("button", { name: /つぎの しかけへ/ }).count() === 0,
    "inline payoff should not add an explanatory continue action",
  );

  await context.close();
};

const submitExploreAndMeasureOperable = async (
  page,
  previousAttemptKey,
  productBudgetMs,
  { viaKeyboard = false } = {},
) => {
  const submit = page.getByRole("button", { name: "こたえる" });
  if (viaKeyboard) {
    await page.evaluate(() => {
      window.__SANSU_E2E_SUBMITTED_AT__ = performance.now();
    });
    await page.keyboard.press("Enter");
  } else {
    await submit.evaluate((button) => {
      window.__SANSU_E2E_SUBMITTED_AT__ = performance.now();
      button.click();
    });
  }
  await page.waitForFunction(
    (priorKey) => {
      const attempt = document.querySelector('[data-testid="explore-attempt"]');
      const encounter = document.querySelector('.explore-immersive[data-state="idle"]');
      const digit = [...document.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === "1",
      );
      return attempt instanceof HTMLElement
        && attempt.dataset.attemptKey
        && attempt.dataset.attemptKey !== priorKey
        && attempt.dataset.saveState === "idle"
        && encounter instanceof HTMLElement
        && digit instanceof HTMLButtonElement
        && !digit.disabled;
    },
    previousAttemptKey,
    { timeout: RAPID_LOOP_CI_BUDGET_MS },
  );
  const elapsed = await page.evaluate(() => (
    performance.now() - window.__SANSU_E2E_SUBMITTED_AT__
  ));
  assert(
    elapsed <= productBudgetMs,
    `answer should become operable within ${productBudgetMs}ms; got ${Math.round(elapsed)}ms`,
  );
  return elapsed;
};

const assertSnapRootViewportFit = async (page, viewport, { requireTappable = true } = {}) => {
  const fit = await page.evaluate(() => {
    const art = document.querySelector('.snap-root-opening-art');
    const keypad = document.querySelector('.explore-immersive-keypad-shell');
    const submit = [...document.querySelectorAll("button")].find(
      (button) => button.getAttribute("aria-label") === "こたえる",
    );
    const digits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
      [...document.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === digit,
      )
    ));
    const rect = (element) => element?.getBoundingClientRect();
    return {
      art: rect(art),
      keypad: rect(keypad),
      submit: rect(submit),
      digits: digits.map(rect),
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      digitHit: digits.map((button) => {
        if (!(button instanceof HTMLButtonElement)) return false;
        const bounds = button.getBoundingClientRect();
        return document.elementFromPoint(
          bounds.left + bounds.width / 2,
          bounds.top + bounds.height / 2,
        ) === button;
      }),
    };
  });
  assert(fit.innerWidth === viewport.width, `expected ${viewport.width}px width; got ${fit.innerWidth}`);
  assert(fit.innerHeight === viewport.height, `expected ${viewport.height}px height; got ${fit.innerHeight}`);
  assert(fit.scrollWidth <= fit.innerWidth, `Snap Root should not overflow horizontally: ${JSON.stringify(fit)}`);
  for (const [name, rect] of [["art", fit.art], ["keypad", fit.keypad], ["submit", fit.submit]]) {
    assert(rect && rect.top >= 0 && rect.bottom <= fit.innerHeight, `${name} should fit: ${JSON.stringify(fit)}`);
  }
  if (requireTappable) {
    assert(fit.digitHit.every(Boolean), `TenKey 0-9 centers should be tappable: ${JSON.stringify(fit)}`);
  }
};

const assertExploreProblemViewportFit = async (page, viewport) => {
  const fit = await page.evaluate(() => {
    const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect();
    const controls = [
      ...["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
        [...document.querySelectorAll("button")].find(
          (button) => button.textContent?.trim() === digit,
        )?.getBoundingClientRect()
      )),
      [...document.querySelectorAll("button")].find(
        (button) => button.getAttribute("aria-label") === "こたえる",
      )?.getBoundingClientRect(),
    ];

    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      grid: rect(".explore-run-grid"),
      action: rect(".explore-action-region"),
      encounter: rect(".explore-immersive"),
      keypad: rect(".explore-immersive-keypad-shell"),
      controls,
    };
  });

  assert(
    fit.innerWidth === viewport.width && fit.innerHeight === viewport.height,
    `expected ${viewport.width}x${viewport.height}; got ${fit.innerWidth}x${fit.innerHeight}`,
  );
  for (const [name, rect] of [
    ["grid", fit.grid],
    ["action", fit.action],
    ["encounter", fit.encounter],
    ["keypad", fit.keypad],
  ]) {
    assert(
      rect && rect.top >= -1 && rect.bottom <= fit.innerHeight + 1,
      `${name} should fit the short exploration viewport: ${JSON.stringify(fit)}`,
    );
  }
  assert(
    fit.encounter.height >= fit.innerHeight - 1,
    `rapid problem should keep the full grid row: ${JSON.stringify(fit)}`,
  );
  assert(
    fit.controls.every(
      (rect) => rect && rect.top >= 0 && rect.bottom <= fit.innerHeight + 1,
    ),
    `TenKey controls should stay visible in the short exploration viewport: ${JSON.stringify(fit)}`,
  );
};

const assertSnapRootPaintedResolution = async (page, viewport) => {
  const result = await page.locator(".snap-root-opening-art").evaluate((art) => {
    const artBounds = art.getBoundingClientRect();
    const isVisibleWithinArt = (selector) => {
      const element = art.querySelector(selector);
      if (!(element instanceof HTMLElement || element instanceof SVGElement)) return false;
      const style = window.getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && Number.parseFloat(style.opacity || "1") > 0
        && bounds.width > 0
        && bounds.height > 0
        && bounds.right > artBounds.left
        && bounds.left < artBounds.right
        && bounds.bottom > artBounds.top
        && bounds.top < artBounds.bottom;
    };

    return {
      deliveryId: art.getAttribute("data-delivery-id"),
      visualCandidateId: art.getAttribute("data-visual-candidate-id"),
      stage: art.getAttribute("data-stage"),
      actorState: art.getAttribute("data-actor-state"),
      subjectState: art.getAttribute("data-subject-state"),
      actionState: art.getAttribute("data-action-state"),
      contactState: art.getAttribute("data-contact-state"),
      subjectContact: art.getAttribute("data-subject-contact"),
      liftContact: art.getAttribute("data-lift-contact"),
      assetState: art.getAttribute("data-asset-state"),
      assetVariant: art.getAttribute("data-asset-variant"),
      oldNestCount: art.querySelectorAll('[class*="nest"]').length,
      oldWateringAssetCount: art.querySelectorAll(
        'img[src*="watering-"], img[src*="actor-water-sheet"], img[src*="flower-"]',
      ).length,
      paintedVisible: isVisibleWithinArt(".snap-root-opening-art__painted"),
      paintedCurrentSrc: art.querySelector(".snap-root-opening-art__painted")?.currentSrc ?? "",
    };
  });

  assert(result.deliveryId === "snap-root-v1", `${viewport.width}px delivery slot should stay snap-root-v1: ${JSON.stringify(result)}`);
  assert(result.visualCandidateId === "dig-pop-painted-v2", `${viewport.width}px should expose the painted candidate: ${JSON.stringify(result)}`);
  assert(result.stage === "popped", `${viewport.width}px Snap Root should resolve as popped: ${JSON.stringify(result)}`);
  assert(result.actorState === "safe-seated", `${viewport.width}px popped actor should be safely seated: ${JSON.stringify(result)}`);
  assert(result.subjectState === "free-standing", `${viewport.width}px popped subject should stand free: ${JSON.stringify(result)}`);
  assert(result.actionState === "pop", `${viewport.width}px final action should be pop: ${JSON.stringify(result)}`);
  assert(result.contactState === "none", `${viewport.width}px final bodies should have no contact: ${JSON.stringify(result)}`);
  assert(result.subjectContact === "none", `${viewport.width}px actor should never contact the subject: ${JSON.stringify(result)}`);
  assert(result.liftContact === "none", `${viewport.width}px actor should not lift the subject: ${JSON.stringify(result)}`);
  assert(result.assetState === "ready", `${viewport.width}px selected four-frame set should be ready: ${JSON.stringify(result)}`);
  assert(result.assetVariant === (viewport.width >= 600 ? "tablet" : "mobile"), `${viewport.width}px should select its matching art set: ${JSON.stringify(result)}`);
  assert(result.oldNestCount === 0, `${viewport.width}px painted DOM should not retain nest nodes: ${JSON.stringify(result)}`);
  assert(result.oldWateringAssetCount === 0, `${viewport.width}px painted DOM should not retain watering assets: ${JSON.stringify(result)}`);
  assert(result.paintedVisible, `${viewport.width}px popped painted frame should remain visible: ${JSON.stringify(result)}`);
  assert(result.paintedCurrentSrc.includes(viewport.width >= 600 ? "scene-popped-tablet.jpg" : "scene-popped.jpg"), `${viewport.width}px should render its popped crop: ${JSON.stringify(result)}`);
};

const scenarioSnapRootBreakthrough = async (
  browser,
  viewport = { width: 390, height: 844 },
  runControl = { seed: "a", now: 1000 },
) => {
  const context = await browser.newContext({
    baseURL: activeBaseUrl,
    reducedMotion: "reduce",
    viewport,
  });
  const page = await context.newPage();
  await page.addInitScript((control) => {
    window.__SANSU_E2E__ = {
      ...(window.__SANSU_E2E__ || {}),
      exploreRun: { seed: control.seed, now: control.now },
    };
  }, runControl);
  const paintedRequests = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/assets/explore/opening-snap-root-painted/")) {
      paintedRequests.push(new URL(url).pathname);
    }
  });
  await clearClientStorage(page);

  await completeOnboarding(
    page,
    /足し算まで/,
    /小学 1 年生/,
    "snap-root-v1",
  );
  await waitForExploreFirstProblemReady(page, ".snap-root-opening-art");

  const world = page.locator(".explore-world");
  const art = page.locator(".snap-root-opening-art");
  const appContainer = page.locator(".app-container");
  await art.waitFor({ timeout: STEP_TIMEOUT_MS });
  await page.locator('.snap-root-opening-art[data-asset-state="ready"]')
    .waitFor({ timeout: STEP_TIMEOUT_MS });
  assert(Boolean(await appContainer.getAttribute("data-build-revision")), "runtime should expose its build revision");
  const configuredDeliveryId = await appContainer.getAttribute("data-configured-delivery-id");
  assert(Boolean(configuredDeliveryId), "runtime should expose its configured delivery ID");
  assert(
    await appContainer.getAttribute("data-visual-lineage-id") === (
      configuredDeliveryId === "snap-root-v1" ? "pokko-field-v1" : "legacy-mixed-v0"
    ),
    "runtime lineage should describe its configured delivery instead of a URL override",
  );
  assert(await world.getAttribute("data-opening-experience") === "snap-root-v1", "Snap Root URL should remain frozen for the run");
  assert(await art.getAttribute("data-delivery-id") === "snap-root-v1", "Snap Root should expose its delivery slot");
  assert(await art.getAttribute("data-visual-candidate-id") === "dig-pop-painted-v2", "Snap Root should expose the painted candidate");
  assert(await art.getAttribute("data-stage") === "ready", "Snap Root should open on the painted ready frame");
  assert(await art.getAttribute("data-actor-state") === "ready", "Snap Root actor should start ready to dig");
  assert(await art.getAttribute("data-subject-state") === "planted", "Snap Root subject should start planted");
  assert(await art.getAttribute("data-action-state") === "ready", "Snap Root action should start ready");
  assert(await art.getAttribute("data-contact-state") === "none", "Snap Root should start without body contact");
  assert(await art.getAttribute("data-subject-contact") === "none", "Snap Root actor should dig soil without touching the subject");
  assert(await art.getAttribute("data-lift-contact") === "none", "Snap Root actor should never lift the subject");
  assert(await art.getAttribute("data-reduced-motion") === "true", "reduced motion should keep the authored static stages");
  const expectedAssetVariant = viewport.width >= 600 ? "tablet" : "mobile";
  assert(await art.getAttribute("data-asset-variant") === expectedAssetVariant, `Snap Root should select ${expectedAssetVariant} assets`);
  const uniquePaintedRequests = [...new Set(paintedRequests)];
  assert(uniquePaintedRequests.length === 4, `Snap Root should preload exactly one four-frame set: ${JSON.stringify(uniquePaintedRequests)}`);
  assert(
    uniquePaintedRequests.every((path) => (expectedAssetVariant === "tablet" ? path.endsWith("-tablet.jpg") : !path.endsWith("-tablet.jpg"))),
    `Snap Root should not download the non-matching asset variant: ${JSON.stringify(uniquePaintedRequests)}`,
  );
  const reducedMotionTransitionMs = await page.locator(".snap-root-opening-art__painted").evaluate((image) => {
    const style = window.getComputedStyle(image);
    return [...style.transitionDuration.split(","), ...style.animationDuration.split(",")].reduce((maximum, token) => {
      const normalized = token.trim();
      const milliseconds = normalized.endsWith("ms")
        ? Number.parseFloat(normalized)
        : Number.parseFloat(normalized) * 1000;
      return Math.max(maximum, Number.isFinite(milliseconds) ? milliseconds : 0);
    }, 0);
  });
  assert(
    reducedMotionTransitionMs <= 1,
    `reduced motion should remove pose interpolation; got ${reducedMotionTransitionMs}ms`,
  );
  await assertSnapRootViewportFit(page, viewport);

  const runtimeAuditDir = "docs/design/breakout-loop-2026-07-21/runtime-painted-v2-audit";
  await writeVisualAuditScreenshot(page, `${runtimeAuditDir}/${viewport.width}-ready.png`);

  if (viewport.width === 390) {
    for (const digit of ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]) {
      assert(
        await page.getByRole("button", { name: digit, exact: true }).isVisible(),
        `Snap Root should keep numeric key ${digit}`,
      );
    }
    assert(await page.getByRole("button", { name: "こたえを けす" }).isVisible(), "Snap Root should keep clear");
    assert(await page.getByRole("button", { name: "ひとつ もどす" }).isVisible(), "Snap Root should keep backspace");
    assert(await page.getByRole("button", { name: "こたえる" }).isVisible(), "Snap Root should keep confirm");

    await page.keyboard.type("10");
    assert(await page.locator('[aria-label="こたえ 10"]').count() === 1, "physical 1/0 should enter 10");
    await page.keyboard.press("Backspace");
    assert(await page.locator('[aria-label="こたえ 1"]').count() === 1, "physical Backspace should remove one digit");
    await page.keyboard.press("Delete");
    assert(await page.locator('[aria-label="こたえ 未入力"]').count() === 1, "physical Delete should clear the answer");

    const firstProblemId = await page.getByTestId("explore-attempt").getAttribute("data-problem-id");
    const correctAnswer = await getExploreNumericAnswer(page);
    await page.keyboard.type(String(correctAnswer + 1));
    let priorKey = await page.getByTestId("explore-attempt").getAttribute("data-attempt-key");
    const firstIncorrectMs = await submitExploreAndMeasureOperable(
      page,
      priorKey,
      RAPID_LOOP_INCORRECT_PRODUCT_BUDGET_MS,
      { viaKeyboard: true },
    );
    assert(await art.getAttribute("data-stage") === "ready", "first miss must not advance the body gag");

    for (const digit of ["1", "2", "3"]) {
      await page.getByRole("button", { name: digit, exact: true }).click();
    }
    assert(
      await page.locator('[aria-label="こたえ 123"]').count() === 1,
      "TenKey 1/2/3 should enter 123 in order",
    );
    await page.getByRole("button", { name: "こたえを けす" }).click();

    await page.evaluate(() => {
      window.__SANSU_E2E__ = {
        ...(window.__SANSU_E2E__ || {}),
        exploreProblemPlan: { delayMs: 900, delaysRemaining: 1 },
      };
    });
    await page.keyboard.type(String(correctAnswer + 1));
    priorKey = await page.getByTestId("explore-attempt").getAttribute("data-attempt-key");
    const secondIncorrectMs = await submitExploreAndMeasureOperable(
      page,
      priorKey,
      RAPID_LOOP_INCORRECT_PRODUCT_BUDGET_MS,
    );
    assert(
      await page.getByTestId("explore-attempt").getAttribute("data-problem-id") === firstProblemId,
      "slow assistance should fall back to the same operable problem without a late swap",
    );
    await page.waitForTimeout(950);
    assert(
      await page.getByTestId("explore-attempt").getAttribute("data-problem-id") === firstProblemId,
      "aborted late assistance must not overwrite the child input surface",
    );

    const correctTimings = [];
    for (const { stage: expectedStage, action: expectedAction, subject: expectedSubject } of [
      { stage: "dig-one", action: "dig-one", subject: "rising" },
      { stage: "dig-two", action: "dig-two", subject: "feet-visible" },
    ]) {
      const answer = await getExploreNumericAnswer(page);
      await page.keyboard.type(String(answer));
      priorKey = await page.getByTestId("explore-attempt").getAttribute("data-attempt-key");
      correctTimings.push(await submitExploreAndMeasureOperable(
        page,
        priorKey,
        RAPID_LOOP_CORRECT_PRODUCT_BUDGET_MS,
      ));
      assert(await art.getAttribute("data-stage") === expectedStage, `Snap Root should settle on ${expectedStage}`);
      assert(await art.getAttribute("data-actor-state") === "digging", `Snap Root actor should dig in ${expectedStage}`);
      assert(await art.getAttribute("data-subject-state") === expectedSubject, `Snap Root subject should visibly progress in ${expectedStage}`);
      assert(await art.getAttribute("data-action-state") === expectedAction, `Snap Root action should settle on ${expectedAction}`);
      assert(await art.getAttribute("data-contact-state") === "none", `Snap Root should keep bodies separate in ${expectedStage}`);
      await writeVisualAuditScreenshot(page, `${runtimeAuditDir}/390-${expectedStage}.png`);
    }

    const finalAnswer = await getExploreNumericAnswer(page);
    await page.keyboard.type(String(finalAnswer));
    await page.getByRole("button", { name: "こたえる" }).click();
    await page.locator('.snap-root-opening-art[data-stage="popped"]')
      .waitFor({ timeout: RAPID_LOOP_CI_BUDGET_MS });
    await assertSnapRootPaintedResolution(page, viewport);
    await writeVisualAuditScreenshot(page, `${runtimeAuditDir}/390-popped.png`);
    await waitForExploreRouteBreak(page);
    assert(await page.getByRole("dialog").count() === 0, "Snap Root payoff should remain inline");
    console.log("Snap Root measured ms", {
      firstIncorrect: Math.round(firstIncorrectMs),
      secondIncorrect: Math.round(secondIncorrectMs),
      correct: correctTimings.map(Math.round),
    });
  } else {
    for (const { stage: expectedStage, action: expectedAction, subject: expectedSubject } of [
      { stage: "dig-one", action: "dig-one", subject: "rising" },
      { stage: "dig-two", action: "dig-two", subject: "feet-visible" },
    ]) {
      const answer = await getExploreNumericAnswer(page);
      await page.keyboard.type(String(answer));
      const priorKey = await page.getByTestId("explore-attempt").getAttribute("data-attempt-key");
      await submitExploreAndMeasureOperable(
        page,
        priorKey,
        RAPID_LOOP_CORRECT_PRODUCT_BUDGET_MS,
      );
      assert(await art.getAttribute("data-stage") === expectedStage, `tablet Snap Root should settle on ${expectedStage}`);
      assert(await art.getAttribute("data-actor-state") === "digging", `tablet Snap Root actor should dig in ${expectedStage}`);
      assert(await art.getAttribute("data-subject-state") === expectedSubject, `tablet Snap Root subject should visibly progress in ${expectedStage}`);
      assert(await art.getAttribute("data-action-state") === expectedAction, `tablet Snap Root action should settle on ${expectedAction}`);
      assert(await art.getAttribute("data-contact-state") === "none", `tablet Snap Root should keep bodies separate in ${expectedStage}`);
      await assertSnapRootViewportFit(page, viewport);
      await writeVisualAuditScreenshot(page, `${runtimeAuditDir}/${viewport.width}-${expectedStage}.png`);
    }

    const finalAnswer = await getExploreNumericAnswer(page);
    await page.keyboard.type(String(finalAnswer));
    await page.getByRole("button", { name: "こたえる" }).click();
    await page.locator('.snap-root-opening-art[data-stage="popped"]')
      .waitFor({ timeout: RAPID_LOOP_CI_BUDGET_MS });
    await assertSnapRootViewportFit(page, viewport, { requireTappable: false });
    await assertSnapRootPaintedResolution(page, viewport);
    await writeVisualAuditScreenshot(page, `${runtimeAuditDir}/${viewport.width}-popped.png`);
    await waitForExploreRouteBreak(page);
    assert(await page.getByRole("dialog").count() === 0, "tablet Snap Root payoff should remain inline");
  }

  await context.close();
};

const percentile95 = (samples) => {
  const ordered = [...samples].sort((left, right) => left - right);
  return ordered[Math.max(0, Math.ceil(ordered.length * 0.95) - 1)];
};

const scenarioSnapRootTempoBenchmark = async (browser, runCount) => {
  const correctSamples = [];
  const incorrectSamples = [];

  for (let runIndex = 0; runIndex < runCount; runIndex += 1) {
    const context = await browser.newContext({
      baseURL: activeBaseUrl,
      reducedMotion: "reduce",
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.addInitScript(({ seed, now }) => {
      window.__SANSU_E2E__ = {
        ...(window.__SANSU_E2E__ || {}),
        exploreRun: { seed, now },
      };
    }, { seed: `tempo-${runIndex}`, now: 2000 + runIndex });
    await clearClientStorage(page);
    await completeOnboarding(page, /足し算まで/, /小学 1 年生/, "snap-root-v1");
    await waitForExploreFirstProblemReady(page, ".snap-root-opening-art");

    for (let sampleIndex = 0; sampleIndex < 2; sampleIndex += 1) {
      const answer = await getExploreNumericAnswer(page);
      await page.keyboard.type(String(answer + 1));
      let priorKey = await page.getByTestId("explore-attempt").getAttribute("data-attempt-key");
      incorrectSamples.push(await submitExploreAndMeasureOperable(
        page,
        priorKey,
        RAPID_LOOP_INCORRECT_PRODUCT_BUDGET_MS,
      ));

      await page.keyboard.type(String(answer));
      priorKey = await page.getByTestId("explore-attempt").getAttribute("data-attempt-key");
      correctSamples.push(await submitExploreAndMeasureOperable(
        page,
        priorKey,
        RAPID_LOOP_CORRECT_PRODUCT_BUDGET_MS,
      ));
    }
    await context.close();
  }

  const correctP95 = percentile95(correctSamples);
  const incorrectP95 = percentile95(incorrectSamples);
  assert(correctSamples.length >= 20, `expected at least 20 correct samples; got ${correctSamples.length}`);
  assert(incorrectSamples.length >= 20, `expected at least 20 incorrect samples; got ${incorrectSamples.length}`);
  assert(correctP95 <= RAPID_LOOP_CORRECT_PRODUCT_BUDGET_MS, `correct P95 should be <=650ms; got ${Math.round(correctP95)}ms`);
  assert(incorrectP95 <= RAPID_LOOP_INCORRECT_PRODUCT_BUDGET_MS, `incorrect P95 should be <=550ms; got ${Math.round(incorrectP95)}ms`);
  console.log("Snap Root rapid-loop P95", {
    runCount,
    correctSamples: correctSamples.length,
    incorrectSamples: incorrectSamples.length,
    correctP95: Math.round(correctP95),
    incorrectP95: Math.round(incorrectP95),
    correctRange: [Math.round(Math.min(...correctSamples)), Math.round(Math.max(...correctSamples))],
    incorrectRange: [Math.round(Math.min(...incorrectSamples)), Math.round(Math.max(...incorrectSamples))],
  });
};

const scenarioExploreStartFailureExit = async (browser) => {
  const context = await browser.newContext({
    baseURL: activeBaseUrl,
    reducedMotion: "reduce",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await clearClientStorage(page);
  await page.addInitScript(() => {
    window.__SANSU_E2E__ = {
      exploreStart: { failuresRemaining: 1 },
    };
  });

  await completeOnboarding(page);
  await page.getByText("たんけんノートを じゅんびできなかったよ").waitFor({ timeout: STEP_TIMEOUT_MS });
  const safeExit = page.getByText("あそびメニューへ もどる", { exact: true });
  await safeExit.waitFor({ timeout: STEP_TIMEOUT_MS });
  const safeExitHeight = await safeExit.evaluate((button) => button.getBoundingClientRect().height);
  assert(safeExitHeight >= 44, `start-error exit should be at least 44px; got ${safeExitHeight}`);

  await safeExit.click();
  await waitForHash(page, /#\/battle/);
  const snapshot = await readExplorePersistenceSnapshot(page);
  assert(snapshot.runs.length === 0, `injected start failure should not leave a run; got ${snapshot.runs.length}`);
  assert(snapshot.events.length === 0, `injected start failure should not leave an event; got ${snapshot.events.length}`);

  await context.close();
};

const solveExploreAddition = async (page) => {
  const problemHeading = page.locator("#explore-problem-title");
  await problemHeading.waitFor({ timeout: STEP_TIMEOUT_MS });
  const problemPanel = problemHeading.locator("xpath=ancestor::section[1]");
  const questionText = await problemPanel.getAttribute("data-question-text");
  const expression = questionText?.match(/(\d+)\s*\+\s*(\d+)\s*=/);
  assert(expression, `expected an addition expression in explore panel; got ${questionText}`);
  const answer = Number(expression[1]) + Number(expression[2]);
  await page.keyboard.type(String(answer));
  await page.getByRole("button", { name: "こたえる" }).click();
};

const getExploreNumericAnswer = async (page) => {
  const problemPanel = page.locator('[data-question-text]');
  await problemPanel.waitFor({ timeout: STEP_TIMEOUT_MS });
  const questionText = await problemPanel.getAttribute("data-question-text");
  const expression = questionText?.match(/(-?\d+(?:\.\d+)?)\s*([+-])\s*(-?\d+(?:\.\d+)?)\s*=/);
  if (expression) {
    const left = Number(expression[1]);
    const right = Number(expression[3]);
    return expression[2] === "+" ? left + right : left - right;
  }

  const reverseAddition = questionText?.match(/□\s*\+\s*(-?\d+(?:\.\d+)?)\s*=\s*(-?\d+(?:\.\d+)?)/);
  if (reverseAddition) return Number(reverseAddition[2]) - Number(reverseAddition[1]);

  const takeAwayStory = questionText?.match(
    /(\d+)\s*こ(?:\s+あります|\s+から)[\s\S]*?(\d+)\s*こ(?:\s+なくなると|\s+へると)/,
  );
  if (takeAwayStory) return Number(takeAwayStory[1]) - Number(takeAwayStory[2]);

  const combineStory = questionText?.match(
    /(\d+)\s*こ(?:\s+と[^\d]*|\s+に\s*)(\d+)\s*こ[\s\S]*?(?:あわせて|ふえると)/,
  );
  if (combineStory) return Number(combineStory[1]) + Number(combineStory[2]);

  const composeTarget = questionText?.match(/(\d+)\s*になるには\s*あといくつ/);
  if (composeTarget) {
    const filledCount = await problemPanel.locator('[data-count-slot="filled"]').count();
    const emptyCount = await problemPanel.locator('[data-count-slot="empty"]').count();
    const target = Number(composeTarget[1]);
    assert(
      filledCount + emptyCount === target,
      `expected a ${target}-frame visual; got ${filledCount} filled and ${emptyCount} empty slots`,
    );
    return target - filledCount;
  }

  const nextNumber = questionText?.match(/(-?\d+)\s*のつぎは/);
  if (nextNumber) return Number(nextNumber[1]) + 1;

  const previousNumber = questionText?.match(/(-?\d+)\s*のまえは/);
  if (previousNumber) return Number(previousNumber[1]) - 1;

  if (questionText?.includes("いくつ ある")) {
    const filledCount = await problemPanel.locator('[data-count-slot="filled"]').count();
    assert(filledCount > 0, `expected visible counting slots; got ${filledCount}`);
    return filledCount;
  }

  throw new Error(`expected a numeric addition/subtraction expression; got ${questionText}`);
};

const solveExploreNumericProblem = async (page) => {
  const answer = await getExploreNumericAnswer(page);
  await page.keyboard.type(String(answer));
  await page.getByRole("button", { name: "こたえる" }).click();
  return answer;
};

const waitForNewExploreAttempt = async (page, previousAttemptKey) => {
  const startedAt = Date.now();
  await page.waitForFunction(
    (priorKey) => {
      const attempt = document.querySelector('[data-testid="explore-attempt"]');
      return attempt instanceof HTMLElement
        && Boolean(attempt.dataset.attemptKey)
        && attempt.dataset.attemptKey !== priorKey
        && Boolean(document.querySelector("#explore-problem-title"));
    },
    previousAttemptKey,
    { timeout: RAPID_LOOP_CI_BUDGET_MS },
  );
  const elapsed = Date.now() - startedAt;
  assert(
    elapsed <= RAPID_LOOP_CI_BUDGET_MS,
    `correct answer should reach the next problem within ${RAPID_LOOP_CI_BUDGET_MS}ms; got ${elapsed}ms`,
  );
  return elapsed;
};

const waitForExploreRouteBreak = async (page) => {
  const startedAt = Date.now();
  await page.locator("#explore-path-choice-title").waitFor({ timeout: RAPID_LOOP_CI_BUDGET_MS });
  const elapsed = Date.now() - startedAt;
  assert(
    elapsed <= RAPID_LOOP_CI_BUDGET_MS,
    `exploration should reach its route break within ${RAPID_LOOP_CI_BUDGET_MS}ms; got ${elapsed}ms`,
  );
};

const chooseFirstExploreRoute = async (page) => {
  const routeHeading = page.locator("#explore-path-choice-title");
  await routeHeading.waitFor({ timeout: STEP_TIMEOUT_MS });
  const routeCards = routeHeading.locator("xpath=ancestor::section[1]").locator(".explore-route-card");
  assert(await routeCards.count() >= 2, "a real route break should offer at least two choices");
  await routeCards.first().click();
  await page.locator("#explore-problem-title").waitFor({ timeout: STEP_TIMEOUT_MS });
};

const closeBlockingResearchDiscovery = async (page, expectedTitle, expectedClueCount) => {
  const discovery = page.locator('.explore-research-overlay[role="dialog"]');
  await discovery.waitFor({ timeout: RAPID_LOOP_CI_BUDGET_MS });
  assert(
    await discovery.getByRole("heading", { name: expectedTitle }).isVisible(),
    `blocking research discovery should expose ${expectedTitle}`,
  );
  assert(
    await discovery.getAttribute("aria-modal") === "true",
    "a blocking research discovery should declare modal semantics",
  );
  assert(
    await page.locator(".explore-world [inert]").count() === 1,
    "a blocking research discovery should inert the exploration controls",
  );
  const orderedClues = discovery.getByRole("list", {
    name: `${expectedClueCount}つの手掛かりを発見`,
    includeHidden: true,
  });
  assert(
    await orderedClues.count() === 1,
    `blocking research discovery should preserve ${expectedClueCount} ordered clues for assistive technology`,
  );
  if (await discovery.getByTestId("explore-observation-scene").count() > 0) {
    assert(
      (await orderedClues.getAttribute("class"))?.split(/\s+/).includes("sr-only"),
      "the root payoff should keep prior clue cards out of the visual action beat",
    );
  } else {
    assert(
      await orderedClues.isVisible(),
      "a generic big discovery should show its ordered clue cards",
    );
  }
  await discovery.getByRole("button", { name: "調査ノートを とじる" }).click();
  await discovery.waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
};

const waitForRouteBreakPastOptionalRareDiscovery = async (page) => {
  await page.waitForFunction(
    () => Boolean(
      document.querySelector("#explore-path-choice-title")
      || document.querySelector('[role="dialog"][aria-labelledby="discovery-title"]'),
    ),
    undefined,
    { timeout: RAPID_LOOP_CI_BUDGET_MS },
  );
  const rareDiscovery = page.locator('[role="dialog"][aria-labelledby="discovery-title"]');
  if (await rareDiscovery.isVisible()) {
    await rareDiscovery.getByRole("button", { name: "ひょうほんを バッグへ" }).click();
    await rareDiscovery.waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
  }
  await waitForExploreRouteBreak(page);
};

const solveExploreAndWaitForNextProblem = async (page) => {
  const previousAttemptKey = await page.getByTestId("explore-attempt").getAttribute("data-attempt-key");
  assert(previousAttemptKey, "active explore problem should expose an attempt key");
  await solveExploreNumericProblem(page);
  await waitForNewExploreAttempt(page, previousAttemptKey);
};

const solveMakimodonOpening = async (page) => {
  for (let index = 0; index < 3; index += 1) {
    const makimodonArt = page.locator('.explore-immersive .makimodon-art[role="img"]');
    await makimodonArt.waitFor({ timeout: STEP_TIMEOUT_MS });
    assert(
      await makimodonArt.getAttribute("data-stage") === ["rolled", "trip", "path"][index],
      `Makimodon problem ${index + 1} should preserve the ordered ecology stage`,
    );
    const previousAttemptKey = await page.getByTestId("explore-attempt").getAttribute("data-attempt-key");
    assert(previousAttemptKey, `Makimodon problem ${index + 1} should expose an attempt key`);
    await solveExploreNumericProblem(page);
    if (index < 2) {
      await waitForNewExploreAttempt(page, previousAttemptKey);
    } else {
      await waitForExploreRouteBreak(page);
      assert(
        await page.locator(".explore-world").getAttribute("data-run-steps") === "3",
        "three Makimodon answers should complete only the opening beat",
      );
      assert(
        await page.locator('.explore-research-overlay[role="dialog"]').count() === 0,
        "opening payoff should not create a research-page modal",
      );
      assert(
        await page.getByLabel("ちょうさノート 手掛かり 0/3").isVisible(),
        "research should begin at zero only after the opening beat",
      );
    }
  }
};

const openFirstExploreAttempt = async (page) => {
  await completeOnboarding(page, /足し算まで/);
  await waitForExploreFirstProblemReady(page);
};

const waitForFixedTenExploreAttempt = async (
  page,
  benchmarkIndex,
  attemptNumber,
  previousAttemptKey,
) => {
  await page.waitForFunction(
    ({ expectedIndex, expectedAttemptNumber, priorKey }) => {
      const world = document.querySelector(".explore-world");
      const attempt = document.querySelector('[data-testid="explore-attempt"]');
      const digit = [...document.querySelectorAll("button")].find(
        (button) => button.getAttribute("aria-label") === "1",
      );
      return world instanceof HTMLElement
        && world.dataset.runPersistence === "ready"
        && attempt instanceof HTMLElement
        && Number(attempt.dataset.benchmarkIndex) === expectedIndex
        && Number(attempt.dataset.attemptNumber) === expectedAttemptNumber
        && Boolean(attempt.dataset.attemptKey)
        && (!priorKey || attempt.dataset.attemptKey !== priorKey)
        && attempt.dataset.saveState === "idle"
        && document.querySelector('[aria-label="こたえ 未入力"]')
        && digit instanceof HTMLButtonElement
        && !digit.disabled;
    },
    {
      expectedIndex: benchmarkIndex,
      expectedAttemptNumber: attemptNumber,
      priorKey: previousAttemptKey || null,
    },
    { timeout: STEP_TIMEOUT_MS },
  );
};

const readExploreAttemptBoundary = async (page) => {
  const world = page.locator(".explore-world");
  const attempt = page.getByTestId("explore-attempt");
  return {
    runId: await attempt.getAttribute("data-run-id"),
    gateId: await attempt.getAttribute("data-gate-id"),
    problemId: await attempt.getAttribute("data-problem-id"),
    attemptNumber: await attempt.getAttribute("data-attempt-number"),
    attemptKey: await attempt.getAttribute("data-attempt-key"),
    benchmarkIndex: await attempt.getAttribute("data-benchmark-index"),
    question: await page.locator("[data-question-text]").getAttribute("data-question-text"),
    energy: await page.getByRole("progressbar", { name: "ひかり" }).getAttribute("aria-valuenow"),
    steps: await world.getAttribute("data-run-steps"),
    checkpointRevision: await world.getAttribute("data-checkpoint-revision"),
  };
};

const assertExploreAttemptBoundary = (before, after, label) => {
  for (const key of Object.keys(before)) {
    assert(
      after[key] === before[key],
      `${label} changed ${key}: ${before[key]} -> ${after[key]}`,
    );
  }
};

const readExploreRouteBreakBoundary = async (page, runId) => {
  const routeCards = page.locator("#explore-path-choice-title")
    .locator("xpath=ancestor::section[1]")
    .locator(".explore-route-card");
  const options = await routeCards.evaluateAll((cards) => cards.map((card) => ({
    label: card.getAttribute("aria-label"),
    tone: card.getAttribute("data-tone"),
    text: card.textContent?.replace(/\s+/g, " ").trim(),
  })));
  const snapshot = await readExplorePersistenceSnapshot(page);
  const run = snapshot.runs.find((candidate) => candidate.runId === runId);
  assert(run?.activeCheckpoint, `active checkpoint for ${runId} should exist at the route break`);
  return {
    route: {
      currentNodeId: run.activeCheckpoint.state.currentNodeId,
      openedNodeIds: run.activeCheckpoint.state.openedNodeIds,
    },
    options,
    finds: run.activeCheckpoint.state.temporaryFinds,
    events: snapshot.events.filter((event) => event.runId === runId),
  };
};

const scenarioExploreInterruptionResume = async (browser) => {
  const context = await browser.newContext({
    baseURL: activeBaseUrl,
    locale: "ja-JP",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__SANSU_E2E__ = {
      exploreBenchmark: { fixtureId: "cold-open-fixed-ten-v1", startIndex: 0 },
      exploreRun: { seed: "fixed-ten-interruption-resume", maxEnergy: 12 },
    };
  });

  try {
    await openFirstExploreAttempt(page);
    await waitForFixedTenExploreAttempt(page, 0, 1);

    const q1FirstAttempt = await readExploreAttemptBoundary(page);
    const q1Answer = await getExploreNumericAnswer(page);
    await page.keyboard.type(String(q1Answer + 1));
    await page.getByRole("button", { name: "こたえる" }).click();
    await waitForFixedTenExploreAttempt(page, 0, 2, q1FirstAttempt.attemptKey);

    const q1Retry = await readExploreAttemptBoundary(page);
    assert(q1Retry.attemptNumber === "2", `Q1 retry should be attempt 2; got ${q1Retry.attemptNumber}`);
    assert(q1Retry.runId === q1FirstAttempt.runId, "Q1 miss should keep the run identity");
    assert(q1Retry.gateId === q1FirstAttempt.gateId, "Q1 miss should keep the gate identity");
    assert(q1Retry.problemId === q1FirstAttempt.problemId, "Q1 miss should keep the problem identity");
    assert(
      Number(q1Retry.energy) === Number(q1FirstAttempt.energy) - 1,
      `Q1 miss should spend one energy; got ${q1FirstAttempt.energy} -> ${q1Retry.energy}`,
    );

    await page.keyboard.type("1");
    await page.getByLabel("こたえ 1").waitFor({ timeout: STEP_TIMEOUT_MS });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForFixedTenExploreAttempt(page, 0, 2);
    const q1Resumed = await readExploreAttemptBoundary(page);
    assertExploreAttemptBoundary(q1Retry, q1Resumed, "Q1 partial-input reload");
    assert(await page.getByLabel("こたえ 未入力").count() === 1, "Q1 partial input should not persist");

    await solveExploreAndWaitForNextProblem(page);
    await waitForFixedTenExploreAttempt(page, 1, 1);
    await solveExploreAndWaitForNextProblem(page);
    await waitForFixedTenExploreAttempt(page, 2, 1);
    await solveExploreNumericProblem(page);
    await waitForExploreRouteBreak(page);

    const routeWorld = page.locator(".explore-world");
    const runId = await routeWorld.getAttribute("data-run-id");
    assert(runId, "Q3 route break should expose its run id");
    assert(await routeWorld.getAttribute("data-run-steps") === "3", "Q3 should stop at the route break");
    const routeBeforeReload = await readExploreRouteBreakBoundary(page, runId);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("#explore-path-choice-title").waitFor({ timeout: STEP_TIMEOUT_MS });
    await page.waitForFunction(
      () => document.querySelector(".explore-world")?.getAttribute("data-run-persistence") === "ready",
      undefined,
      { timeout: STEP_TIMEOUT_MS },
    );
    const routeAfterReload = await readExploreRouteBreakBoundary(page, runId);
    assert(
      JSON.stringify(routeAfterReload) === JSON.stringify(routeBeforeReload),
      `Q3 reload changed route/options/finds/events: ${JSON.stringify({ routeBeforeReload, routeAfterReload })}`,
    );

    await chooseFirstExploreRoute(page);
    await waitForFixedTenExploreAttempt(page, 3, 1);
    for (let benchmarkIndex = 3; benchmarkIndex < 6; benchmarkIndex += 1) {
      await solveExploreAndWaitForNextProblem(page);
      await waitForFixedTenExploreAttempt(page, benchmarkIndex + 1, 1);
    }

    const q7Attempt = await readExploreAttemptBoundary(page);
    assert(q7Attempt.benchmarkIndex === "6", `expected Q7 before discovery; got ${q7Attempt.benchmarkIndex}`);
    await solveExploreNumericProblem(page);
    const firstQ7Modal = page.locator('.explore-research-overlay[role="dialog"]');
    await firstQ7Modal.waitFor({ timeout: STEP_TIMEOUT_MS });
    assert(await firstQ7Modal.count() === 1, "Q7 should show one blocking discovery modal");

    const q7Snapshot = await readExplorePersistenceSnapshot(page);
    const q7Run = q7Snapshot.runs.find((candidate) => candidate.runId === runId);
    const q7Checkpoint = q7Run?.activeCheckpoint;
    const q7Discovery = q7Checkpoint?.state.temporaryFinds.at(-1);
    const q7Segment = q7Run?.learningSegments?.["6"];
    const reservedQ8Slot = q7Segment?.slots?.find((slot) => slot.step === 7);
    assert(q7Checkpoint?.state.steps === 7, `blocking discovery should be the Q7 boundary; got ${q7Checkpoint?.state.steps}`);
    assert(q7Discovery, "Q7 blocking discovery should be durable before it is acknowledged");
    assert(q7Segment?.slots?.length === 2, "Q7 should have atomically reserved its Q7-Q8 segment");
    assert(reservedQ8Slot?.problem?.id, "Q8 full Problem should be reserved behind the Q7 barrier");
    assert(
      reservedQ8Slot.assignment?.problemId === reservedQ8Slot.problem.id,
      "reserved Q8 Problem and assignment should share one identity",
    );
    assert(
      q7Checkpoint?.acknowledgedDiscoveryId !== q7Discovery.id,
      "Q7 discovery should remain unacknowledged while its modal is open",
    );

    await page.addInitScript(() => {
      window.__exploreResearchRevealMountCount = 0;
      const seen = new WeakSet();
      const recordMounts = () => {
        document.querySelectorAll('.explore-research-overlay[role="dialog"]').forEach((dialog) => {
          if (seen.has(dialog)) return;
          seen.add(dialog);
          window.__exploreResearchRevealMountCount += 1;
        });
      };
      new MutationObserver(recordMounts).observe(document, { childList: true, subtree: true });
      recordMounts();
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    const resumedQ7Modal = page.locator('.explore-research-overlay[role="dialog"]');
    await resumedQ7Modal.waitFor({ timeout: STEP_TIMEOUT_MS });
    await page.waitForTimeout(250);
    assert(await resumedQ7Modal.count() === 1, "Q7 reload should render one blocking modal");
    assert(
      await page.evaluate(() => window.__exploreResearchRevealMountCount) === 1,
      "Q7 reload should mount the blocking modal exactly once",
    );
    assert(await page.locator(".explore-world").getAttribute("data-run-steps") === "7", "Q7 reload should not advance steps");
    assert(await page.getByTestId("explore-attempt").count() === 0, "Q7 modal should block Q8 from opening");
    const resumedQ7Snapshot = await readExplorePersistenceSnapshot(page);
    const resumedQ7Run = resumedQ7Snapshot.runs.find((candidate) => candidate.runId === runId);
    assert(!resumedQ7Run?.activeCheckpoint?.state.pendingProblem, "Q7 reload should not persist a speculative Q8 gate");
    assert(
      JSON.stringify(resumedQ7Run?.activeCheckpoint?.state.temporaryFinds)
        === JSON.stringify(q7Checkpoint.state.temporaryFinds),
      "Q7 reload should keep the same discoveries",
    );
    assert(
      JSON.stringify(resumedQ7Snapshot.events.filter((event) => event.runId === runId))
        === JSON.stringify(q7Snapshot.events.filter((event) => event.runId === runId)),
      "Q7 reload should not append events",
    );

    await resumedQ7Modal.getByRole("button", { name: "調査ノートを とじる" }).click();
    await resumedQ7Modal.waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
    await waitForFixedTenExploreAttempt(page, 7, 1);
    const q8BeforeReload = await readExploreAttemptBoundary(page);
    const visibleQ8Snapshot = await readExplorePersistenceSnapshot(page);
    const visibleQ8Run = visibleQ8Snapshot.runs.find((candidate) => candidate.runId === runId);
    const visibleQ8Gate = visibleQ8Run?.activeCheckpoint?.state?.pendingProblem;
    assert(
      JSON.stringify(visibleQ8Gate?.problem) === JSON.stringify(reservedQ8Slot.problem),
      "Q8 should display the exact full Problem reserved before Q7 acknowledgement",
    );
    assert(
      visibleQ8Gate?.learningAssignment?.assignmentKey
        === reservedQ8Slot.assignment.assignmentKey,
      "Q8 should display the assignment reserved before Q7 acknowledgement",
    );
    assert(
      await page.locator(".explore-world").getAttribute("data-acknowledged-discovery-id") === q7Discovery.id,
      "continuing should durably acknowledge the Q7 discovery before Q8",
    );

    await page.keyboard.type("1");
    await page.getByLabel("こたえ 1").waitFor({ timeout: STEP_TIMEOUT_MS });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForFixedTenExploreAttempt(page, 7, 1);
    const q8AfterReload = await readExploreAttemptBoundary(page);
    assertExploreAttemptBoundary(q8BeforeReload, q8AfterReload, "Q8 partial-input reload");
    assert(await page.getByLabel("こたえ 未入力").count() === 1, "Q8 partial input should not persist");
    assert(await page.locator('.explore-research-overlay[role="dialog"]').count() === 0, "acknowledged Q7 modal should not replay at Q8");
    assert(
      await page.evaluate(() => window.__exploreResearchRevealMountCount) === 0,
      "Q8 reload should not remount the acknowledged Q7 modal",
    );
  } finally {
    await context.close();
  }
};

const scenarioExploreDoubleCommit = async (browser) => {
  const context = await browser.newContext({
    baseURL: activeBaseUrl,
    reducedMotion: "reduce",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await clearClientStorage(page);
  await page.addInitScript(() => {
    window.__SANSU_E2E__ = {
      exploreCommit: { delayMs: 200, failuresRemaining: 0 },
    };
  });

  await openFirstExploreAttempt(page);
  const attempt = page.getByTestId("explore-attempt");
  const attemptKey = await attempt.getAttribute("data-attempt-key");
  const runId = await attempt.getAttribute("data-run-id");
  const attemptNumber = await attempt.getAttribute("data-attempt-number");
  const energyBefore = Number(
    await page.getByRole("progressbar", { name: "ひかり" }).getAttribute("aria-valuenow"),
  );
  const openAttemptBack = page.getByRole("button", { name: /(?:あそびメニュー|Game)へ もどる/ });
  assert(await openAttemptBack.isDisabled(), "an open attempt should disable run exit/return");
  await openAttemptBack.evaluate((button) => button.click());
  await page.waitForTimeout(50);
  const openAttemptSnapshot = await readExplorePersistenceSnapshot(page);
  const stillActiveRun = openAttemptSnapshot.runs.find((candidate) => candidate.runId === runId);
  const prematureEndEvents = openAttemptSnapshot.events.filter((event) => (
    event.runId === runId && event.type === "run_ended"
  ));
  assert(stillActiveRun?.status === "active", "disabled return should keep the open-attempt run active");
  assert(prematureEndEvents.length === 0, "disabled return should not write an end event");
  const answer = await getExploreNumericAnswer(page);
  await page.keyboard.type(String(answer));
  await page.getByRole("button", { name: "こたえる" }).evaluate((submit) => {
    if (!(submit instanceof HTMLButtonElement)) throw new Error("explore submit is not a button");
    submit.click();
    submit.click();
  });

  await waitForNewExploreAttempt(page, attemptKey);
  const snapshot = await readExplorePersistenceSnapshot(page);
  const answerEvents = snapshot.events.filter((event) => (
    event.runId === runId && event.type === "problem_answered"
  ));
  const run = snapshot.runs.find((candidate) => candidate.runId === runId);
  const energyAfter = Number(
    await page.getByRole("progressbar", { name: "ひかり" }).getAttribute("aria-valuenow"),
  );

  assert(attemptKey, "explore attempt should expose a stable attempt key");
  assert(attemptNumber === "1", `first explore attempt should be one-based; got ${attemptNumber}`);
  assert(answerEvents.length === 1, `double submit should write one explore event; got ${answerEvents.length}`);
  assert(answerEvents[0].attemptKey === attemptKey, "saved explore event should use the displayed attempt key");
  assert(answerEvents[0].attemptNumber === 1, `saved attempt number should be 1; got ${answerEvents[0].attemptNumber}`);
  assert(run?.problemsAnswered === 1, `double submit should count one problem; got ${run?.problemsAnswered}`);
  assert(run?.correctCount === 1, `double submit should count one correct answer; got ${run?.correctCount}`);
  assert(energyAfter === energyBefore - 1, `opening dig should consume one light once; got ${energyBefore} -> ${energyAfter}`);
  assert(await countIndexedDbRows(page, "logs") === 1, "double submit should write one formal learning log");

  await context.close();
};

const scenarioExploreCommitRetry = async (browser) => {
  const context = await browser.newContext({
    baseURL: activeBaseUrl,
    reducedMotion: "reduce",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await clearClientStorage(page);
  await page.addInitScript(() => {
    window.__SANSU_E2E__ = {
      exploreCommit: { failuresRemaining: 1 },
    };
  });

  await openFirstExploreAttempt(page);
  const attempt = page.getByTestId("explore-attempt");
  const before = {
    runId: await attempt.getAttribute("data-run-id"),
    gateId: await attempt.getAttribute("data-gate-id"),
    attemptNumber: await attempt.getAttribute("data-attempt-number"),
    attemptKey: await attempt.getAttribute("data-attempt-key"),
    problemId: await attempt.getAttribute("data-problem-id"),
    question: await page.locator("[data-question-text]").getAttribute("data-question-text"),
    energy: await page.getByRole("progressbar", { name: "ひかり" }).getAttribute("aria-valuenow"),
  };
  const answer = await getExploreNumericAnswer(page);
  await page.keyboard.type(String(answer));
  await page.getByRole("button", { name: "こたえる" }).click();
  const retry = page.getByRole("button", { name: "もういちど きろくする" });
  await retry.waitFor({ timeout: STEP_TIMEOUT_MS });

  const failedAttempt = page.getByTestId("explore-attempt");
  const afterFailure = {
    runId: await failedAttempt.getAttribute("data-run-id"),
    gateId: await failedAttempt.getAttribute("data-gate-id"),
    attemptNumber: await failedAttempt.getAttribute("data-attempt-number"),
    attemptKey: await failedAttempt.getAttribute("data-attempt-key"),
    problemId: await failedAttempt.getAttribute("data-problem-id"),
    question: await page.locator("[data-question-text]").getAttribute("data-question-text"),
    energy: await page.getByRole("progressbar", { name: "ひかり" }).getAttribute("aria-valuenow"),
    saveState: await failedAttempt.getAttribute("data-save-state"),
  };
  const failedSnapshot = await readExplorePersistenceSnapshot(page);
  const failedEvents = failedSnapshot.events.filter((event) => (
    event.runId === before.runId && event.type === "problem_answered"
  ));
  const failedRun = failedSnapshot.runs.find((candidate) => candidate.runId === before.runId);

  assert(before.runId === afterFailure.runId, "failed save should keep run identity");
  assert(before.gateId === afterFailure.gateId, "failed save should keep gate identity");
  assert(before.attemptNumber === afterFailure.attemptNumber && afterFailure.attemptNumber === "1", "failed save should keep one-based attempt number");
  assert(before.attemptKey === afterFailure.attemptKey, "failed save should keep attempt key");
  assert(before.problemId === afterFailure.problemId, "failed save should keep problem id");
  assert(before.question === afterFailure.question, "failed save should keep the same question");
  assert(before.energy === afterFailure.energy, "failed save should not consume energy");
  assert(afterFailure.saveState === "error", `failed save should expose error state; got ${afterFailure.saveState}`);
  assert(await page.locator(`[aria-label="こたえ ${answer}"]`).isVisible(), "failed save should keep the entered answer");
  assert(failedEvents.length === 0, `failed save should not write an answer event; got ${failedEvents.length}`);
  assert(failedRun?.problemsAnswered === 0 && failedRun?.correctCount === 0, "failed save should not update run aggregates");
  assert(await page.locator("#explore-path-choice-title").count() === 0, "failed save should not advance to path choice");

  await retry.click();
  await waitForNewExploreAttempt(page, before.attemptKey);
  const committedSnapshot = await readExplorePersistenceSnapshot(page);
  const committedEvents = committedSnapshot.events.filter((event) => (
    event.runId === before.runId && event.type === "problem_answered"
  ));
  const committedRun = committedSnapshot.runs.find((candidate) => candidate.runId === before.runId);
  const energyAfter = await page.getByRole("progressbar", { name: "ひかり" }).getAttribute("aria-valuenow");

  assert(committedEvents.length === 1, `retry should write one answer event; got ${committedEvents.length}`);
  assert(committedEvents[0].attemptKey === before.attemptKey, "retry should commit the original attempt identity");
  assert(committedEvents[0].affectsSrs === true, "retry should preserve the reserved formal-learning assignment");
  assert(committedRun?.problemsAnswered === 1 && committedRun?.correctCount === 1, "retry should update run aggregates once");
  assert(Number(energyAfter) === Number(before.energy) - 1, `opening-dig retry should consume one light once; got ${before.energy} -> ${energyAfter}`);
  assert(await countIndexedDbRows(page, "logs") === 1, "successful retry should write one formal learning log");

  await context.close();
};

const scenarioExploreLastLightRescueFinish = async (browser) => {
  const context = await browser.newContext({
    baseURL: activeBaseUrl,
    reducedMotion: "reduce",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await clearClientStorage(page);
  await page.addInitScript(() => {
    window.__SANSU_E2E__ = {
      exploreRun: { maxEnergy: 1 },
    };
  });

  await openFirstExploreAttempt(page);
  const runId = await page.getByTestId("explore-attempt").getAttribute("data-run-id");
  const answer = await getExploreNumericAnswer(page);
  await page.keyboard.type(String(answer));
  await page.getByRole("button", { name: "こたえる" }).click();
  const world = page.locator(".explore-world");
  await page.locator("#return-summary-title").waitFor({ timeout: STEP_TIMEOUT_MS });
  assert(
    await page.getByRole("button", { name: "調査ノートを とじる" }).count() === 0,
    "ordinary last-light clue should not require a modal continue action",
  );
  const rescuedSnapshot = await readExplorePersistenceSnapshot(page);
  const rescuedRun = rescuedSnapshot.runs.find((candidate) => candidate.runId === runId);
  const rescuedEvents = rescuedSnapshot.events.filter((event) => (
    event.runId === runId && event.type === "run_ended"
  ));

  assert(rescuedRun?.status === "rescued", `last-light run should finish rescued; got ${rescuedRun?.status}`);
  assert(rescuedEvents.length === 1, `last-light rescue should write one end event; got ${rescuedEvents.length}`);
  assert(rescuedEvents[0].payload?.status === "rescued", "last-light end event should preserve rescued meaning");
  assert(await world.getAttribute("data-run-status") === "rescued", "UI should become rescued after finish receipt");
  assert(await world.getAttribute("data-confirmed-find-count") === "1", "final find should confirm after rescued finish receipt");

  await context.close();
};

const scenarioExploreReturnFinishRetry = async (browser) => {
  const context = await browser.newContext({
    baseURL: activeBaseUrl,
    reducedMotion: "reduce",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await clearClientStorage(page);
  await page.addInitScript(() => {
    window.__SANSU_E2E__ = {
      exploreFinish: { failuresRemaining: 1 },
    };
  });

  await openFirstExploreAttempt(page);
  const runId = await page.getByTestId("explore-attempt").getAttribute("data-run-id");
  await solveMakimodonOpening(page);
  await page.getByRole("button", { name: "ここまでを ノートに のこす" }).click();
  const retry = page.getByRole("button", { name: "もういちど きろくする" });
  await retry.waitFor({ timeout: STEP_TIMEOUT_MS });

  const failedSnapshot = await readExplorePersistenceSnapshot(page);
  const failedRun = failedSnapshot.runs.find((candidate) => candidate.runId === runId);
  const failedEndEvents = failedSnapshot.events.filter((event) => (
    event.runId === runId && event.type === "run_ended"
  ));
  const world = page.locator(".explore-world");
  assert(failedRun?.status === "active", `failed return should keep persisted run active; got ${failedRun?.status}`);
  assert(failedEndEvents.length === 0, "failed return should not write an end event");
  assert(await world.getAttribute("data-run-status") === "active", "failed return should keep reducer active");
  assert(await world.getAttribute("data-confirmed-find-count") === "0", "failed return should not confirm temporary finds");
  assert(await page.locator("#return-summary-title").count() === 0, "failed return should not open terminal summary");

  await retry.click();
  await page.locator("#return-summary-title").waitFor({ timeout: STEP_TIMEOUT_MS });
  const committedSnapshot = await readExplorePersistenceSnapshot(page);
  const returnedRun = committedSnapshot.runs.find((candidate) => candidate.runId === runId);
  const returnedEndEvents = committedSnapshot.events.filter((event) => (
    event.runId === runId && event.type === "run_ended"
  ));

  assert(returnedRun?.status === "returned", `return retry should finish returned; got ${returnedRun?.status}`);
  assert(returnedEndEvents.length === 1, `return retry should write one end event; got ${returnedEndEvents.length}`);
  assert(returnedEndEvents[0].payload?.status === "returned", "return retry should preserve returned meaning");
  assert(await world.getAttribute("data-run-status") === "returned", "UI should become returned after finish receipt");
  assert(await world.getAttribute("data-confirmed-find-count") === "3", "return receipt should confirm all three Makimodon finds once");

  await context.close();
};

const assertResearchLibraryReturnLayout = async (page, viewport) => {
  const scene = page.getByTestId("research-library-scene");
  const primaryAction = page.getByTestId("research-library-primary-action");
  await scene.waitFor({ timeout: STEP_TIMEOUT_MS });
  await primaryAction.waitFor({ timeout: STEP_TIMEOUT_MS });

  const layout = await scene.evaluate((element) => {
    const primary = element.querySelector('[data-testid="research-library-primary-action"]');
    const book = element.querySelector(".research-library-book-stage");
    const support = element.parentElement?.querySelector(".research-library-support");
    const routeButtons = element.querySelectorAll(".research-route-stage button");
    const meaningfulText = Array.from(element.querySelectorAll(
      ".research-library-book-progress, .research-library-book-story, .research-route-copy, .research-clue-stamp-label"
    ));
    if (!(primary instanceof HTMLElement) || !(book instanceof HTMLElement)) {
      throw new Error("research library book or primary action is missing");
    }

    const sceneRect = element.getBoundingClientRect();
    const primaryRect = primary.getBoundingClientRect();
    const bookBeforePrimary = Boolean(book.compareDocumentPosition(primary) & Node.DOCUMENT_POSITION_FOLLOWING);
    const primaryBeforeSupport = support instanceof HTMLElement
      ? Boolean(primary.compareDocumentPosition(support) & Node.DOCUMENT_POSITION_FOLLOWING)
      : false;
    const minimumMeaningfulFontSize = Math.min(...meaningfulText.map((node) => (
      Number.parseFloat(getComputedStyle(node).fontSize)
    )));

    return {
      sceneLeft: sceneRect.left,
      sceneRight: sceneRect.right,
      primaryTop: primaryRect.top,
      primaryBottom: primaryRect.bottom,
      primaryHeight: primaryRect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      routeButtonCount: routeButtons.length,
      clueStampCount: element.querySelectorAll(".research-clue-stamp").length,
      bookBeforePrimary,
      primaryBeforeSupport,
      minimumMeaningfulFontSize,
    };
  });

  assert(
    layout.sceneLeft >= 0 && layout.sceneRight <= layout.viewportWidth,
    `research library should fit the viewport width; got ${JSON.stringify(layout)}`,
  );
  assert(layout.primaryHeight >= 56, `research library primary action should be at least 56px; got ${layout.primaryHeight}`);
  assert(layout.routeButtonCount === 1, `research library should expose one real route action; got ${layout.routeButtonCount}`);
  assert(layout.clueStampCount === 3, `research library should derive three real clue stamps; got ${layout.clueStampCount}`);
  assert(layout.bookBeforePrimary, "research library DOM should place the book before its primary action");
  assert(layout.primaryBeforeSupport, "research library DOM should place supporting information after its primary action");
  assert(
    layout.minimumMeaningfulFontSize >= 12,
    `research library meaningful copy should stay at least 12px; got ${layout.minimumMeaningfulFontSize}`,
  );
  if (viewport.width === 390 && viewport.height === 844) {
    assert(
      layout.primaryBottom <= 620,
      `research library primary action should stay above fold at 390x844; got bottom ${layout.primaryBottom}`,
    );
  }
};

const scenarioLightBridgeVerticalSlice = async (
  browser,
  viewport = { width: 390, height: 844 },
) => {
  const context = await browser.newContext({
    baseURL: activeBaseUrl,
    reducedMotion: "reduce",
    viewport,
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__SANSU_E2E__ = {
      ...(window.__SANSU_E2E__ || {}),
      exploreRun: { seed: "light-bridge-vertical-slice", now: 1000 },
    };
  });
  await clearClientStorage(page);

  await completeOnboarding(page, /足し算まで/);
  await clearIndexedDbRows(page, "memoryMath");
  await waitForExploreFirstProblemReady(page);

  const logsBefore = await countIndexedDbRows(page, "logs");
  await solveMakimodonOpening(page);
  // Seed the authored addition skills before the next immutable three-question
  // segment is reserved. Pinning the run above keeps both viewports on the
  // same encounter instead of making visual coverage depend on random run data.
  await seedDueMathSkills(page, [
    "add_1d_1_bridge",
    "add_1d_2_bridge",
    "add_2d1d_nc_bridge",
    "add_2d1d_c_bridge",
  ]);
  await chooseFirstExploreRoute(page);
  await solveExploreAndWaitForNextProblem(page);
  assert(
    await page.locator(".explore-world").getAttribute("data-run-steps") === "4",
    "the light bridge should be the fifth depth after the first Firefly clue",
  );
  assert(
    await page.getByLabel("ちょうさノート 手掛かり 1/3").isVisible(),
    "the first post-Makimodon correct answer should award Firefly clue one",
  );

  const lightBridge = page.locator(".explore-immersive");
  await lightBridge.waitFor({ timeout: STEP_TIMEOUT_MS });
  assert(
    await page.locator('.explore-research-slip, [data-testid="explore-discovery-toast"]').count() === 0,
    "an ordinary Q4 clue must not overlap the dedicated light-bridge encounter",
  );
  const lightBridgeIdentity = await lightBridge.evaluate((element) => ({
    lineageId: element.getAttribute("data-visual-lineage-id"),
    candidateId: element.getAttribute("data-visual-candidate-id"),
    mode: element.getAttribute("data-visual-mode"),
    sceneId: element.getAttribute("data-visual-scene-id"),
  }));
  assert(
    lightBridgeIdentity.lineageId === "pokko-field-v1"
      && lightBridgeIdentity.candidateId === "pokko-painted-encounters-v5"
      && lightBridgeIdentity.mode === "world-painted"
      && lightBridgeIdentity.sceneId === "light-bridge-idle",
    `the painted light bridge should enter with its Pokko idle identity; got ${JSON.stringify(lightBridgeIdentity)}`,
  );
  assert(
    await lightBridge.locator('[data-action-prop="bridge-leaf-clasp"]').count() === 0,
    "the disconnected bridge must not show its leaf clasp before the answer",
  );
  assert(
    (await page.getByTestId("explore-attempt").getAttribute("data-gate-id"))?.endsWith(":node-5-0"),
    "the visible light bridge should occupy depth five",
  );
  await page.waitForFunction(
    () => document.activeElement?.id === "explore-problem-title",
    undefined,
    { timeout: STEP_TIMEOUT_MS },
  );
  const layout = await lightBridge.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const buttonHeights = Array.from(element.querySelectorAll("button"))
      .map((button) => button.getBoundingClientRect().height);
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      minimumButtonHeight: Math.min(...buttonHeights),
    };
  });
  assert(
    layout.left >= 0
      && layout.right <= layout.viewportWidth
      && layout.top >= 0
      && layout.bottom <= layout.viewportHeight,
    `light bridge should fit ${viewport.width}x${viewport.height}; got ${JSON.stringify(layout)}`,
  );
  assert(
    layout.minimumButtonHeight >= 44,
    `light bridge controls should stay at least 44px high; got ${layout.minimumButtonHeight}`,
  );
  assert(
    await page.locator('[aria-label="たし算の まとまり ヒント"]').isVisible(),
    "light bridge should connect its fifth-depth attempt to the quantity visual",
  );

  const energyBeforeMiss = Number(
    await page.getByRole("progressbar", { name: "ひかり" }).getAttribute("aria-valuenow"),
  );
  await page.keyboard.type("99999999");
  await page.getByRole("button", { name: "こたえる" }).click();
  await page.getByText(/橋が ぽよん/).waitFor({ timeout: STEP_TIMEOUT_MS });
  assert(
    await lightBridge.getAttribute("data-visual-scene-id") === "light-bridge-idle",
    "an incorrect answer should keep the painted bridge physically disconnected",
  );
  assert(
    await lightBridge.locator('[data-action-prop="bridge-leaf-clasp"]').count() === 0,
    "an incorrect answer must not add the leaf bridge clasp",
  );
  assert(
    await page.getByRole("button", { name: "たんけんを おえて 基地へ帰る" }).isDisabled(),
    "return should stay disabled during incorrect feedback",
  );
  await waitForExploreEnergy(page, energyBeforeMiss - 1);
  const energyAfterMiss = Number(
    await page.getByRole("progressbar", { name: "ひかり" }).getAttribute("aria-valuenow"),
  );
  assert(
    energyAfterMiss === energyBeforeMiss - 1,
    `light bridge miss should consume one light; got ${energyBeforeMiss} -> ${energyAfterMiss}`,
  );
  await page.getByText(/左右の 葉っぱを見て、もういちど ためせるよ/)
    .waitFor({ timeout: STEP_TIMEOUT_MS });

  const bridgeAttemptKey = await page.getByTestId("explore-attempt").getAttribute("data-attempt-key");
  assert(bridgeAttemptKey, "light bridge retry should expose its attempt key");
  await solveExploreAddition(page);
  await page.getByText(/せいかい！ 葉っぱが ぱちんと つながった/).waitFor({ timeout: STEP_TIMEOUT_MS });
  assert(
    await lightBridge.getAttribute("data-visual-scene-id") === "light-bridge-complete",
    "the painted bridge should reveal its connected plate on a correct answer",
  );
  assert(
    await lightBridge.locator('[data-action-prop="bridge-leaf-clasp"]').count() === 1,
    "a correct answer should expose exactly one baked-in leaf clasp",
  );
  await page.waitForFunction(() => {
    const image = document.querySelector(
      '.explore-immersive[data-visual-surface-id="explore-encounter-light-bridge"] .explore-immersive-scene-complete.is-visible',
    );
    return image instanceof HTMLImageElement
      && Number.parseFloat(getComputedStyle(image).opacity || "0") >= 0.98;
  }, undefined, { timeout: STEP_TIMEOUT_MS });
  const connectedBridgeCrop = await readPaintedEncounterCrop(lightBridge, {
    surfaceId: "explore-encounter-light-bridge",
    sceneId: "light-bridge-complete",
  });
  assert(
    connectedBridgeCrop.pass && connectedBridgeCrop.physicalPayoff?.pass,
    `the connected bridge and painted latch must stay visible at the authored action point at ${viewport.width}x${viewport.height}: ${JSON.stringify(connectedBridgeCrop)}`,
  );
  await writeVisualAuditScreenshot(
    page,
    `/tmp/sansu-light-bridge-${viewport.width}x${viewport.height}.png`,
  );
  await waitForNewExploreAttempt(page, bridgeAttemptKey);
  assert(
    await page.getByTestId("rapid-loop-equation").isVisible(),
    "the sixth-depth Firefly clue should return to an ordinary rapid-loop problem",
  );
  assert(
    await page.getByLabel("ちょうさノート 手掛かり 2/3").isVisible(),
    "the depth-five bridge answer should award Firefly clue two",
  );

  const ordinaryFirefly = page.locator(
    '.explore-immersive[data-visual-surface-id="explore-ordinary-firefly"]',
  );
  const ordinaryFireflyCrop = await readPaintedFireflyCrop(ordinaryFirefly);
  assert(
    ordinaryFireflyCrop.pass,
    `the painted Firefly actors and action must stay above the answer fade at ${viewport.width}x${viewport.height}: ${JSON.stringify(ordinaryFireflyCrop)}`,
  );

  const ordinaryToast = page.locator(".explore-research-slip");
  await ordinaryToast.waitFor({ timeout: RAPID_LOOP_CI_BUDGET_MS });
  assert(await page.getByRole("dialog").count() === 0, "ordinary discovery should be a toast, not a modal");
  const rapidAttemptKey = await page.getByTestId("explore-attempt").getAttribute("data-attempt-key");
  assert(rapidAttemptKey, "ordinary rapid-loop problem should expose an attempt key");
  const rapidAnswer = await getExploreNumericAnswer(page);
  await page.keyboard.type(String(rapidAnswer));
  assert(await ordinaryToast.isVisible(), "ordinary discovery toast should remain visible while the next answer is entered");
  assert(
    await page.locator(`[aria-label="こたえ ${rapidAnswer}"]`).isVisible(),
    "the next problem should accept input while the ordinary discovery toast is visible",
  );
  await page.getByRole("button", { name: "こたえる" }).click();
  await waitForNewExploreAttempt(page, rapidAttemptKey);
  assert(
    await page.getByLabel("ちょうさノート 手掛かり 3/3").isVisible(),
    "the sixth-depth correct answer should award Firefly clue three",
  );
  assert(
    (await page.getByTestId("explore-attempt").getAttribute("data-gate-id"))?.endsWith(":node-7-0"),
    "the single seventh-depth route should advance without another choice",
  );

  const logsAfter = await countIndexedDbRows(page, "logs");
  assert(
    logsAfter === logsBefore + 7,
    `explore should atomically record both misses and clears in learning logs; got ${logsBefore} -> ${logsAfter}`,
  );

  await context.close();
};

const scenarioRootTangleVerticalSlice = async (
  browser,
  viewport = { width: 390, height: 844 },
) => {
  const context = await browser.newContext({
    baseURL: activeBaseUrl,
    reducedMotion: "reduce",
    viewport,
  });
  const page = await context.newPage();
  await clearClientStorage(page);

  // Grade 1 + subtraction check resolves to curriculum level 10, where the
  // dedicated root encounter can use a profile-near subtraction problem.
  await completeOnboarding(page, /引き算まで/, /小学 1 年生/);
  // Onboarding marks prior levels as retired. Removing those seeded rows keeps
  // this encounter slice on its selected subtraction level instead of allowing
  // the low-rate maintenance branch to substitute an unrelated counting item.
  await clearIndexedDbRows(page, "memoryMath");
  await waitForExploreFirstProblemReady(page);

  const logsBefore = await countIndexedDbRows(page, "logs");
  await solveMakimodonOpening(page);
  await chooseFirstExploreRoute(page);
  await solveExploreAndWaitForNextProblem(page);
  assert(
    await page.getByLabel("ちょうさノート 手掛かり 1/3").isVisible(),
    "the fourth correct answer should award Firefly clue one",
  );
  assert(
    (await page.getByTestId("explore-attempt").getAttribute("data-gate-id"))?.endsWith(":node-5-0"),
    "the bridge should remain visible at depth five on the way to the root tangle",
  );
  await solveExploreAndWaitForNextProblem(page);
  assert(
    await page.getByLabel("ちょうさノート 手掛かり 2/3").isVisible(),
    "the bridge answer should award Firefly clue two",
  );
  await seedDueMathSkills(page, [
    "sub_1d1d_nc_bridge",
    "sub_1d1d_c_bridge",
    "sub_2d1d_nc_bridge",
    "sub_2d1d_c_bridge",
  ]);
  await solveExploreAndWaitForNextProblem(page);
  assert(
    await page.getByLabel("ちょうさノート 手掛かり 3/3").isVisible(),
    "the sixth correct answer should award Firefly clue three",
  );
  assert(
    await page.locator(".explore-world").getAttribute("data-run-steps") === "6",
    "the root-tangle problem should open before the seventh correct answer",
  );
  assert(
    (await page.getByTestId("explore-attempt").getAttribute("data-gate-id"))?.endsWith(":node-7-0"),
    "the root tangle should occupy depth seven",
  );

  const rootEquation = page.getByTestId("root-tangle-equation");
  await rootEquation.waitFor({ timeout: STEP_TIMEOUT_MS });
  const rootStage = page.locator('.explore-immersive');
  await rootStage.waitFor({ timeout: STEP_TIMEOUT_MS });
  const rootOverlapArtifacts = await page
    .locator('.explore-research-slip, [data-testid="explore-discovery-toast"]')
    .evaluateAll((elements) => elements.flatMap((element) => {
      const bounds = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      if (
        style.display === "none"
        || style.visibility === "hidden"
        || Number(style.opacity) <= 0.01
        || bounds.width <= 0
        || bounds.height <= 0
      ) return [];
      return [{
        className: element.className,
        testId: element.getAttribute("data-testid"),
        role: element.getAttribute("role"),
        text: element.textContent?.replace(/\s+/g, " ").trim().slice(0, 160),
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        bounds: {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        },
      }];
    }));
  const rootOverlapContext = {
    encounter: await page.locator(".explore-run-grid").getAttribute("data-encounter"),
    gateId: await page.getByTestId("explore-attempt").getAttribute("data-gate-id"),
    artifacts: rootOverlapArtifacts,
  };
  assert(
    rootOverlapArtifacts.length === 0,
    `the ordinary Q6 clue must not overlap the dedicated root-tangle encounter: ${JSON.stringify(rootOverlapContext)}`,
  );
  assert(
    await rootStage.getAttribute("data-visual-lineage-id") === "pokko-field-v1"
      && await rootStage.getAttribute("data-visual-candidate-id") === "pokko-painted-encounters-v5"
      && await rootStage.getAttribute("data-visual-mode") === "world-painted"
      && await rootStage.getAttribute("data-visual-scene-id") === "root-tangle-tangled",
    "the painted root tangle should enter with its Pokko tangled identity",
  );
  const rootCameraKey = await rootStage.getAttribute("data-camera-key");
  assert(rootCameraKey === "root-tangle-camera-v1", "root tangle should expose its locked camera");
  assert(
    await rootStage.locator(".explore-immersive-state").getByText("道が ぎゅうぎゅう").isVisible(),
    "root tangle should keep its current world state visible during a combo",
  );
  assert(
    await rootStage.locator(".explore-immersive-combo").getByText(/\d+ れんさ/).isVisible(),
    "root tangle should show combo as a separate badge beside the world state",
  );

  const layout = await rootStage.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const buttonHeights = Array.from(element.querySelectorAll("button"))
      .map((button) => button.getBoundingClientRect().height);
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      minimumButtonHeight: Math.min(...buttonHeights),
    };
  });
  assert(
    layout.left >= 0
      && layout.right <= layout.viewportWidth
      && layout.top >= 0
      && layout.bottom <= layout.viewportHeight,
    `root tangle should fit ${viewport.width}x${viewport.height}; got ${JSON.stringify(layout)}`,
  );
  assert(
    layout.minimumButtonHeight >= 44,
    `root tangle controls should stay at least 44px high; got ${layout.minimumButtonHeight}`,
  );
  const rootHint = page.locator('[aria-label="ひき算の のこりかた ヒント"]');
  assert(
    await rootHint.isVisible(),
    "root tangle should connect the first attempt to its quantity visual",
  );

  const correctAnswer = await getExploreNumericAnswer(page);
  const energyBeforeMiss = Number(
    await page.getByRole("progressbar", { name: "ひかり" }).getAttribute("aria-valuenow"),
  );
  await page.keyboard.type(String(correctAnswer + 1));
  await page.getByRole("button", { name: "こたえる" }).click();
  await page.getByText(/根っこが くるん/).waitFor({ timeout: STEP_TIMEOUT_MS });
  assert(
    await rootStage.getAttribute("data-visual-scene-id") === "root-tangle-tangled",
    "an incorrect answer should keep the painted roots physically tangled",
  );
  await waitForExploreEnergy(page, energyBeforeMiss - 1);
  const energyAfterMiss = Number(
    await page.getByRole("progressbar", { name: "ひかり" }).getAttribute("aria-valuenow"),
  );
  assert(
    energyAfterMiss === energyBeforeMiss - 1,
    `root-tangle miss should consume one light; got ${energyBeforeMiss} -> ${energyAfterMiss}`,
  );
  await page.getByText(/しきで のこりを見て、もういちど ためせるよ/)
    .waitFor({ timeout: STEP_TIMEOUT_MS });
  const retryHint = rootHint;
  const retryHintCount = await retryHint.count();
  const retryHintLayout = retryHintCount === 1
    ? await retryHint.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return {
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        bottom: rect.bottom,
      };
    })
    : null;
  const rootSkillId = await rootStage.getAttribute("data-skill-id");
  assert(
    retryHintCount === 1 && await retryHint.isVisible(),
    `root-tangle hint should persist for the retry; skill=${rootSkillId}, count=${retryHintCount}, layout=${JSON.stringify(retryHintLayout)}`,
  );

  const questionBeforeSecondMiss = await rootStage.getAttribute("data-question-text");
  const secondAnswer = await getExploreNumericAnswer(page);
  await page.keyboard.type(String(secondAnswer + 1));
  await page.getByRole("button", { name: "こたえる" }).click();
  await page.getByText(/根っこが くるん/).waitFor({ timeout: STEP_TIMEOUT_MS });
  assert(
    await rootStage.getAttribute("data-question-text") === questionBeforeSecondMiss,
    "root tangle should hold the failed equation until its incorrect feedback finishes",
  );
  await page.getByText(/しきで のこりを見て、もういちど ためせるよ/)
    .waitFor({ timeout: STEP_TIMEOUT_MS });
  assert(
    await retryHint.isVisible(),
    "root-tangle quantity visual should remain available after the assistance refresh",
  );

  const rootAttemptKey = await page.getByTestId("explore-attempt").getAttribute("data-attempt-key");
  assert(rootAttemptKey, "root-tangle retry should expose an attempt key");
  const refreshedAnswer = await getExploreNumericAnswer(page);
  await page.keyboard.type(String(refreshedAnswer));
  await page.getByRole("button", { name: "こたえる" }).click();
  await page.getByText(/せいかい！ ねっこが ぱっと ほどけた/).waitFor({ timeout: STEP_TIMEOUT_MS });
  assert(
    await rootStage.getAttribute("data-visual-scene-id") === "root-tangle-open",
    "the painted root tangle should reveal its opened passage after a correct answer",
  );
  const observationScene = page.getByTestId("explore-observation-scene");
  await observationScene.waitFor({ timeout: RAPID_LOOP_CI_BUDGET_MS });
  const observationDiorama = observationScene.locator("xpath=parent::*");
  assert(
    await observationDiorama.getAttribute("data-visual-lineage-id") === "pokko-field-v1"
      && await observationDiorama.getAttribute("data-visual-mode") === "observation"
      && await observationDiorama.getAttribute("data-camera-key") === rootCameraKey,
    "Q7 should carry the committed root observation into the same-camera payoff",
  );
  await closeBlockingResearchDiscovery(page, /大発見！.*ねっこの むこうの ひかり道/, 3);
  await waitForNewExploreAttempt(page, rootAttemptKey);

  const finalAttemptKey = await page.getByTestId("explore-attempt").getAttribute("data-attempt-key");
  assert(finalAttemptKey, "eighth-depth rapid-loop problem should expose an attempt key");
  await solveExploreNumericProblem(page);
  await waitForRouteBreakPastOptionalRareDiscovery(page);
  const primaryReturn = page.getByTestId("explore-run-primary-return");
  await primaryReturn.waitFor({ timeout: STEP_TIMEOUT_MS });
  assert(
    await page.getByRole("button", { name: "ここまでを ノートに のこす" }).count() === 0,
    "terminal route should replace the voluntary notebook action",
  );
  await primaryReturn.click();
  await page.locator("#return-summary-title").waitFor({ timeout: STEP_TIMEOUT_MS });
  await assertResearchLibraryReturnLayout(page, viewport);
  assert(
    await page.getByLabel("つぎの たんけんの けはい").isVisible(),
    "return summary should turn an unopened route into a next-run goal",
  );
  const completedRunId = await page.locator(".explore-world").getAttribute("data-run-id");
  await page.getByTestId("research-library-primary-action").click();
  await waitForExploreFirstProblemReady(page);
  assert(
    await page.locator(".explore-world").getAttribute("data-run-id") !== completedRunId,
    "replay should start a new run instead of reviving the returned run",
  );
  const freshWorld = page.locator(".explore-world");
  assert(await freshWorld.getAttribute("data-run-status") === "active", "replay should be active");
  assert(await freshWorld.getAttribute("data-run-steps") === "0", "replay should reset steps");
  assert(
    await freshWorld.getAttribute("data-confirmed-find-count") === "0",
    "replay should clear confirmed finds",
  );
  assert(await page.locator("#return-summary-title").count() === 0, "replay should clear summary");
  assert(
    await page.locator('.explore-research-overlay[role="dialog"], [role="dialog"][aria-labelledby="discovery-title"]').count() === 0,
    "replay should clear discovery dialogs",
  );
  await page.getByLabel("こたえ 未入力").waitFor({ timeout: STEP_TIMEOUT_MS });

  const logsAfter = await countIndexedDbRows(page, "logs");
  assert(
    logsAfter === logsBefore + 10,
    `explore should feed every rapid-loop attempt into formal learning; got ${logsBefore} -> ${logsAfter}`,
  );

  await context.close();
};

const scenarioParentsGateShown = async (browser) => {
  const context = await browser.newContext({ baseURL: activeBaseUrl });
  const page = await context.newPage();
  await clearClientStorage(page);

  await completeOnboarding(page);
  await page.evaluate(() => {
    window.location.hash = "/parents";
  });
  await waitForHash(page, /#\/parents/);
  await page.getByText("ほごしゃ かくにん").waitFor({ timeout: STEP_TIMEOUT_MS });
  await page.getByRole("button", { name: "やめる" }).click();
  await waitForHash(page, /#\/(settings|onboarding)/);

  await context.close();
};

const visualAuditPathExists = async (candidatePath) => {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
};

const isPathInside = (candidatePath, parentPath) => (
  candidatePath === parentPath
  || candidatePath.startsWith(`${parentPath}${path.sep}`)
);

const createVisualAuditWorkspace = async (requestedOutputDir) => {
  assert(requestedOutputDir, "SANSU_VISUAL_AUDIT_OUTPUT_DIR is required");
  const finalDir = path.resolve(requestedOutputDir);
  const filesystemRoot = path.parse(finalDir).root;
  assert(finalDir !== filesystemRoot, "visual audit output cannot be a filesystem root");
  assert(
    !isPathInside(finalDir, LEGACY_VISUAL_AUDIT_DIR),
    `visual audit output must not touch the protected legacy evidence directory: ${LEGACY_VISUAL_AUDIT_DIR}`,
  );
  assert(
    !(await visualAuditPathExists(finalDir)),
    `visual audit output already exists; refusing to overwrite it: ${finalDir}`,
  );

  const parentDir = path.dirname(finalDir);
  await fs.mkdir(parentDir, { recursive: true });
  const tempDir = path.join(
    parentDir,
    `.${path.basename(finalDir)}.tmp-${randomUUID()}`,
  );
  await fs.mkdir(tempDir, { recursive: false });
  return { finalDir, tempDir };
};

const sha256File = async (filePath) => {
  const contents = await fs.readFile(filePath);
  return createHash("sha256").update(contents).digest("hex");
};

const hashVisualAuditDirectoryTree = async (rootDir) => {
  const files = [];
  const compareCodeUnits = (left, right) => (
    left < right ? -1 : left > right ? 1 : 0
  );
  const visit = async (directory, prefix = "") => {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => compareCodeUnits(left.name, right.name));
    for (const entry of entries) {
      const relativePath = prefix
        ? `${prefix}/${entry.name}`
        : entry.name;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`visual audit dist tree must not contain symlinks: ${relativePath}`);
      }
      if (entry.isDirectory()) {
        await visit(absolutePath, relativePath);
        continue;
      }
      assert(entry.isFile(), `visual audit dist tree contains unsupported entry: ${relativePath}`);
      const contents = await fs.readFile(absolutePath);
      files.push({
        path: relativePath,
        bytes: contents.byteLength,
        sha256: createHash("sha256").update(contents).digest("hex"),
      });
    }
  };
  await visit(rootDir);
  files.sort((left, right) => compareCodeUnits(left.path, right.path));
  const aggregate = createHash("sha256");
  let totalBytes = 0;
  for (const file of files) {
    aggregate.update(file.path);
    aggregate.update("\0");
    aggregate.update(String(file.bytes));
    aggregate.update("\0");
    aggregate.update(file.sha256);
    aggregate.update("\n");
    totalBytes += file.bytes;
  }
  return {
    sha256: aggregate.digest("hex"),
    fileCount: files.length,
    totalBytes,
  };
};

const normalizeVisualAuditBaseUrl = (rawBaseUrl) => {
  assert(rawBaseUrl, "SANSU_VISUAL_AUDIT_BASE_URL is required");
  const target = new URL(rawBaseUrl);
  assert(
    target.protocol === "https:" || target.protocol === "http:",
    `visual audit target must use HTTP(S); got ${target.protocol}`,
  );
  target.hash = "";
  target.search = "";
  return target.toString().replace(/\/$/, "");
};

const readVisualAuditTargetVersion = async (baseUrl) => {
  assert(
    VISUAL_AUDIT_EXPECTED_REVISION,
    "SANSU_VISUAL_AUDIT_EXPECTED_REVISION is required",
  );
  assert(
    /^[0-9a-f]{40}$/.test(VISUAL_AUDIT_EXPECTED_REVISION),
    "SANSU_VISUAL_AUDIT_EXPECTED_REVISION must be a full lowercase Git commit SHA",
  );
  const versionUrl = new URL("version.json", `${baseUrl}/`);
  versionUrl.searchParams.set("visualAudit", Date.now().toString());
  const response = await fetch(versionUrl, {
    headers: {
      "cache-control": "no-cache, no-store, must-revalidate",
      pragma: "no-cache",
    },
  });
  assert(response.ok, `visual audit target version request failed: ${response.status} ${versionUrl}`);
  const version = await response.json();
  assert(typeof version.revision === "string" && version.revision, "version.json must expose revision");
  assert(
    version.revision !== "development-local",
    "release visual audit requires a deployed build revision, not development-local",
  );
  assert(
    version.revision === VISUAL_AUDIT_EXPECTED_REVISION,
    `visual audit target revision must equal SANSU_VISUAL_AUDIT_EXPECTED_REVISION; got ${version.revision}`,
  );
  assert(typeof version.delivery === "string" && version.delivery, "version.json must expose delivery");
  assert(
    version.delivery === "snap-root-v1",
    `visual audit target must be built with snap-root-v1; got ${version.delivery}`,
  );
  assert(
    version.visualLineage === "pokko-field-v1",
    `version.json visualLineage must be pokko-field-v1; got ${version.visualLineage}`,
  );
  return {
    url: versionUrl.toString(),
    version: version.version ?? null,
    revision: version.revision,
    delivery: version.delivery,
    visualLineage: version.visualLineage,
  };
};

const attestRequiredVisualAssets = async (baseUrl) => {
  const assets = [];
  for (const [assetPath, expectedSha256] of Object.entries(
    REQUIRED_VISUAL_ASSET_SHA256,
  )) {
    const assetUrl = new URL(assetPath, `${baseUrl}/`);
    assetUrl.searchParams.set("visualAuditAsset", Date.now().toString());
    const response = await fetch(assetUrl, {
      headers: {
        "cache-control": "no-cache, no-store, must-revalidate",
        pragma: "no-cache",
      },
    });
    assert(response.ok, `required painted asset request failed: ${response.status} ${assetUrl}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    assert(
      sha256 === expectedSha256,
      `required painted asset changed without a new approved contract: ${assetPath} expected ${expectedSha256}, got ${sha256}`,
    );
    assets.push({
      path: assetPath,
      sha256,
      bytes: bytes.byteLength,
      contentType: response.headers.get("content-type"),
      pass: true,
    });
  }
  return {
    contract: "pokko-field-v1-approved-critical-raster-sha256",
    count: assets.length,
    assets,
    pass: true,
  };
};

const readVisualAuditRepositoryState = (expectedRevision) => {
  const headResult = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert(
    headResult.status === 0,
    `visual audit could not read local Git HEAD: ${headResult.stderr || headResult.stdout}`,
  );
  const headRevision = headResult.stdout.trim();
  assert(
    headRevision === expectedRevision,
    `visual audit target revision ${expectedRevision} must equal local Git HEAD ${headRevision}`,
  );
  const treeResult = spawnSync("git", ["rev-parse", "HEAD^{tree}"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert(
    treeResult.status === 0,
    `visual audit could not read local Git source tree: ${treeResult.stderr || treeResult.stdout}`,
  );
  const headTree = treeResult.stdout.trim();
  assert(/^[0-9a-f]{40}$/.test(headTree), `visual audit got an invalid HEAD tree: ${headTree}`);

  const statusResult = spawnSync(
    "git",
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    {
    cwd: process.cwd(),
    encoding: "utf8",
    },
  );
  assert(
    statusResult.status === 0,
    `visual audit could not read local Git status: ${statusResult.stderr || statusResult.stdout}`,
  );
  const statusRecords = statusResult.stdout.split("\0");
  const dirtyEntries = [];
  for (let index = 0; index < statusRecords.length; index += 1) {
    const record = statusRecords[index];
    if (!record) continue;
    const status = record.slice(0, 2);
    const paths = [record.slice(3)];
    if (status.includes("R") || status.includes("C")) {
      const originalPath = statusRecords[index + 1];
      assert(originalPath, `visual audit could not parse renamed Git path: ${record}`);
      paths.push(originalPath);
      index += 1;
    }
    dirtyEntries.push({ status, path: paths[0], paths });
  }
  const runtimeInputPrefixes = [
    ".env",
    "index.html",
    "package.json",
    "package-lock.json",
    "postcss.config",
    "public/",
    "scripts/",
    "src/",
    "tailwind.config",
    "tools/",
    "tsconfig",
    "vite.config",
  ];
  const dirtyRuntimeInputs = dirtyEntries.filter(({ paths }) => (
    paths.some((candidatePath) => runtimeInputPrefixes.some((prefix) => (
      prefix.endsWith("/")
        ? candidatePath.startsWith(prefix)
        : candidatePath === prefix || candidatePath.startsWith(`${prefix}.`)
    )))
  ));
  assert(
    dirtyRuntimeInputs.length === 0,
    `visual audit refuses dirty runtime inputs: ${JSON.stringify(dirtyRuntimeInputs)}`,
  );

  return {
    headRevision,
    headTree,
    targetMatchesHead: true,
    dirty: dirtyEntries.length > 0,
    dirtyRuntimeInputs,
    nonRuntimeDirtyEntryCount: dirtyEntries.length,
  };
};

const readVisualAuditBuildProvenance = async ({
  targetVersion,
  repository,
  baseUrl,
}) => {
  if (!VISUAL_AUDIT_BUILD_PROVENANCE_PATH) {
    return {
      mode: "target-self-identification-plus-local-source-match",
      verifiedExactCleanBuild: false,
      note: "No exact-build wrapper provenance was supplied. Revision metadata, DOM identity, local HEAD, and approved painted assets are verified, but the complete served build is not attested as a clean-HEAD build.",
    };
  }

  const provenancePath = path.resolve(VISUAL_AUDIT_BUILD_PROVENANCE_PATH);
  let provenance;
  try {
    provenance = JSON.parse(await fs.readFile(provenancePath, "utf8"));
  } catch (error) {
    throw new Error(`visual audit could not read build provenance: ${error.message}`);
  }
  assert(
    provenance.schemaVersion === "sansu-exact-clean-build-v1"
      && provenance.wrapperId === "sansu-local-visual-audit-v1",
    `visual audit build provenance schema is unsupported: ${JSON.stringify(provenance)}`,
  );
  assert(
    provenance.revision === targetVersion.revision
      && provenance.sourceTreeSha === repository.headTree
      && provenance.delivery === targetVersion.delivery
      && provenance.visualLineage === targetVersion.visualLineage
      && normalizeVisualAuditBaseUrl(provenance.baseUrl) === baseUrl,
    `visual audit build provenance identity mismatch: ${JSON.stringify({ provenance, targetVersion, repository, baseUrl })}`,
  );
  assert(
    typeof provenance.packageLockSha256 === "string"
      && /^[0-9a-f]{64}$/.test(provenance.packageLockSha256)
      && typeof provenance.nodeVersion === "string"
      && typeof provenance.npmVersion === "string",
    `visual audit build provenance is missing dependency/runtime identity: ${JSON.stringify(provenance)}`,
  );
  const localPackageLockSha256 = await sha256File(path.resolve("package-lock.json"));
  assert(
    localPackageLockSha256 === provenance.packageLockSha256,
    `visual audit build provenance package-lock does not match exact local HEAD: ${JSON.stringify({ expected: provenance.packageLockSha256, actual: localPackageLockSha256 })}`,
  );
  assert(
    provenance.targetAttestation
      && provenance.targetAttestation.path === VISUAL_AUDIT_TARGET_ATTESTATION_FILE
      && typeof provenance.targetAttestation.nonce === "string"
      && provenance.targetAttestation.nonce.length >= 16
      && /^[0-9a-f]{64}$/.test(provenance.targetAttestation.sha256),
    `visual audit build provenance is missing its served-target nonce: ${JSON.stringify(provenance)}`,
  );
  const targetAttestationUrl = new URL(
    provenance.targetAttestation.path,
    `${baseUrl}/`,
  );
  targetAttestationUrl.searchParams.set("visualAuditTarget", randomUUID());
  const targetAttestationResponse = await fetch(targetAttestationUrl, {
    headers: {
      "cache-control": "no-cache, no-store, must-revalidate",
      pragma: "no-cache",
    },
  });
  assert(
    targetAttestationResponse.ok,
    `visual audit served-target attestation request failed: ${targetAttestationResponse.status} ${targetAttestationUrl}`,
  );
  const targetAttestationBytes = Buffer.from(
    await targetAttestationResponse.arrayBuffer(),
  );
  let targetAttestation;
  try {
    targetAttestation = JSON.parse(targetAttestationBytes.toString("utf8"));
  } catch (error) {
    throw new Error(`visual audit served-target attestation is invalid JSON: ${error.message}`);
  }
  assert(
    createHash("sha256").update(targetAttestationBytes).digest("hex")
        === provenance.targetAttestation.sha256
      && targetAttestation.schemaVersion === "sansu-local-visual-audit-target-v1"
      && targetAttestation.wrapperId === provenance.wrapperId
      && targetAttestation.revision === provenance.revision
      && targetAttestation.sourceTreeSha === provenance.sourceTreeSha
      && targetAttestation.nonce === provenance.targetAttestation.nonce,
    `visual audit target is not the exact dist identified by build provenance: ${JSON.stringify({ expected: provenance.targetAttestation, actual: targetAttestation })}`,
  );
  assert(
    provenance.dist
      && typeof provenance.dist.path === "string"
      && /^[0-9a-f]{64}$/.test(provenance.dist.sha256),
    `visual audit build provenance is missing its dist tree: ${JSON.stringify(provenance)}`,
  );
  const distTree = await hashVisualAuditDirectoryTree(path.resolve(provenance.dist.path));
  assert(
    distTree.sha256 === provenance.dist.sha256
      && distTree.fileCount === provenance.dist.fileCount
      && distTree.totalBytes === provenance.dist.totalBytes,
    `visual audit dist tree changed after exact-HEAD build: ${JSON.stringify({ expected: provenance.dist, actual: distTree })}`,
  );
  return {
    schemaVersion: provenance.schemaVersion,
    wrapperId: provenance.wrapperId,
    mode: "exact-clean-head-local-wrapper-v1",
    verifiedExactCleanBuild: true,
    revision: provenance.revision,
    sourceTreeSha: provenance.sourceTreeSha,
    delivery: provenance.delivery,
    visualLineage: provenance.visualLineage,
    baseUrl: provenance.baseUrl,
    createdAt: provenance.createdAt,
    packageLockSha256: provenance.packageLockSha256,
    nodeVersion: provenance.nodeVersion,
    npmVersion: provenance.npmVersion,
    targetAttestation: provenance.targetAttestation,
    dist: distTree,
  };
};

const canonicalVisualAuditBuildProvenance = (provenance) => ({
  schemaVersion: provenance.schemaVersion ?? null,
  wrapperId: provenance.wrapperId ?? null,
  mode: provenance.mode,
  verifiedExactCleanBuild: provenance.verifiedExactCleanBuild,
  revision: provenance.revision ?? null,
  sourceTreeSha: provenance.sourceTreeSha ?? null,
  delivery: provenance.delivery ?? null,
  visualLineage: provenance.visualLineage ?? null,
  baseUrl: provenance.baseUrl
    ? normalizeVisualAuditBaseUrl(provenance.baseUrl)
    : null,
  createdAt: provenance.createdAt ?? null,
  packageLockSha256: provenance.packageLockSha256 ?? null,
  nodeVersion: provenance.nodeVersion ?? null,
  npmVersion: provenance.npmVersion ?? null,
  targetAttestation: provenance.targetAttestation
    ? {
        path: provenance.targetAttestation.path,
        nonce: provenance.targetAttestation.nonce,
        sha256: provenance.targetAttestation.sha256,
      }
    : null,
  dist: provenance.dist
    ? {
        sha256: provenance.dist.sha256,
        fileCount: provenance.dist.fileCount,
        totalBytes: provenance.dist.totalBytes,
      }
    : null,
});

const assertVisualAuditBuildProvenanceStable = (start, current, stage) => {
  const expected = canonicalVisualAuditBuildProvenance(start);
  const actual = canonicalVisualAuditBuildProvenance(current);
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `visual audit build provenance changed ${stage}: ${JSON.stringify({ expected, actual })}`,
  );
};

const clearVisualAuditRuntimeCaches = async (context, page) => {
  await page.evaluate(async () => {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
  });
  const session = await context.newCDPSession(page);
  try {
    await session.send("Network.enable");
    await session.send("Network.clearBrowserCache");
  } finally {
    await session.detach();
  }
};

const createVisualAuditNetworkProbe = async (context, page, targetOrigin) => {
  const entries = [];
  let lastReadIndex = 0;
  const session = await context.newCDPSession(page);
  await session.send("Network.enable");
  session.on("Network.responseReceived", ({ response, type }) => {
    try {
      if (new URL(response.url).origin !== targetOrigin) return;
    } catch {
      return;
    }
    entries.push({
      url: response.url,
      type,
      status: response.status,
      fromDiskCache: Boolean(response.fromDiskCache),
      fromServiceWorker: Boolean(response.fromServiceWorker),
      fromPrefetchCache: Boolean(response.fromPrefetchCache),
    });
  });
  return {
    entries,
    takeEntries: () => {
      const stageEntries = entries.slice(lastReadIndex);
      lastReadIndex = entries.length;
      return stageEntries;
    },
    detach: () => session.detach(),
  };
};

const readVisualAuditCacheState = async (page, networkProbe, label) => {
  const runtime = await page.evaluate(async () => {
    const cacheNames = "caches" in window ? await caches.keys() : [];
    return {
      serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
      cacheNames,
    };
  });
  const entries = networkProbe.takeEntries();
  return {
    label,
    serviceWorkerControlled: runtime.serviceWorkerControlled,
    cacheNames: runtime.cacheNames,
    responseCount: entries.length,
    diskCacheResponseCount: entries.filter((entry) => entry.fromDiskCache).length,
    serviceWorkerResponseCount: entries.filter((entry) => entry.fromServiceWorker).length,
    prefetchCacheResponseCount: entries.filter((entry) => entry.fromPrefetchCache).length,
    cumulativeResponseCount: networkProbe.entries.length,
  };
};

const settleVisualAuditPage = async (page, { waitForFiniteAnimations = true } = {}) => {
  await page.waitForFunction(
    () => !document.fonts || document.fonts.status === "loaded",
    undefined,
    { timeout: VISUAL_AUDIT_SETTLE_TIMEOUT_MS },
  );
  await page.evaluate(async () => {
    if (document.fonts) await document.fonts.ready;
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  });

  if (!waitForFiniteAnimations) {
    await page.evaluate(() => {
      document.getAnimations().forEach((animation) => {
        const endTime = animation.effect?.getComputedTiming().endTime;
        if (typeof endTime === "number" && Number.isFinite(endTime)) {
          try {
            animation.finish();
          } catch {
            // A detached transition can disappear between enumeration and
            // finish. The postcondition below still rejects a live remainder.
          }
        }
      });
    });
  }

  if (waitForFiniteAnimations) {
    await page.waitForFunction(
      () => document.getAnimations().every((animation) => {
        const endTime = animation.effect?.getComputedTiming().endTime;
        const isFinite = typeof endTime === "number" && Number.isFinite(endTime);
        return !isFinite || animation.playState === "finished" || animation.playState === "idle";
      }),
      undefined,
      { timeout: VISUAL_AUDIT_SETTLE_TIMEOUT_MS },
    );
  }
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));

  await page.waitForFunction(
    () => {
      const isVisible = (image) => {
        const style = window.getComputedStyle(image);
        const bounds = image.getBoundingClientRect();
        return style.display !== "none"
          && style.visibility !== "hidden"
          && Number.parseFloat(style.opacity || "1") > 0
          && bounds.width > 0
          && bounds.height > 0
          && bounds.right > 0
          && bounds.bottom > 0
          && bounds.left < window.innerWidth
          && bounds.top < window.innerHeight;
      };
      return Array.from(document.images)
        .filter(isVisible)
        .every((image) => (
          image.complete
          && image.naturalWidth > 0
          && image.naturalHeight > 0
        ));
    },
    undefined,
    { timeout: VISUAL_AUDIT_SETTLE_TIMEOUT_MS },
  );
  await page.evaluate(async () => {
    const isVisible = (image) => {
      const style = window.getComputedStyle(image);
      const bounds = image.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && Number.parseFloat(style.opacity || "1") > 0
        && bounds.width > 0
        && bounds.height > 0
        && bounds.right > 0
        && bounds.bottom > 0
        && bounds.left < window.innerWidth
        && bounds.top < window.innerHeight;
    };
    await Promise.all(
      Array.from(document.images)
        .filter(isVisible)
        .map((image) => image.decode()),
    );
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  });
  if (waitForFiniteAnimations) {
    await page.waitForFunction(
      () => document.getAnimations().every((animation) => {
        const endTime = animation.effect?.getComputedTiming().endTime;
        const isFinite = typeof endTime === "number" && Number.isFinite(endTime);
        return !isFinite || animation.playState === "finished" || animation.playState === "idle";
      }),
      undefined,
      { timeout: VISUAL_AUDIT_SETTLE_TIMEOUT_MS },
    );
  }
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));

  return page.evaluate((settleOptions) => {
    const boundsOf = (element) => {
      const bounds = element.getBoundingClientRect();
      return {
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height,
      };
    };
    const isVisible = (image) => {
      const style = window.getComputedStyle(image);
      const bounds = image.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && Number.parseFloat(style.opacity || "1") > 0
        && bounds.width > 0
        && bounds.height > 0
        && bounds.right > 0
        && bounds.bottom > 0
        && bounds.left < window.innerWidth
        && bounds.top < window.innerHeight;
    };
    const describeAnimation = (animation) => {
      const timing = animation.effect?.getComputedTiming();
      return {
        playState: animation.playState,
        currentTime: typeof animation.currentTime === "number"
          ? animation.currentTime
          : null,
        endTime: typeof timing?.endTime === "number" && Number.isFinite(timing.endTime)
          ? timing.endTime
          : null,
        infinite: timing?.endTime === Infinity,
      };
    };
    const animations = document.getAnimations().map(describeAnimation);
    const visibleImages = Array.from(document.images)
      .filter(isVisible)
      .map((image) => ({
        currentSrc: image.currentSrc || image.src,
        className: image.className,
        complete: image.complete,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        decoded: image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
        opacity: Number.parseFloat(window.getComputedStyle(image).opacity || "1"),
        bounds: boundsOf(image),
      }));
    return {
      finiteAnimationWaitApplied: settleOptions.waitForFiniteAnimations,
      fontsStatus: document.fonts?.status ?? "unsupported",
      visibleImageCount: visibleImages.length,
      allVisibleImagesDecoded: visibleImages.every((image) => image.decoded),
      visibleImages,
      finiteAnimationsRemaining: animations.filter(
        (animation) => !animation.infinite
          && animation.playState !== "finished"
          && animation.playState !== "idle",
      ),
      infiniteAnimations: animations.filter((animation) => animation.infinite),
    };
  }, { waitForFiniteAnimations });
};

const readPaintedEncounterCrop = async (surface, surfaceIdentity) => {
  const focalContractKey = `${surfaceIdentity.surfaceId}:${surfaceIdentity.sceneId}`;
  const sourceFocals = PAINTED_ENCOUNTER_FOCALS[focalContractKey];
  assert(
    sourceFocals,
    `painted encounter has no focal-point contract: ${focalContractKey}`,
  );

  return surface.evaluate(async (element, contract) => {
    const { focalPoints, sceneId, surfaceId } = contract;
    const sceneImages = Array.from(
      element.querySelectorAll("img.explore-immersive-scene"),
    );
    const activeScene = [...sceneImages].reverse().find(
      (image) => image.classList.contains("is-visible"),
    ) ?? sceneImages.find(
      (image) => image.classList.contains("explore-immersive-scene-idle"),
    );
    if (!(activeScene instanceof HTMLImageElement)) {
      return {
        applied: true,
        pass: false,
        error: "No active painted encounter scene image was found.",
        sourceFocals: focalPoints,
      };
    }

    await activeScene.decode();

    const numberFromStyle = (value) => Number.parseFloat(value) || 0;
    const boundsOf = (target) => {
      const bounds = target.getBoundingClientRect();
      return {
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height,
      };
    };
    const style = window.getComputedStyle(activeScene);
    const imageBounds = boundsOf(activeScene);
    const surfaceBounds = boundsOf(element);
    const surfaceStyle = window.getComputedStyle(element);
    const scrim = element.querySelector(".explore-immersive-scrim");
    const scrimBackgroundImage = scrim
      ? window.getComputedStyle(scrim).backgroundImage
      : "";
    const fadeStartToken = surfaceStyle.getPropertyValue("--explore-world-fade-start").trim();
    const fadeStartPercent = Number.parseFloat(fadeStartToken);
    const fadeStartY = Number.isFinite(fadeStartPercent)
      ? surfaceBounds.top + surfaceBounds.height * (fadeStartPercent / 100)
      : Number.NaN;
    const isPortrait = window.innerHeight > window.innerWidth;
    const expectedScrimStops = window.innerWidth >= 1024 && isPortrait
      && window.innerHeight >= 1600
      ? ["70%", "74%", "80%"]
      : window.innerWidth >= 600 && (window.innerWidth <= 1023 || isPortrait)
        ? ["62.5%", "67%", "74%"]
        : window.innerWidth >= 1024
          ? ["72%", "100%"]
          : ["52%", "62%", "73%"];
    const scrimContractPass = expectedScrimStops.every(
      (stop) => scrimBackgroundImage.includes(stop),
    );
    const focalSafeMargin = window.innerWidth >= 600 ? 24 : 16;
    const borderLeft = numberFromStyle(style.borderLeftWidth);
    const borderRight = numberFromStyle(style.borderRightWidth);
    const borderTop = numberFromStyle(style.borderTopWidth);
    const borderBottom = numberFromStyle(style.borderBottomWidth);
    const paddingLeft = numberFromStyle(style.paddingLeft);
    const paddingRight = numberFromStyle(style.paddingRight);
    const paddingTop = numberFromStyle(style.paddingTop);
    const paddingBottom = numberFromStyle(style.paddingBottom);
    const contentBox = {
      left: imageBounds.left + borderLeft + paddingLeft,
      top: imageBounds.top + borderTop + paddingTop,
      width: imageBounds.width
        - borderLeft
        - borderRight
        - paddingLeft
        - paddingRight,
      height: imageBounds.height
        - borderTop
        - borderBottom
        - paddingTop
        - paddingBottom,
    };
    contentBox.right = contentBox.left + contentBox.width;
    contentBox.bottom = contentBox.top + contentBox.height;

    const naturalWidth = activeScene.naturalWidth;
    const naturalHeight = activeScene.naturalHeight;
    const containScale = Math.min(
      contentBox.width / naturalWidth,
      contentBox.height / naturalHeight,
    );
    const coverScale = Math.max(
      contentBox.width / naturalWidth,
      contentBox.height / naturalHeight,
    );
    let scaleX = 0;
    let scaleY = 0;
    let objectFitSupported = true;
    switch (style.objectFit) {
      case "cover":
        scaleX = coverScale;
        scaleY = coverScale;
        break;
      case "contain":
        scaleX = containScale;
        scaleY = containScale;
        break;
      case "fill":
        scaleX = contentBox.width / naturalWidth;
        scaleY = contentBox.height / naturalHeight;
        break;
      case "none":
        scaleX = 1;
        scaleY = 1;
        break;
      case "scale-down":
        scaleX = Math.min(1, containScale);
        scaleY = scaleX;
        break;
      default:
        objectFitSupported = false;
    }

    const renderedWidth = naturalWidth * scaleX;
    const renderedHeight = naturalHeight * scaleY;
    const freeSpaceX = contentBox.width - renderedWidth;
    const freeSpaceY = contentBox.height - renderedHeight;
    const positionTokens = style.objectPosition.trim().split(/\s+/);
    let horizontalToken = positionTokens[0] ?? "50%";
    let verticalToken = positionTokens[1] ?? "50%";
    if (positionTokens.length === 1) {
      if (horizontalToken === "top" || horizontalToken === "bottom") {
        verticalToken = horizontalToken;
        horizontalToken = "50%";
      } else {
        verticalToken = "50%";
      }
    } else if (
      (horizontalToken === "top" || horizontalToken === "bottom")
      && (verticalToken === "left" || verticalToken === "right")
    ) {
      [horizontalToken, verticalToken] = [verticalToken, horizontalToken];
    }
    const parsePosition = (token, axis, freeSpace) => {
      const normalized = token.toLowerCase();
      const keywords = axis === "x"
        ? { left: 0, center: 0.5, right: 1 }
        : { top: 0, center: 0.5, bottom: 1 };
      if (Object.hasOwn(keywords, normalized)) {
        return {
          supported: true,
          token,
          kind: "keyword",
          offset: freeSpace * keywords[normalized],
        };
      }
      if (/^-?(?:\d+|\d*\.\d+)%$/.test(normalized)) {
        return {
          supported: true,
          token,
          kind: "percentage",
          offset: freeSpace * (Number.parseFloat(normalized) / 100),
        };
      }
      if (/^-?(?:\d+|\d*\.\d+)px$/.test(normalized) || normalized === "0") {
        return {
          supported: true,
          token,
          kind: "length",
          offset: Number.parseFloat(normalized),
        };
      }
      return {
        supported: false,
        token,
        kind: "unsupported",
        offset: 0,
      };
    };
    const positionX = parsePosition(horizontalToken, "x", freeSpaceX);
    const positionY = parsePosition(verticalToken, "y", freeSpaceY);
    const objectPositionSupported = positionTokens.length <= 2
      && positionX.supported
      && positionY.supported;
    const offsetX = positionX.offset;
    const offsetY = positionY.offset;

    const shelf = element.querySelector(".explore-immersive-brief");
    const shelfBounds = shelf ? boundsOf(shelf) : null;
    const shelfOverlapsImage = Boolean(shelfBounds)
      && shelfBounds.left < imageBounds.right
      && shelfBounds.right > imageBounds.left;
    const shelfStyle = shelf ? window.getComputedStyle(shelf) : null;
    const backgroundColor = shelfStyle?.backgroundColor ?? null;
    const colorParts = backgroundColor?.match(/[\d.]+%?/g) ?? [];
    const alphaToken = colorParts.length >= 4 ? colorParts[3] : "1";
    const backgroundAlpha = alphaToken.endsWith("%")
      ? Number.parseFloat(alphaToken) / 100
      : Number.parseFloat(alphaToken);
    const shelfOpacity = Number.parseFloat(shelfStyle?.opacity ?? "1");
    const effectiveShelfAlpha = backgroundAlpha * shelfOpacity;
    const shelfIsOpaque = Boolean(shelfBounds)
      && Number.isFinite(effectiveShelfAlpha)
      && effectiveShelfAlpha >= 0.9;

    const isVisibleElement = (target) => {
      if (!(target instanceof HTMLElement || target instanceof SVGElement)) return false;
      const targetStyle = window.getComputedStyle(target);
      const targetBounds = target.getBoundingClientRect();
      return targetStyle.display !== "none"
        && targetStyle.visibility !== "hidden"
        && Number.parseFloat(targetStyle.opacity || "1") > 0
        && targetBounds.width > 0
        && targetBounds.height > 0
        && targetBounds.right > 0
        && targetBounds.bottom > 0
        && targetBounds.left < window.innerWidth
        && targetBounds.top < window.innerHeight;
    };
    const hud = document.querySelector('[data-testid="explore-hud"]');
    const hudBounds = isVisibleElement(hud) ? boundsOf(hud) : null;
    const overlayBounds = Array.from(document.querySelectorAll([
      ".explore-research-slip",
      ".explore-specimen-card",
      ".explore-immersive-brief",
      ".explore-immersive-hint",
      ".explore-immersive-keypad-shell",
    ].join(",")))
      .filter(isVisibleElement)
      .map((target) => ({
        selector: target.className,
        bounds: boundsOf(target),
      }));
    const screenPointState = (viewportX, viewportY) => {
      const belowHud = !hudBounds || viewportY > hudBounds.bottom;
      const occludingOverlays = overlayBounds.filter(({ bounds }) => (
        viewportX >= bounds.left
        && viewportX <= bounds.right
        && viewportY >= bounds.top
        && viewportY <= bounds.bottom
      ));
      return {
        belowHud,
        occludingOverlays,
        unobscured: belowHud && occludingOverlays.length === 0,
      };
    };

    const projectPoint = ([sourceX, sourceY]) => {
      const viewportX = contentBox.left + offsetX + sourceX * scaleX;
      const viewportY = contentBox.top + offsetY + sourceY * scaleY;
      const withinViewport = viewportX >= 0
        && viewportX <= window.innerWidth
        && viewportY >= 0
        && viewportY <= window.innerHeight;
      const withinSurface = viewportX >= surfaceBounds.left
        && viewportX <= surfaceBounds.right
        && viewportY >= surfaceBounds.top
        && viewportY <= surfaceBounds.bottom;
      const aboveShelf = !shelfBounds || !(
        viewportX >= shelfBounds.left
        && viewportX <= shelfBounds.right
        && viewportY >= shelfBounds.top
        && viewportY <= shelfBounds.bottom
      );
      const fadeClearance = fadeStartY - viewportY;
      const aboveFade = Number.isFinite(fadeClearance)
        && fadeClearance >= focalSafeMargin;
      const visibility = screenPointState(viewportX, viewportY);
      return {
        source: { x: sourceX, y: sourceY },
        viewport: { x: viewportX, y: viewportY },
        withinViewport,
        withinSurface,
        aboveShelf,
        aboveFade,
        fadeClearance,
        ...visibility,
        pass: withinViewport
          && withinSurface
          && aboveShelf
          && aboveFade
          && visibility.unobscured,
      };
    };
    const points = {
      actorFace: projectPoint(focalPoints.actorFace),
      actorFeet: projectPoint(focalPoints.actorFeet),
      actionPayoff: projectPoint(focalPoints.actionPayoff),
    };
    const storyViewportRect = {
      left: Math.max(surfaceBounds.left, imageBounds.left, 0),
      right: Math.min(surfaceBounds.right, imageBounds.right, window.innerWidth),
      top: Math.max(
        surfaceBounds.top,
        imageBounds.top,
        hudBounds?.bottom ?? 0,
        0,
      ),
      bottom: Math.min(
        surfaceBounds.bottom,
        imageBounds.bottom,
        shelfOverlapsImage ? shelfBounds.top : Number.POSITIVE_INFINITY,
        fadeStartY - focalSafeMargin,
        window.innerHeight,
      ),
    };
    storyViewportRect.width = Math.max(0, storyViewportRect.right - storyViewportRect.left);
    storyViewportRect.height = Math.max(0, storyViewportRect.bottom - storyViewportRect.top);
    const viewportRectToSource = (rect) => ({
      left: Math.max(0, Math.min(
        naturalWidth,
        (rect.left - contentBox.left - offsetX) / scaleX,
      )),
      right: Math.max(0, Math.min(
        naturalWidth,
        (rect.right - contentBox.left - offsetX) / scaleX,
      )),
      top: Math.max(0, Math.min(
        naturalHeight,
        (rect.top - contentBox.top - offsetY) / scaleY,
      )),
      bottom: Math.max(0, Math.min(
        naturalHeight,
        (rect.bottom - contentBox.top - offsetY) / scaleY,
      )),
    });
    const storySourceRect = viewportRectToSource(storyViewportRect);
    storySourceRect.width = Math.max(0, storySourceRect.right - storySourceRect.left);
    storySourceRect.height = Math.max(0, storySourceRect.bottom - storySourceRect.top);
    storySourceRect.area = storySourceRect.width * storySourceRect.height;
    const physicalPayoffRequired = surfaceId === "explore-encounter-light-bridge"
      && sceneId !== "light-bridge-idle";
    const physicalPayoffId = activeScene.getAttribute("data-action-prop");
    const physicalPayoffExpectedAsset = sceneId === "light-bridge-crossed"
      ? "/assets/explore/light-bridge/scene-crossed-leaf-pokko-v5.jpg"
      : "/assets/explore/light-bridge/scene-complete-leaf-pokko-v5.jpg";
    const physicalPayoffPass = !physicalPayoffRequired || Boolean(
      physicalPayoffId === "bridge-leaf-clasp"
      && activeScene.currentSrc.endsWith(physicalPayoffExpectedAsset)
      && points.actionPayoff.pass,
    );
    const activeOpacity = Number.parseFloat(style.opacity || "1");
    const activeVisible = style.display !== "none"
      && style.visibility !== "hidden"
      && activeOpacity >= 0.98
      && imageBounds.width > 0
      && imageBounds.height > 0
      && imageBounds.right > 0
      && imageBounds.bottom > 0
      && imageBounds.left < window.innerWidth
      && imageBounds.top < window.innerHeight;
    const decoded = activeScene.complete && naturalWidth > 0 && naturalHeight > 0;
    const projectionValid = objectFitSupported
      && objectPositionSupported
      && Number.isFinite(scaleX)
      && Number.isFinite(scaleY)
      && scaleX > 0
      && scaleY > 0;

    return {
      applied: true,
      pass: decoded
        && activeVisible
        && projectionValid
        && scrimContractPass
        && shelfIsOpaque
        && Object.values(points).every((point) => point.pass)
        && physicalPayoffPass,
      sourceFocals: focalPoints,
      activeScene: {
        src: activeScene.getAttribute("src"),
        currentSrc: activeScene.currentSrc,
        className: activeScene.className,
        complete: activeScene.complete,
        decoded,
        naturalWidth,
        naturalHeight,
        display: style.display,
        visibility: style.visibility,
        opacity: activeOpacity,
        objectFit: style.objectFit,
        objectPosition: style.objectPosition,
        bounds: imageBounds,
        contentBox,
      },
      shelf: {
        present: Boolean(shelf),
        bounds: shelfBounds,
        overlapsImage: shelfOverlapsImage,
        backgroundColor,
        backgroundAlpha,
        opacity: shelfOpacity,
        effectiveAlpha: effectiveShelfAlpha,
        opaque: shelfIsOpaque,
      },
      fade: {
        startToken: fadeStartToken,
        startPercent: fadeStartPercent,
        startY: fadeStartY,
        safeMargin: focalSafeMargin,
        scrimBackgroundImage,
        expectedScrimStops,
        scrimContractPass,
      },
      hud: {
        present: Boolean(hud),
        bounds: hudBounds,
      },
      overlays: overlayBounds,
      physicalPayoff: {
        required: physicalPayoffRequired,
        kind: "baked-raster",
        id: physicalPayoffId,
        present: physicalPayoffId === "bridge-leaf-clasp",
        expectedAsset: physicalPayoffExpectedAsset,
        sourcePoint: points.actionPayoff.source,
        projectedPoint: points.actionPayoff.viewport,
        pass: physicalPayoffPass,
      },
      projection: {
        valid: projectionValid,
        objectFitSupported,
        objectPositionSupported,
        scaleX,
        scaleY,
        renderedWidth,
        renderedHeight,
        freeSpaceX,
        freeSpaceY,
        offsetX,
        offsetY,
        positionX,
        positionY,
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      surfaceBounds,
      storyViewportRect,
      storySourceRect,
      points,
    };
  }, {
    focalPoints: sourceFocals,
    sceneId: surfaceIdentity.sceneId,
    surfaceId: surfaceIdentity.surfaceId,
  });
};

const readRootObservationCrop = async (surface) => surface.evaluate(async (element, focalPoints) => {
  const image = element.querySelector("img.explore-observation-scene");
  if (!(image instanceof HTMLImageElement)) {
    return {
      applied: true,
      pass: false,
      error: "The root observation scene image was not found.",
    };
  }
  await image.decode();

  const boundsOf = (target) => {
    const bounds = target.getBoundingClientRect();
    return {
      left: bounds.left,
      right: bounds.right,
      top: bounds.top,
      bottom: bounds.bottom,
      width: bounds.width,
      height: bounds.height,
    };
  };
  const parsePositionRatio = (token, axis) => {
    const normalized = token.toLowerCase();
    const keywords = axis === "x"
      ? { left: 0, center: 0.5, right: 1 }
      : { top: 0, center: 0.5, bottom: 1 };
    if (Object.hasOwn(keywords, normalized)) return keywords[normalized];
    if (/^-?(?:\d+|\d*\.\d+)%$/.test(normalized)) {
      return Number.parseFloat(normalized) / 100;
    }
    return Number.NaN;
  };

  const style = window.getComputedStyle(image);
  const imageBounds = boundsOf(image);
  const surfaceBounds = boundsOf(element);
  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;
  const scale = Math.max(
    imageBounds.width / naturalWidth,
    imageBounds.height / naturalHeight,
  );
  const renderedWidth = naturalWidth * scale;
  const renderedHeight = naturalHeight * scale;
  const freeSpaceX = imageBounds.width - renderedWidth;
  const freeSpaceY = imageBounds.height - renderedHeight;
  const positionTokens = style.objectPosition.trim().split(/\s+/);
  const positionX = parsePositionRatio(positionTokens[0] ?? "50%", "x");
  const positionY = parsePositionRatio(positionTokens[1] ?? "50%", "y");
  const offsetX = freeSpaceX * positionX;
  const offsetY = freeSpaceY * positionY;
  const visibleViewportRect = {
    left: Math.max(surfaceBounds.left, imageBounds.left, 0),
    right: Math.min(surfaceBounds.right, imageBounds.right, window.innerWidth),
    top: Math.max(surfaceBounds.top, imageBounds.top, 0),
    bottom: Math.min(surfaceBounds.bottom, imageBounds.bottom, window.innerHeight),
  };
  visibleViewportRect.width = Math.max(0, visibleViewportRect.right - visibleViewportRect.left);
  visibleViewportRect.height = Math.max(0, visibleViewportRect.bottom - visibleViewportRect.top);
  const sourceRect = {
    left: Math.max(0, (visibleViewportRect.left - imageBounds.left - offsetX) / scale),
    right: Math.min(naturalWidth, (visibleViewportRect.right - imageBounds.left - offsetX) / scale),
    top: Math.max(0, (visibleViewportRect.top - imageBounds.top - offsetY) / scale),
    bottom: Math.min(naturalHeight, (visibleViewportRect.bottom - imageBounds.top - offsetY) / scale),
  };
  sourceRect.width = Math.max(0, sourceRect.right - sourceRect.left);
  sourceRect.height = Math.max(0, sourceRect.bottom - sourceRect.top);
  sourceRect.area = sourceRect.width * sourceRect.height;
  const safeMargin = window.innerWidth >= 600 ? 24 : 16;
  const projectPoint = ([sourceX, sourceY]) => {
    const viewportX = imageBounds.left + offsetX + sourceX * scale;
    const viewportY = imageBounds.top + offsetY + sourceY * scale;
    const edgeClearance = Math.min(
      viewportX - visibleViewportRect.left,
      visibleViewportRect.right - viewportX,
      viewportY - visibleViewportRect.top,
      visibleViewportRect.bottom - viewportY,
    );
    return {
      source: { x: sourceX, y: sourceY },
      viewport: { x: viewportX, y: viewportY },
      edgeClearance,
      pass: edgeClearance >= safeMargin,
    };
  };
  const points = {
    actorFace: projectPoint(focalPoints.actorFace),
    actorFeet: projectPoint(focalPoints.actorFeet),
    actionPayoff: projectPoint(focalPoints.actionPayoff),
  };
  const decoded = image.complete && naturalWidth > 0 && naturalHeight > 0;
  const projectionValid = style.objectFit === "cover"
    && Number.isFinite(scale)
    && scale > 0
    && Number.isFinite(positionX)
    && Number.isFinite(positionY);

  return {
    applied: true,
    pass: decoded
      && projectionValid
      && visibleViewportRect.width > 0
      && visibleViewportRect.height > 0
      && Object.values(points).every((point) => point.pass),
    activeScene: {
      currentSrc: image.currentSrc,
      complete: image.complete,
      decoded,
      naturalWidth,
      naturalHeight,
      objectFit: style.objectFit,
      objectPosition: style.objectPosition,
      bounds: imageBounds,
    },
    projection: {
      valid: projectionValid,
      scale,
      renderedWidth,
      renderedHeight,
      freeSpaceX,
      freeSpaceY,
      offsetX,
      offsetY,
      positionX,
      positionY,
    },
    visibleViewportRect,
    sourceRect,
    safeMargin,
    points,
  };
}, ROOT_TANGLE_OBSERVATION_FOCALS);

const readPaintedFireflyCrop = async (surface) => surface.evaluate(async (
  element,
  stageContracts,
) => {
  const tolerance = 2;
  const boundsOf = (target) => {
    const bounds = target.getBoundingClientRect();
    return {
      left: bounds.left,
      right: bounds.right,
      top: bounds.top,
      bottom: bounds.bottom,
      width: bounds.width,
      height: bounds.height,
    };
  };
  const figure = element.matches(
    '.firefly-flower-art[data-visual-candidate-id="firefly-painted-pokko-v2"]',
  )
    ? element
    : element.querySelector(
      '.firefly-flower-art[data-visual-candidate-id="firefly-painted-pokko-v2"]',
    );
  if (!(figure instanceof HTMLElement)) {
    return {
      applied: true,
      pass: false,
      error: "The painted Firefly Flower figure was not found.",
    };
  }

  const surfaceElement = element.matches(".explore-immersive")
    ? element
    : element.closest(".explore-immersive") ?? element;
  const stage = figure.getAttribute("data-stage");
  const stageContract = stage && Object.prototype.hasOwnProperty.call(stageContracts, stage)
    ? stageContracts[stage]
    : null;
  const sceneImages = Array.from(
    figure.querySelectorAll("img.firefly-flower-art__scene"),
  );
  const activeImages = sceneImages.filter(
    (image) => image.getAttribute("data-active") === "true",
  );
  const activeImage = activeImages[0] ?? null;
  if (activeImage instanceof HTMLImageElement) {
    await activeImage.decode().catch(() => undefined);
  }

  const mountedScenes = sceneImages.map((image) => {
    const style = window.getComputedStyle(image);
    const opacity = Number.parseFloat(style.opacity || "1");
    const bounds = boundsOf(image);
    const currentSrc = image.currentSrc || image.src;
    return {
      stage: image.getAttribute("data-painted-stage"),
      src: image.getAttribute("src"),
      currentSrc,
      active: image.getAttribute("data-active") === "true",
      decoded: image.complete && image.naturalWidth > 0 && image.naturalHeight > 0,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      display: style.display,
      visibility: style.visibility,
      opacity,
      visible: style.display !== "none"
        && style.visibility !== "hidden"
        && opacity > 0.01
        && bounds.width > 0
        && bounds.height > 0,
      bounds,
    };
  });
  const expectedStages = Object.keys(stageContracts);
  const mountedStageSet = new Set(mountedScenes.map((scene) => scene.stage));
  const mountedSceneContractPass = mountedScenes.length === expectedStages.length
    && mountedStageSet.size === expectedStages.length
    && expectedStages.every((expectedStage) => {
      const mounted = mountedScenes.find((scene) => scene.stage === expectedStage);
      return mounted?.src === stageContracts[expectedStage].asset;
    });
  const visibleScenes = mountedScenes.filter((scene) => scene.visible);
  const shelf = surfaceElement.querySelector(".explore-immersive-brief");
  const surfaceBounds = boundsOf(surfaceElement);
  const figureBounds = boundsOf(figure);
  const shelfBounds = shelf ? boundsOf(shelf) : null;
  const surfaceStyle = window.getComputedStyle(surfaceElement);
  const fadeStartToken = surfaceStyle.getPropertyValue("--explore-world-fade-start").trim();
  const fadeStartPercent = Number.parseFloat(fadeStartToken);
  const fadeStartY = Number.isFinite(fadeStartPercent)
    ? surfaceBounds.top + surfaceBounds.height * (fadeStartPercent / 100)
    : Number.NaN;
  const focalSafeMargin = window.innerWidth >= 600 ? 24 : 16;
  const activeStyle = activeImage instanceof HTMLImageElement
    ? window.getComputedStyle(activeImage)
    : null;
  const imageBounds = activeImage instanceof HTMLImageElement
    ? boundsOf(activeImage)
    : null;
  const naturalWidth = activeImage instanceof HTMLImageElement
    ? activeImage.naturalWidth
    : 0;
  const naturalHeight = activeImage instanceof HTMLImageElement
    ? activeImage.naturalHeight
    : 0;
  const scaleX = imageBounds && naturalWidth > 0
    ? imageBounds.width / naturalWidth
    : Number.NaN;
  const scaleY = imageBounds && naturalHeight > 0
    ? imageBounds.height / naturalHeight
    : Number.NaN;
  const projectionValid = Boolean(imageBounds)
    && activeStyle?.objectFit === "cover"
    && naturalWidth === 780
    && naturalHeight === 1000
    && Number.isFinite(scaleX)
    && Number.isFinite(scaleY)
    && Math.abs(scaleX - scaleY) <= Math.max(scaleX, scaleY) * 0.002;
  const activeOpacity = Number.parseFloat(activeStyle?.opacity || "0");
  const activeVisible = activeStyle?.display !== "none"
    && activeStyle?.visibility !== "hidden"
    && activeOpacity >= 0.98
    && Boolean(imageBounds?.width)
    && Boolean(imageBounds?.height);
  const activeAssetPath = activeImage instanceof HTMLImageElement
    ? new URL(activeImage.currentSrc || activeImage.src, window.location.href).pathname
    : null;
  const activeAssetMatchesStage = Boolean(stageContract)
    && activeAssetPath === stageContract.asset;

  const projectPoint = (name, source, requiresFadeClearance) => {
    if (!imageBounds || !projectionValid) {
      return {
        name,
        source: source ? { x: source[0], y: source[1] } : null,
        viewport: null,
        insideViewport: false,
        insideSurface: false,
        insideImageSafeZone: false,
        aboveShelf: false,
        aboveFade: false,
        pass: false,
      };
    }
    const viewportX = imageBounds.left + source[0] * scaleX;
    const viewportY = imageBounds.top + source[1] * scaleY;
    const edgeClearance = Math.min(
      viewportX - imageBounds.left,
      imageBounds.right - viewportX,
      viewportY - imageBounds.top,
      imageBounds.bottom - viewportY,
    );
    const insideViewport = viewportX >= focalSafeMargin
      && viewportX <= window.innerWidth - focalSafeMargin
      && viewportY >= focalSafeMargin
      && viewportY <= window.innerHeight - focalSafeMargin;
    const insideSurface = viewportX >= surfaceBounds.left - tolerance
      && viewportX <= surfaceBounds.right + tolerance
      && viewportY >= surfaceBounds.top - tolerance
      && viewportY <= surfaceBounds.bottom + tolerance;
    const insideImageSafeZone = edgeClearance >= focalSafeMargin;
    const shelfOverlapsPoint = Boolean(shelfBounds)
      && viewportX >= shelfBounds.left - focalSafeMargin
      && viewportX <= shelfBounds.right + focalSafeMargin;
    const aboveShelf = Boolean(shelfBounds)
      && (!shelfOverlapsPoint || viewportY <= shelfBounds.top - tolerance);
    const fadeClearance = fadeStartY - viewportY;
    const aboveFade = !requiresFadeClearance
      || (Number.isFinite(fadeClearance) && fadeClearance >= focalSafeMargin);
    return {
      name,
      source: { x: source[0], y: source[1] },
      viewport: { x: viewportX, y: viewportY },
      edgeClearance,
      insideViewport,
      insideSurface,
      insideImageSafeZone,
      aboveShelf,
      shelfOverlapsPoint,
      fadeClearance,
      aboveFade,
      pass: insideViewport
        && insideSurface
        && insideImageSafeZone
        && aboveShelf
        && aboveFade,
    };
  };
  const points = stageContract ? {
    actorFace: projectPoint("actorFace", stageContract.actorFace, true),
    actorFeet: projectPoint("actorFeet", stageContract.actorFeet, false),
    actionPayoff: projectPoint("actionPayoff", stageContract.actionPayoff, true),
  } : {};
  const activeDecoded = activeImage instanceof HTMLImageElement
    && activeImage.complete
    && naturalWidth > 0
    && naturalHeight > 0;

  return {
    applied: true,
    pass: Boolean(stageContract)
      && Boolean(shelfBounds)
      && mountedSceneContractPass
      && mountedScenes.every((scene) => scene.decoded)
      && activeImages.length === 1
      && visibleScenes.length === 1
      && visibleScenes[0]?.active === true
      && activeDecoded
      && activeVisible
      && activeAssetMatchesStage
      && projectionValid
      && Object.values(points).every((point) => point.pass),
    tolerance,
    stage,
    expectedAsset: stageContract?.asset ?? null,
    activeAssetPath,
    activeAssetMatchesStage,
    mountedSceneContractPass,
    mountedScenes,
    activeSceneCount: activeImages.length,
    visibleSceneCount: visibleScenes.length,
    figure: {
      candidateId: figure.getAttribute("data-visual-candidate-id"),
      cameraKey: figure.getAttribute("data-camera-key"),
      bounds: figureBounds,
    },
    activeScene: {
      present: activeImage instanceof HTMLImageElement,
      currentSrc: activeImage instanceof HTMLImageElement
        ? activeImage.currentSrc || activeImage.src
        : null,
      complete: activeImage instanceof HTMLImageElement ? activeImage.complete : false,
      decoded: activeDecoded,
      naturalWidth,
      naturalHeight,
      objectFit: activeStyle?.objectFit ?? null,
      objectPosition: activeStyle?.objectPosition ?? null,
      opacity: activeOpacity,
      visible: activeVisible,
      bounds: imageBounds,
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    surfaceBounds,
    shelf: {
      present: Boolean(shelf),
      bounds: shelfBounds,
    },
    fade: {
      startToken: fadeStartToken,
      startPercent: fadeStartPercent,
      startY: fadeStartY,
      safeMargin: focalSafeMargin,
    },
    projection: {
      valid: projectionValid,
      scaleX,
      scaleY,
    },
    points,
  };
}, FIREFLY_PAINTED_STAGE_CONTRACT);

const readVisualAuditRuntimeSnapshot = async (
  page,
  surface,
  { waitForFiniteAnimations = true } = {},
) => {
  const visualSettle = await settleVisualAuditPage(page, { waitForFiniteAnimations });
  const surfaceIdentity = await surface.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const visibleImages = Array.from(element.querySelectorAll("img"))
      .filter((image) => {
        const style = window.getComputedStyle(image);
        const imageBounds = image.getBoundingClientRect();
        return style.display !== "none"
          && style.visibility !== "hidden"
          && Number.parseFloat(style.opacity || "1") > 0
          && imageBounds.width > 0
          && imageBounds.height > 0;
      })
      .map((image) => {
        const imageBounds = image.getBoundingClientRect();
        return {
          currentSrc: image.currentSrc || image.src,
          complete: image.complete,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          decoded: image.complete
            && image.naturalWidth > 0
            && image.naturalHeight > 0,
          bounds: {
            left: imageBounds.left,
            right: imageBounds.right,
            top: imageBounds.top,
            bottom: imageBounds.bottom,
            width: imageBounds.width,
            height: imageBounds.height,
          },
        };
      });
    return {
      lineageId: element.getAttribute("data-visual-lineage-id"),
      candidateId: element.getAttribute("data-visual-candidate-id"),
      mode: element.getAttribute("data-visual-mode"),
      surfaceId: element.getAttribute("data-visual-surface-id"),
      sceneId: element.getAttribute("data-visual-scene-id"),
      cameraKey: element.getAttribute("data-camera-key"),
      observationId: element.getAttribute("data-observation-id"),
      sourceEncounterId: element.getAttribute("data-source-encounter-id"),
      bounds: {
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height,
      },
      media: {
        visibleImageCount: visibleImages.length,
        allVisibleImagesDecoded: visibleImages.every((image) => image.decoded),
        visibleImages,
      },
    };
  });
  const paintedCrop = surfaceIdentity.candidateId === "pokko-painted-encounters-v5"
    ? await readPaintedEncounterCrop(surface, surfaceIdentity)
    : null;
  const observationCrop = surfaceIdentity.candidateId === "root-tangle-light-path-v2"
    ? await readRootObservationCrop(surface)
    : null;
  const fireflyCrop = surfaceIdentity.candidateId === "firefly-painted-pokko-v2"
    ? await readPaintedFireflyCrop(surface)
    : null;

  const runtime = await page.evaluate(() => {
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement || element instanceof SVGElement)) return false;
      const style = window.getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && Number.parseFloat(style.opacity || "1") > 0
        && bounds.width > 0
        && bounds.height > 0
        && bounds.right > 0
        && bounds.bottom > 0
        && bounds.left < window.innerWidth
        && bounds.top < window.innerHeight;
    };
    const identityOf = (element) => ({
      lineageId: element.getAttribute("data-visual-lineage-id"),
      candidateId: element.getAttribute("data-visual-candidate-id"),
      mode: element.getAttribute("data-visual-mode"),
      surfaceId: element.getAttribute("data-visual-surface-id"),
      sceneId: element.getAttribute("data-visual-scene-id"),
      cameraKey: element.getAttribute("data-camera-key"),
    });
    const visibleIdentityMap = new Map();
    document.querySelectorAll("[data-visual-lineage-id]").forEach((element) => {
      if (!isVisible(element)) return;
      const identity = identityOf(element);
      visibleIdentityMap.set(JSON.stringify(identity), identity);
    });

    const legacySelectors = [
      '[data-visual-lineage-id="legacy-mixed-v0"]',
      '[data-visual-mode="legacy"]',
      '[data-visual-candidate-id^="root-pull-"]',
      '[data-visual-candidate-id="makimodon-live-v0"]',
      ".makimodon-art",
      ".root-pull-opening-art",
      'img[src*="/opening-root-pull-"]',
      'img[src*="makimodon"]',
    ];
    const legacyElements = new Set();
    legacySelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        if (isVisible(element)) legacyElements.add(element);
      });
    });

    const keyPad = document.querySelector('[role="group"][aria-label="すうじ キーパッド"]');
    const keyPadButtons = Array.from(keyPad?.querySelectorAll("button") ?? []);
    const findButtonByText = (text) => keyPadButtons
      .find((button) => button.textContent?.trim() === text);
    const findButtonByName = (name) => keyPadButtons
      .find((button) => button.getAttribute("aria-label") === name);
    const readKey = (element) => {
      if (!(element instanceof HTMLButtonElement)) {
        return {
          present: false,
          visible: false,
          withinViewport: false,
          centerHit: false,
          disabled: null,
          bounds: null,
        };
      }
      const bounds = element.getBoundingClientRect();
      const visible = isVisible(element);
      const withinViewport = bounds.left >= 0
        && bounds.right <= window.innerWidth
        && bounds.top >= 0
        && bounds.bottom <= window.innerHeight;
      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;
      const hitElement = visible
        && centerX >= 0
        && centerX < window.innerWidth
        && centerY >= 0
        && centerY < window.innerHeight
        ? document.elementFromPoint(centerX, centerY)
        : null;
      const centerHit = hitElement === element
        || Boolean(hitElement && element.contains(hitElement));
      return {
        present: true,
        visible,
        withinViewport,
        centerHit,
        disabled: element.disabled,
        bounds: {
          left: bounds.left,
          right: bounds.right,
          top: bounds.top,
          bottom: bounds.bottom,
          width: bounds.width,
          height: bounds.height,
        },
      };
    };
    const digits = Object.fromEntries(
      ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]
        .map((digit) => [digit, readKey(findButtonByText(digit))]),
    );
    const tenKey = {
      digits,
      clear: readKey(findButtonByName("こたえを けす")),
      backspace: readKey(findButtonByName("ひとつ もどす")),
      confirm: readKey(findButtonByName("こたえる")),
    };
    const directlyReachableTenKeyEntries = [
      ...Object.values(tenKey.digits),
      tenKey.clear,
      tenKey.backspace,
    ];
    const confirmReachableWhenEnabled = tenKey.confirm.present
      && tenKey.confirm.visible
      && tenKey.confirm.withinViewport
      && (tenKey.confirm.centerHit || tenKey.confirm.disabled === true);
    const allTenKeyEntries = [
      ...Object.values(tenKey.digits),
      tenKey.clear,
      tenKey.backspace,
      tenKey.confirm,
    ];

    const app = document.querySelector(".app-container");
    const world = document.querySelector(".explore-world");
    const attempt = document.querySelector('[data-testid="explore-attempt"]');
    const documentElement = document.documentElement;
    return {
      app: {
        buildRevision: app?.getAttribute("data-build-revision") ?? null,
        deliveryId: app?.getAttribute("data-delivery-id") ?? null,
        lineageId: app?.getAttribute("data-visual-lineage-id") ?? null,
      },
      visibleIdentities: Array.from(visibleIdentityMap.values()),
      legacyVisibleCount: legacyElements.size,
      overflow: {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        documentScrollWidth: documentElement.scrollWidth,
        documentScrollHeight: documentElement.scrollHeight,
        horizontal: documentElement.scrollWidth > window.innerWidth + 1,
        vertical: documentElement.scrollHeight > window.innerHeight + 1,
      },
      tenKey: {
        ...tenKey,
        confirmReachableWhenEnabled,
        layoutCompleteAndVisible: allTenKeyEntries.every(
          (key) => key.present && key.visible && key.withinViewport,
        ),
        completeAndReachable: allTenKeyEntries.every(
          (key) => key.present && key.visible && key.withinViewport,
        ) && directlyReachableTenKeyEntries.every(
          (key) => key.present && key.visible && key.centerHit,
        ) && confirmReachableWhenEnabled,
      },
      run: world ? {
        runId: world.getAttribute("data-run-id"),
        status: world.getAttribute("data-run-status"),
        steps: Number(world.getAttribute("data-run-steps")),
        openingExperience: world.getAttribute("data-opening-experience"),
        persistence: world.getAttribute("data-run-persistence"),
      } : null,
      attempt: attempt ? {
        attemptKey: attempt.getAttribute("data-attempt-key"),
        gateId: attempt.getAttribute("data-gate-id"),
        attemptNumber: Number(attempt.getAttribute("data-attempt-number")),
        problemId: attempt.getAttribute("data-problem-id"),
        saveState: attempt.getAttribute("data-save-state"),
      } : null,
      url: window.location.href,
      hash: window.location.hash,
    };
  });

  return {
    ...runtime,
    surface: surfaceIdentity,
    visualSettle,
    paintedCrop,
    observationCrop,
    fireflyCrop,
  };
};

const captureVisualAuditStage = async ({
  page,
  surface,
  stage,
  viewport,
  tempDir,
  targetVersion,
  networkProbe,
  cacheLabel,
  expected,
  requireTenKey = false,
  requireTenKeyLayout = false,
  captureScope = "viewport",
  revealGroupId = null,
  parentStage = null,
  waitForFiniteAnimations = true,
}) => {
  assert(
    VISUAL_AUDIT_STAGE_ORDER.includes(stage),
    `unknown visual audit stage: ${stage}`,
  );
  assert(
    captureScope === "viewport" || captureScope === "locator-detail",
    `${stage} has an unsupported capture scope: ${captureScope}`,
  );
  if (captureScope === "locator-detail") {
    assert(revealGroupId, `${stage} locator detail must identify its reveal group`);
    assert(parentStage, `${stage} locator detail must identify its parent stage`);
  }
  await surface.waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
  if (captureScope === "locator-detail") {
    await surface.evaluate((element) => {
      element.scrollIntoView({ block: "center", inline: "nearest" });
    });
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
  }
  const snapshot = await readVisualAuditRuntimeSnapshot(page, surface, {
    waitForFiniteAnimations,
  });
  const surfaceIntersection = {
    left: Math.max(0, snapshot.surface.bounds.left),
    right: Math.min(viewport.width, snapshot.surface.bounds.right),
    top: Math.max(0, snapshot.surface.bounds.top),
    bottom: Math.min(viewport.height, snapshot.surface.bounds.bottom),
  };
  surfaceIntersection.width = Math.max(0, surfaceIntersection.right - surfaceIntersection.left);
  surfaceIntersection.height = Math.max(0, surfaceIntersection.bottom - surfaceIntersection.top);
  surfaceIntersection.area = surfaceIntersection.width * surfaceIntersection.height;
  const surfaceArea = snapshot.surface.bounds.width * snapshot.surface.bounds.height;
  const surfaceViewportIntersectionRatio = surfaceArea > 0
    ? surfaceIntersection.area / surfaceArea
    : 0;
  const surfaceWhollyVisible = snapshot.surface.bounds.left >= 0
    && snapshot.surface.bounds.right <= viewport.width
    && snapshot.surface.bounds.top >= 0
    && snapshot.surface.bounds.bottom <= viewport.height;

  assert(
    snapshot.visualSettle.fontsStatus === "loaded"
      || snapshot.visualSettle.fontsStatus === "unsupported",
    `${stage} fonts did not settle: ${JSON.stringify(snapshot.visualSettle)}`,
  );
  assert(
    snapshot.visualSettle.allVisibleImagesDecoded,
    `${stage} contains a visible image that was not decoded: ${JSON.stringify(snapshot.visualSettle)}`,
  );
  assert(
    snapshot.visualSettle.finiteAnimationsRemaining.length === 0,
    `${stage} contains an unsettled finite animation: ${JSON.stringify(snapshot.visualSettle)}`,
  );
  assert(
    snapshot.app.buildRevision === targetVersion.revision,
    `${stage} build revision mismatch: DOM=${snapshot.app.buildRevision}, version.json=${targetVersion.revision}`,
  );
  assert(
    snapshot.app.deliveryId === targetVersion.delivery,
    `${stage} delivery mismatch: DOM=${snapshot.app.deliveryId}, version.json=${targetVersion.delivery}`,
  );
  assert(
    snapshot.app.lineageId === targetVersion.visualLineage,
    `${stage} app lineage must be ${targetVersion.visualLineage}`,
  );
  assert(
    snapshot.surface.lineageId === targetVersion.visualLineage,
    `${stage} surface lineage must be ${targetVersion.visualLineage}`,
  );
  assert(
    snapshot.surface.candidateId === expected.candidateId,
    `${stage} candidate mismatch: expected ${expected.candidateId}, got ${snapshot.surface.candidateId}`,
  );
  assert(
    snapshot.surface.mode === expected.mode,
    `${stage} mode mismatch: expected ${expected.mode}, got ${snapshot.surface.mode}`,
  );
  if (expected.surfaceId) {
    assert(
      snapshot.surface.surfaceId === expected.surfaceId,
      `${stage} surface mismatch: expected ${expected.surfaceId}, got ${snapshot.surface.surfaceId}`,
    );
  }
  if (expected.sceneId) {
    assert(
      snapshot.surface.sceneId === expected.sceneId,
      `${stage} scene mismatch: expected ${expected.sceneId}, got ${snapshot.surface.sceneId}`,
    );
  }
  if (expected.cameraKey) {
    assert(
      snapshot.surface.cameraKey === expected.cameraKey,
      `${stage} camera mismatch: expected ${expected.cameraKey}, got ${snapshot.surface.cameraKey}`,
    );
  }
  if (expected.observationId) {
    assert(
      snapshot.surface.observationId === expected.observationId,
      `${stage} observation mismatch: expected ${expected.observationId}, got ${snapshot.surface.observationId}`,
    );
  }
  if (expected.sourceEncounterId) {
    assert(
      snapshot.surface.sourceEncounterId === expected.sourceEncounterId,
      `${stage} source encounter mismatch: expected ${expected.sourceEncounterId}, got ${snapshot.surface.sourceEncounterId}`,
    );
  }
  const offLineage = snapshot.visibleIdentities.filter(
    (identity) => identity.lineageId !== targetVersion.visualLineage,
  );
  assert(
    offLineage.length === 0,
    `${stage} contains mixed visible lineages: ${JSON.stringify(offLineage)}`,
  );
  assert(
    snapshot.legacyVisibleCount === 0,
    `${stage} contains ${snapshot.legacyVisibleCount} visible legacy actor or asset nodes`,
  );
  assert(!snapshot.overflow.horizontal, `${stage} has horizontal document overflow`);
  assert(
    snapshot.surface.bounds.left >= -1
      && snapshot.surface.bounds.right <= viewport.width + 1,
    `${stage} surface exceeds the ${viewport.width}px viewport: ${JSON.stringify(snapshot.surface.bounds)}`,
  );
  assert(
    surfaceViewportIntersectionRatio >= 0.5
      && surfaceIntersection.height >= Math.min(180, viewport.height * 0.35),
    `${stage} target surface must meaningfully intersect the captured viewport: ${JSON.stringify({ bounds: snapshot.surface.bounds, intersection: surfaceIntersection, ratio: surfaceViewportIntersectionRatio })}`,
  );
  if (captureScope === "locator-detail") {
    assert(
      surfaceWhollyVisible,
      `${stage} locator detail surface must be wholly visible: ${JSON.stringify(snapshot.surface.bounds)}`,
    );
    assert(
      snapshot.surface.media.allVisibleImagesDecoded,
      `${stage} locator detail contains undecoded surface media: ${JSON.stringify(snapshot.surface.media)}`,
    );
  }
  if (requireTenKey) {
    assert(
      snapshot.tenKey.completeAndReachable,
      `${stage} must keep the full 0-9/C/backspace/confirm TenKey visible and reachable: ${JSON.stringify(snapshot.tenKey)}`,
    );
  }
  if (requireTenKeyLayout) {
    assert(
      snapshot.tenKey.layoutCompleteAndVisible,
      `${stage} must keep the complete TenKey layout visible inside the viewport while locked: ${JSON.stringify(snapshot.tenKey)}`,
    );
  }
  if (expected.candidateId === "pokko-painted-encounters-v5") {
    assert(
      snapshot.paintedCrop?.pass,
      `${stage} painted focal crop failed: ${JSON.stringify(snapshot.paintedCrop)}`,
    );
  }
  if (expected.candidateId === "root-tangle-light-path-v2") {
    assert(
      snapshot.observationCrop?.pass,
      `${stage} root observation focal crop failed: ${JSON.stringify(snapshot.observationCrop)}`,
    );
  }
  if (expected.candidateId === "firefly-painted-pokko-v2") {
    assert(
      snapshot.fireflyCrop?.pass,
      `${stage} painted Firefly Flower safe-zone failed: ${JSON.stringify(snapshot.fireflyCrop)}`,
    );
  }

  const viewportName = `${viewport.width}x${viewport.height}`;
  const stageNumber = String(VISUAL_AUDIT_STAGE_ORDER.indexOf(stage) + 1).padStart(2, "0");
  const relativePath = `${viewportName}/${stageNumber}-${stage}.jpg`;
  const screenshotPath = path.join(tempDir, relativePath);
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  if (captureScope === "locator-detail") {
    await surface.screenshot({
      path: screenshotPath,
      type: "jpeg",
      quality: 88,
      animations: "disabled",
    });
  } else {
    await page.screenshot({
      path: screenshotPath,
      type: "jpeg",
      quality: 88,
      fullPage: false,
      animations: "disabled",
    });
  }

  return {
    stage,
    captureScope,
    revealGroupId,
    parentStage,
    viewport,
    screenshot: relativePath,
    screenshotSha256: await sha256File(screenshotPath),
    capturedAt: new Date().toISOString(),
    buildRevision: snapshot.app.buildRevision,
    deliveryId: snapshot.app.deliveryId,
    visualLineageId: snapshot.surface.lineageId,
    visualCandidateId: snapshot.surface.candidateId,
    visualMode: snapshot.surface.mode,
    visualSurfaceId: snapshot.surface.surfaceId,
    visualSceneId: snapshot.surface.sceneId,
    cameraKey: snapshot.surface.cameraKey,
    observationId: snapshot.surface.observationId,
    sourceEncounterId: snapshot.surface.sourceEncounterId,
    visibleIdentities: snapshot.visibleIdentities,
    legacyVisibleCount: snapshot.legacyVisibleCount,
    overflow: snapshot.overflow,
    surfaceBounds: snapshot.surface.bounds,
    surfaceIntersection,
    surfaceViewportIntersectionRatio,
    surfaceWhollyVisible,
    surfaceMedia: snapshot.surface.media,
    tenKey: snapshot.tenKey,
    visualSettle: snapshot.visualSettle,
    paintedCrop: snapshot.paintedCrop,
    observationCrop: snapshot.observationCrop,
    fireflyCrop: snapshot.fireflyCrop,
    cache: await readVisualAuditCacheState(page, networkProbe, cacheLabel),
    run: snapshot.run,
    attempt: snapshot.attempt,
    url: snapshot.url,
    hash: snapshot.hash,
  };
};

const captureVisualAuditSupportingViewport = async ({
  page,
  viewport,
  tempDir,
  targetVersion,
  revealGroupId,
  networkProbe,
}) => {
  assert(revealGroupId, "supporting reveal composite must identify its reveal group");
  const settled = await settleVisualAuditPage(page);
  const runtime = await page.evaluate(() => {
    const app = document.querySelector(".app-container");
    const boundsOf = (element) => {
      if (!(element instanceof HTMLElement || element instanceof SVGElement)) return null;
      const bounds = element.getBoundingClientRect();
      const intersection = {
        left: Math.max(0, bounds.left),
        right: Math.min(window.innerWidth, bounds.right),
        top: Math.max(0, bounds.top),
        bottom: Math.min(window.innerHeight, bounds.bottom),
      };
      intersection.width = Math.max(0, intersection.right - intersection.left);
      intersection.height = Math.max(0, intersection.bottom - intersection.top);
      intersection.area = intersection.width * intersection.height;
      const area = bounds.width * bounds.height;
      return {
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height,
        area,
        intersection,
        viewportIntersectionRatio: area > 0 ? intersection.area / area : 0,
        whollyInsideViewport: bounds.left >= 0
          && bounds.right <= window.innerWidth
          && bounds.top >= 0
          && bounds.bottom <= window.innerHeight,
      };
    };
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement || element instanceof SVGElement)) return false;
      const style = window.getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && Number.parseFloat(style.opacity || "1") > 0
        && bounds.width > 0
        && bounds.height > 0
        && bounds.right > 0
        && bounds.bottom > 0
        && bounds.left < window.innerWidth
        && bounds.top < window.innerHeight;
    };
    const visibleIdentities = Array.from(document.querySelectorAll("[data-visual-lineage-id]"))
      .filter(isVisible)
      .map((element) => ({
        lineageId: element.getAttribute("data-visual-lineage-id"),
        candidateId: element.getAttribute("data-visual-candidate-id"),
        mode: element.getAttribute("data-visual-mode"),
        surfaceId: element.getAttribute("data-visual-surface-id"),
        sceneId: element.getAttribute("data-visual-scene-id"),
      }));
    const legacySelectors = [
      '[data-visual-lineage-id="legacy-mixed-v0"]',
      '[data-visual-mode="legacy"]',
      '[data-visual-candidate-id^="root-pull-"]',
      '[data-visual-candidate-id="makimodon-live-v0"]',
      ".makimodon-art",
      ".root-pull-opening-art",
      'img[src*="/opening-root-pull-"]',
      'img[src*="makimodon"]',
    ];
    const legacyElements = new Set();
    legacySelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        if (isVisible(element)) legacyElements.add(element);
      });
    });
    const visibleImages = Array.from(document.images).filter(isVisible);
    const documentElement = document.documentElement;
    const overlay = document.querySelector(".explore-research-overlay");
    const observation = document.querySelector(
      '[data-visual-surface-id="explore-observation-root-tangle"]',
    );
    const fieldBook = document.querySelector(
      '[data-visual-surface-id="explore-field-book-firefly"]',
    );
    const observationCopy = document.querySelector(
      '[data-testid="explore-observation-copy"]',
    );
    const observationCopyFontSizes = Array.from(
      observationCopy?.querySelectorAll("p") ?? [],
    ).map((element) => Number.parseFloat(window.getComputedStyle(element).fontSize));
    const continueAction = fieldBook?.querySelector("button") ?? null;
    const continueActionBounds = boundsOf(continueAction);
    const continueActionCenter = continueActionBounds ? {
      x: continueActionBounds.left + continueActionBounds.width / 2,
      y: continueActionBounds.top + continueActionBounds.height / 2,
    } : null;
    const continueActionHit = continueActionCenter
      && continueActionCenter.x >= 0
      && continueActionCenter.x < window.innerWidth
      && continueActionCenter.y >= 0
      && continueActionCenter.y < window.innerHeight
      ? document.elementFromPoint(continueActionCenter.x, continueActionCenter.y)
      : null;
    return {
      buildRevision: app?.getAttribute("data-build-revision") ?? null,
      deliveryId: app?.getAttribute("data-delivery-id") ?? null,
      lineageId: app?.getAttribute("data-visual-lineage-id") ?? null,
      visibleIdentities,
      legacyVisibleCount: legacyElements.size,
      overflow: {
        documentScrollWidth: documentElement.scrollWidth,
        documentScrollHeight: documentElement.scrollHeight,
        horizontal: documentElement.scrollWidth > window.innerWidth + 1,
        vertical: documentElement.scrollHeight > window.innerHeight + 1,
      },
      visualSettle: {
        fontsStatus: document.fonts?.status ?? "unsupported",
        visibleImageCount: visibleImages.length,
        allVisibleImagesDecoded: visibleImages.every((image) => (
          image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
        )),
      },
      revealGeometry: {
        overlay: {
          bounds: boundsOf(overlay),
          scrollTop: overlay instanceof HTMLElement ? overlay.scrollTop : null,
          scrollHeight: overlay instanceof HTMLElement ? overlay.scrollHeight : null,
          clientHeight: overlay instanceof HTMLElement ? overlay.clientHeight : null,
        },
        observation: boundsOf(observation),
        observationCopy: {
          bounds: boundsOf(observationCopy),
          fontSizes: observationCopyFontSizes,
          minimumMeaningfulFontSize: observationCopyFontSizes.length > 0
            ? Math.min(...observationCopyFontSizes)
            : 0,
        },
        fieldBook: boundsOf(fieldBook),
        continueAction: {
          bounds: continueActionBounds,
          minimumHeightPass: Boolean(continueActionBounds?.height >= 56),
          focused: document.activeElement === continueAction,
          centerHit: continueActionHit === continueAction
            || Boolean(continueAction && continueActionHit && continueAction.contains(continueActionHit)),
        },
      },
      url: window.location.href,
      hash: window.location.hash,
    };
  });
  assert(
    runtime.buildRevision === targetVersion.revision
      && runtime.deliveryId === targetVersion.delivery,
    `supporting reveal composite runtime identity changed: ${JSON.stringify(runtime)}`,
  );
  assert(
    runtime.lineageId === targetVersion.visualLineage
      && runtime.visibleIdentities.every((identity) => (
        identity.lineageId === targetVersion.visualLineage
      )),
    `supporting reveal composite contains mixed visual lineage: ${JSON.stringify(runtime.visibleIdentities)}`,
  );
  assert(
    runtime.legacyVisibleCount === 0,
    `supporting reveal composite contains ${runtime.legacyVisibleCount} visible legacy nodes`,
  );
  assert(
    !runtime.overflow.horizontal,
    `supporting reveal composite has horizontal overflow: ${JSON.stringify(runtime.overflow)}`,
  );
  assert(
    (runtime.visualSettle.fontsStatus === "loaded"
      || runtime.visualSettle.fontsStatus === "unsupported")
      && runtime.visualSettle.allVisibleImagesDecoded
      && settled.finiteAnimationsRemaining.length === 0,
    `supporting reveal composite did not settle: ${JSON.stringify({ runtime: runtime.visualSettle, settled })}`,
  );
  const visibleCandidateIds = [...new Set(
    runtime.visibleIdentities.map((identity) => identity.candidateId).filter(Boolean),
  )];
  assert(
    visibleCandidateIds.includes("root-tangle-light-path-v2")
      && visibleCandidateIds.includes("firefly-field-book-v1"),
    `supporting reveal composite must contain observation and field-book candidates: ${JSON.stringify(visibleCandidateIds)}`,
  );
  const revealGeometry = runtime.revealGeometry;
  assert(
    revealGeometry.overlay.scrollTop !== null
      && revealGeometry.overlay.scrollTop <= 1,
    `q7 reveal must be audited before any programmatic scroll: ${JSON.stringify(revealGeometry.overlay)}`,
  );
  assert(
    revealGeometry.observation?.viewportIntersectionRatio >= 0.85,
    `q7 observation must be meaningfully visible in the natural reveal: ${JSON.stringify(revealGeometry.observation)}`,
  );
  assert(
    revealGeometry.observationCopy.bounds?.viewportIntersectionRatio >= 0.85
      && revealGeometry.observationCopy.minimumMeaningfulFontSize >= 12,
    `q7 causal copy must remain meaningfully visible and at least 12px: ${JSON.stringify(revealGeometry.observationCopy)}`,
  );
  assert(
    revealGeometry.fieldBook?.viewportIntersectionRatio >= 0.85,
    `q7 field book must be meaningfully visible in the natural reveal: ${JSON.stringify(revealGeometry.fieldBook)}`,
  );
  assert(
    revealGeometry.continueAction.bounds?.whollyInsideViewport
      && revealGeometry.continueAction.minimumHeightPass
      && revealGeometry.continueAction.focused
      && revealGeometry.continueAction.centerHit,
    `q7 close action must own focus and be a fully visible, reachable 56px target without scrolling: ${JSON.stringify(revealGeometry.continueAction)}`,
  );

  const stage = "q7-reveal-composite";
  const viewportName = `${viewport.width}x${viewport.height}`;
  const relativePath = `${viewportName}/supporting-${stage}.jpg`;
  const screenshotPath = path.join(tempDir, relativePath);
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({
    path: screenshotPath,
    type: "jpeg",
    quality: 88,
    fullPage: false,
    animations: "disabled",
  });
  return {
    stage,
    captureScope: "viewport",
    detailStages: ["q7-observation", "field-book"],
    revealGroupId,
    viewport,
    screenshot: relativePath,
    screenshotSha256: await sha256File(screenshotPath),
    capturedAt: new Date().toISOString(),
    buildRevision: runtime.buildRevision,
    deliveryId: runtime.deliveryId,
    visualLineageId: runtime.lineageId,
    visibleIdentities: runtime.visibleIdentities,
    visibleCandidateIds,
    legacyVisibleCount: runtime.legacyVisibleCount,
    overflow: runtime.overflow,
    visualSettle: runtime.visualSettle,
    revealGeometry,
    cache: await readVisualAuditCacheState(page, networkProbe, "warm-same-context"),
    url: runtime.url,
    hash: runtime.hash,
  };
};

const escapeVisualAuditHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

const createVisualAuditContactSheet = async (
  browser,
  tempDir,
  captures,
  supportingCaptures,
  targetVersion,
  repository,
  buildProvenance,
) => {
  const cardsByStage = [];
  for (const stage of VISUAL_AUDIT_STAGE_ORDER) {
    const stageCaptures = VISUAL_AUDIT_VIEWPORTS.map((viewport) => {
      const capture = captures.find((candidate) => (
        candidate.stage === stage
        && candidate.viewport.width === viewport.width
        && candidate.viewport.height === viewport.height
      ));
      assert(capture, `contact sheet is missing ${stage} at ${viewport.width}x${viewport.height}`);
      return capture;
    });
    const detailRow = stageCaptures.every(
      (capture) => capture.captureScope === "locator-detail",
    );
    const cards = [];
    for (const capture of stageCaptures) {
      const image = await fs.readFile(path.join(tempDir, capture.screenshot));
      const supportingCapture = detailRow
        ? supportingCaptures.find((candidate) => (
          candidate.viewport.width === capture.viewport.width
          && candidate.viewport.height === capture.viewport.height
          && candidate.revealGroupId === capture.revealGroupId
          && candidate.detailStages.includes(stage)
        ))
        : null;
      assert(
        !detailRow || supportingCapture,
        `contact sheet is missing the full-viewport reveal for ${stage} at ${capture.viewport.width}x${capture.viewport.height}`,
      );
      const supportingImage = supportingCapture
        ? await fs.readFile(path.join(tempDir, supportingCapture.screenshot))
        : null;
      const media = supportingImage
        ? `
          <div class="media-stack">
            <figure class="evidence-frame evidence-frame--viewport">
              <figcaption>FULL VIEWPORT · shared simultaneous reveal</figcaption>
              <img src="data:image/jpeg;base64,${supportingImage.toString("base64")}" alt="">
            </figure>
            <figure class="evidence-frame evidence-frame--detail">
              <figcaption>LOCATOR DETAIL · ${escapeVisualAuditHtml(stage)}</figcaption>
              <img src="data:image/jpeg;base64,${image.toString("base64")}" alt="">
            </figure>
          </div>
        `
        : `<img class="stage-image" src="data:image/jpeg;base64,${image.toString("base64")}" alt="">`;
      cards.push(`
        <article class="card">
          <header>
            <strong>${escapeVisualAuditHtml(`${capture.viewport.width}×${capture.viewport.height} · ${capture.captureScope}`)}</strong>
            <span>${escapeVisualAuditHtml(capture.visualCandidateId)} · ${escapeVisualAuditHtml(capture.visualMode)}</span>
          </header>
          ${media}
          <footer>
            <code>${escapeVisualAuditHtml(`scope: ${capture.captureScope}${capture.parentStage ? ` · parent: ${capture.parentStage}` : ""}`)}</code>
            <code>${escapeVisualAuditHtml(capture.visualSurfaceId ?? "surface-id: none")}</code>
            <code>${escapeVisualAuditHtml(capture.visualSceneId ?? "scene-id: none")}</code>
          </footer>
        </article>
      `);
    }
    cardsByStage.push(`
      <section class="stage">
        <h2>${String(VISUAL_AUDIT_STAGE_ORDER.indexOf(stage) + 1).padStart(2, "0")} · ${escapeVisualAuditHtml(stage)}${detailRow ? " · LOCATOR DETAIL" : ""}</h2>
        <div class="pair">${cards.join("")}</div>
      </section>
    `);
  }

  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  try {
    await page.setContent(`
      <!doctype html>
      <html lang="ja">
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          padding: 38px;
          background: #102f37;
          color: #fff4ce;
          font-family: -apple-system, BlinkMacSystemFont, "Noto Sans JP", sans-serif;
        }
        .sheet-head {
          margin-bottom: 30px;
          padding: 24px 28px;
          border: 3px solid #173f49;
          border-radius: 24px;
          background: #32bed1;
          color: #173f49;
          box-shadow: 8px 9px 0 #d99a27;
        }
        .sheet-head h1 { margin: 0; font-size: 32px; }
        .sheet-head p { margin: 8px 0 0; font-weight: 800; }
        .stage {
          margin: 0 0 30px;
          padding: 20px;
          border-radius: 24px;
          background: #fff4ce;
          color: #173f49;
        }
        .stage h2 { margin: 0 0 14px; font-size: 23px; }
        .pair {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
          align-items: start;
        }
        .card {
          overflow: hidden;
          border: 3px solid #173f49;
          border-radius: 18px;
          background: #f8edc8;
        }
        .card header, .card footer {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          font-size: 14px;
          font-weight: 800;
        }
        .card header span { text-align: right; }
        .stage-image,
        .evidence-frame img {
          display: block;
          width: 100%;
          height: 560px;
          object-fit: contain;
          background: #d7bd6c;
        }
        .media-stack {
          display: grid;
          gap: 10px;
          padding: 10px;
          background: #d7bd6c;
        }
        .evidence-frame {
          margin: 0;
          overflow: hidden;
          border: 2px solid #173f49;
          border-radius: 12px;
          background: #f8edc8;
        }
        .evidence-frame figcaption {
          padding: 7px 9px;
          color: #173f49;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.04em;
        }
        .evidence-frame--viewport img { height: 560px; }
        .evidence-frame--detail img { height: 360px; }
        .card footer {
          flex-direction: column;
          color: #315d5f;
          font-size: 12px;
        }
      </style>
      <body>
        <header class="sheet-head">
          <h1>Pokko field G4-6 · same-build critical path</h1>
          <p>revision ${escapeVisualAuditHtml(targetVersion.revision)} · delivery ${escapeVisualAuditHtml(targetVersion.delivery)}</p>
          <p>${escapeVisualAuditHtml(buildProvenance.verifiedExactCleanBuild
            ? `exact clean-HEAD build verified · source tree ${buildProvenance.sourceTreeSha} · dist ${buildProvenance.dist.sha256}`
            : "target self-identification + local source HEAD match · exact build provenance not supplied")}</p>
          <p>runtime inputs clean · ${repository.nonRuntimeDirtyEntryCount} non-runtime worktree entries</p>
          <p>Cold launch is a cold-cache fresh run; Ready rechecks that same asset state and may be pixel-identical. Q7 detail rows always include their natural unscrolled full viewport.</p>
        </header>
        ${cardsByStage.join("")}
      </body>
      </html>
    `, { waitUntil: "load" });
    await page.waitForFunction(
      () => Array.from(document.images).every((image) => (
        image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
      )),
      undefined,
      { timeout: VISUAL_AUDIT_SETTLE_TIMEOUT_MS },
    );
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images).map((image) => image.decode()));
      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });
    });
    const relativePath = "contact-sheet.jpg";
    const outputPath = path.join(tempDir, relativePath);
    await page.screenshot({
      path: outputPath,
      type: "jpeg",
      quality: 88,
      fullPage: true,
      animations: "disabled",
    });
    return {
      path: relativePath,
      sha256: await sha256File(outputPath),
    };
  } finally {
    await context.close();
  }
};

const assertVisualAuditRunContinuity = (captures, viewport) => {
  const originalRunStages = VISUAL_AUDIT_STAGE_ORDER.slice(
    0,
    VISUAL_AUDIT_STAGE_ORDER.indexOf("return") + 1,
  );
  const originalRunCaptures = captures.filter(
    (capture) => originalRunStages.includes(capture.stage),
  );
  const missingRunIds = originalRunCaptures
    .filter((capture) => !capture.run?.runId)
    .map((capture) => capture.stage);
  assert(
    missingRunIds.length === 0,
    `${viewport.width}x${viewport.height} audit stages must all expose a run ID; missing ${JSON.stringify(missingRunIds)}`,
  );
  const originalRunIds = new Set(
    originalRunCaptures.map((capture) => capture.run.runId),
  );
  assert(
    originalRunIds.size === 1,
    `${viewport.width}x${viewport.height} audit must keep one run through return; got ${JSON.stringify([...originalRunIds])}`,
  );
  const [originalRunId] = originalRunIds;
  const relaunch = captures.find((capture) => capture.stage === "relaunch");
  assert(relaunch?.run?.runId, "relaunch capture must expose its new run ID");
  assert(
    relaunch.run.runId !== originalRunId,
    `${viewport.width}x${viewport.height} relaunch must start a new run`,
  );
};

const runVisualAuditViewport = async (
  browser,
  viewport,
  tempDir,
  targetVersion,
) => {
  const context = await browser.newContext({
    baseURL: activeBaseUrl,
    reducedMotion: "reduce",
    viewport,
    deviceScaleFactor: 1,
    serviceWorkers: "allow",
  });
  let page;
  let networkProbe;
  try {
    const bootstrapPage = await context.newPage();
    await clearClientStorage(bootstrapPage);
    await completeOnboarding(bootstrapPage, /引き算まで/, /小学 1 年生/);
    await navigateHash(bootstrapPage, "/settings", /#\/settings$/);
    await clearIndexedDbRows(bootstrapPage, "memoryMath");
    await clearVisualAuditRuntimeCaches(context, bootstrapPage);
    await clearIndexedDbRows(bootstrapPage, "exploreRunEvents");
    await clearIndexedDbRows(bootstrapPage, "exploreRuns");
    assert(
      await countIndexedDbRows(bootstrapPage, "exploreRunEvents") === 0
        && await countIndexedDbRows(bootstrapPage, "exploreRuns") === 0,
      "visual-audit bootstrap must leave no resumable run before the cold fresh launch",
    );
    await bootstrapPage.close();

    page = await context.newPage();
    networkProbe = await createVisualAuditNetworkProbe(
      context,
      page,
      new URL(activeBaseUrl).origin,
    );
    await page.goto("/#/", { waitUntil: "domcontentloaded" });
    await waitForHash(page, /#\/explore$/);

    const captures = [];
    const supportingCaptures = [];
    const capture = async (stage, surface, expected, options = {}) => {
      const result = await captureVisualAuditStage({
        page,
        surface,
        stage,
        viewport,
        tempDir,
        targetVersion,
        networkProbe,
        cacheLabel: stage === "cold-launch" ? "cold-fresh-run" : "warm-same-context",
        expected,
        requireTenKey: Boolean(options.requireTenKey),
        requireTenKeyLayout: Boolean(options.requireTenKeyLayout),
        captureScope: options.captureScope ?? "viewport",
        revealGroupId: options.revealGroupId ?? null,
        parentStage: options.parentStage ?? null,
        waitForFiniteAnimations: options.waitForFiniteAnimations ?? true,
      });
      captures.push(result);
      return result;
    };

    const opening = page.locator(
      '.explore-immersive[data-visual-surface-id="explore-opening-snap-root"]',
    );
    await waitForExploreFirstProblemReady(page, ".snap-root-opening-art");
    assert(
      await page.locator(".explore-world").getAttribute("data-opening-experience")
        === "snap-root-v1",
      "the deployed visual-audit build must launch Snap Root without a development URL override",
    );
    const freshLaunchPersistence = await readExplorePersistenceSnapshot(page);
    const freshRun = freshLaunchPersistence.runs[0];
    const freshRunStartedEvent = freshLaunchPersistence.events[0];
    assert(
      freshLaunchPersistence.runs.length === 1
        && freshRun?.status === "active"
        && freshRun.problemsAnswered === 0
        && freshRun.correctCount === 0
        && freshRun.incorrectCount === 0
        && freshLaunchPersistence.events.length === 1
        && freshRunStartedEvent?.type === "run_started"
        && freshRunStartedEvent.runId === freshRun.runId,
      `cold fresh launch must create exactly one new unanswered run: ${JSON.stringify(freshLaunchPersistence)}`,
    );
    const coldLaunchCapture = await capture("cold-launch", opening, {
      candidateId: "dig-pop-painted-v2",
      mode: "world-painted",
      surfaceId: "explore-opening-snap-root",
      sceneId: "snap-root-ready",
      cameraKey: "opening-snap-root-side-v1",
    }, { requireTenKey: true });
    coldLaunchCapture.freshRunPersistence = {
      runCount: freshLaunchPersistence.runs.length,
      eventCount: freshLaunchPersistence.events.length,
      runId: freshRun.runId,
      status: freshRun.status,
    };
    await page.locator('.snap-root-opening-art[data-asset-state="ready"]')
      .waitFor({ timeout: STEP_TIMEOUT_MS });
    await capture("ready", opening, {
      candidateId: "dig-pop-painted-v2",
      mode: "world-painted",
      surfaceId: "explore-opening-snap-root",
      sceneId: "snap-root-ready",
      cameraKey: "opening-snap-root-side-v1",
    }, { requireTenKey: true });

    for (const stage of ["dig-one", "dig-two"]) {
      await solveExploreAndWaitForNextProblem(page);
      const progressedOpening = page.locator(
        `.explore-immersive[data-visual-surface-id="explore-opening-snap-root"][data-visual-scene-id="snap-root-${stage}"]`,
      );
      await capture(stage, progressedOpening, {
        candidateId: "dig-pop-painted-v2",
        mode: "world-painted",
        surfaceId: "explore-opening-snap-root",
        sceneId: `snap-root-${stage}`,
        cameraKey: "opening-snap-root-side-v1",
      }, { requireTenKey: true });
    }

    await solveExploreNumericProblem(page);
    const poppedOpening = page.locator(
      '.explore-immersive[data-visual-surface-id="explore-opening-snap-root"][data-visual-scene-id="snap-root-popped"]',
    );
    await poppedOpening.waitFor({ timeout: RAPID_LOOP_CI_BUDGET_MS });
    await capture("popped", poppedOpening, {
      candidateId: "dig-pop-painted-v2",
      mode: "world-painted",
      surfaceId: "explore-opening-snap-root",
      sceneId: "snap-root-popped",
      cameraKey: "opening-snap-root-side-v1",
    }, { requireTenKeyLayout: true });
    await waitForExploreRouteBreak(page);

    const routeChoice = page.locator(".explore-path-choice");
    const routeCapture = await capture("route-choice", routeChoice, {
      candidateId: "pokko-route-map-v2",
      mode: "route-map",
    });
    const routeLayout = await routeChoice.evaluate((element) => {
      const returnAction = element.querySelector(".explore-path-return");
      const returnBounds = returnAction?.getBoundingClientRect();
      return {
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        returnAction: returnBounds ? {
          top: returnBounds.top,
          bottom: returnBounds.bottom,
          height: returnBounds.height,
        } : null,
        viewportHeight: window.innerHeight,
      };
    });
    assert(
      routeLayout.scrollHeight <= routeLayout.clientHeight + 1,
      `${viewport.width}x${viewport.height} route choice must not hide actions below an internal scroll edge: ${JSON.stringify(routeLayout)}`,
    );
    assert(
      routeLayout.returnAction
        && routeLayout.returnAction.bottom <= routeLayout.viewportHeight,
      `${viewport.width}x${viewport.height} route return action must be initially visible: ${JSON.stringify(routeLayout)}`,
    );
    assert(
      routeCapture.surfaceBounds.bottom >= viewport.height - 24,
      `${viewport.width}x${viewport.height} route choice leaves an unfocused lower void: ${JSON.stringify(routeCapture.surfaceBounds)}`,
    );
    const routeForkArt = page.getByTestId("explore-route-fork-art");
    const routeBranchCount = Number(await routeForkArt.getAttribute("data-branch-count"));
    assert(
      routeBranchCount === 2 || routeBranchCount === 3,
      `route fork art must expose a supported branch count; got ${routeBranchCount}`,
    );
    const expectedRouteAsset = routeBranchCount === 3
      ? "/assets/explore/route-choice/scene-fork-three-pokko-v1.jpg"
      : "/assets/explore/route-choice/scene-fork-two-pokko-v1.jpg";
    const routeForkImage = routeForkArt.locator("img");
    const expectsRouteForkArt = (
      viewport.width < 600 && viewport.height >= 800
    ) || (
      viewport.width >= 600
        && viewport.height >= 760
        && viewport.height >= viewport.width
    );
    if (expectsRouteForkArt) {
      await routeForkArt.waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
      await routeForkImage.evaluate((image) => image.decode());
      assert(
        (await routeForkImage.getAttribute("src"))?.startsWith("data:image/gif")
          && (await routeForkImage.evaluate((image) => image.currentSrc)).endsWith(expectedRouteAsset),
        `route art must select the matching responsive source ${expectedRouteAsset}`,
      );
      const routeForkArtBounds = await routeForkArt.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          width: bounds.width,
          height: bounds.height,
          top: bounds.top,
          bottom: bounds.bottom,
        };
      });
      assert(
        routeForkArtBounds.height >= 180
          && routeForkArtBounds.bottom <= viewport.height,
        `${viewport.width}x${viewport.height} route fork art must fill the decision stage: ${JSON.stringify(routeForkArtBounds)}`,
      );
    } else {
      assert(
        await routeForkArt.isHidden(),
        "short-phone route fork art should remain out of the rapid choice stack",
      );
      const phoneRouteImage = await routeForkImage.evaluate(async (image) => {
        await image.decode();
        return {
          currentSrc: image.currentSrc,
          complete: image.complete,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
        };
      });
      assert(
        phoneRouteImage.currentSrc.startsWith("data:image/gif")
          && phoneRouteImage.complete
          && phoneRouteImage.naturalWidth === 1
          && phoneRouteImage.naturalHeight === 1,
        `short-phone route choice must select and decode only its transparent fallback; PWA precache behavior is a separate contract: ${JSON.stringify(phoneRouteImage)}`,
      );
    }
    routeCapture.routeFork = {
      branchCount: routeBranchCount,
      authoredAsset: expectedRouteAsset,
      selectedCurrentSrc: await routeForkImage.evaluate((image) => image.currentSrc),
      selectionMode: viewport.width >= 600
        ? "tablet-authored-raster"
        : viewport.height >= 800
          ? "tall-phone-authored-raster"
          : "short-phone-transparent-fallback",
      bothBranchVariantsCoveredByComponentTest: true,
    };
    await seedDueMathSkills(page, [
      "add_1d_1_bridge",
      "add_1d_2_bridge",
      "add_2d1d_nc_bridge",
      "add_2d1d_c_bridge",
    ]);
    await chooseFirstExploreRoute(page);

    const ordinaryQ4 = page.locator(
      '.explore-immersive[data-visual-surface-id="explore-ordinary-firefly"]',
    );
    await ordinaryQ4.waitFor({ timeout: STEP_TIMEOUT_MS });
    await capture("q4-ordinary", ordinaryQ4, {
      candidateId: "firefly-painted-pokko-v2",
      mode: "world-painted",
      surfaceId: "explore-ordinary-firefly",
      cameraKey: "firefly-flower-side-v2",
    }, { requireTenKey: true });
    await solveExploreAndWaitForNextProblem(page);

    const bridge = page.locator(
      '.explore-immersive[data-visual-surface-id="explore-encounter-light-bridge"]',
    );
    await bridge.waitFor({ timeout: STEP_TIMEOUT_MS });
    await capture("major-encounter-idle", bridge, {
      candidateId: "pokko-painted-encounters-v5",
      mode: "world-painted",
      surfaceId: "explore-encounter-light-bridge",
      sceneId: "light-bridge-idle",
      cameraKey: "light-bridge-camera-v1",
    }, { requireTenKey: true });
    const bridgeAttemptKey = await page.getByTestId("explore-attempt")
      .getAttribute("data-attempt-key");
    assert(bridgeAttemptKey, "visual audit bridge must expose an attempt key");
    await page.locator(
      '.explore-immersive[data-visual-surface-id="explore-encounter-light-bridge"] img.explore-immersive-scene-complete',
    ).evaluate((image) => image.decode());
    await solveExploreNumericProblem(page);
    const completedBridge = page.locator(
      '.explore-immersive[data-visual-surface-id="explore-encounter-light-bridge"][data-visual-scene-id="light-bridge-complete"]',
    );
    await completedBridge.waitFor({ timeout: RAPID_LOOP_CI_BUDGET_MS });
    await capture("major-encounter-correct", completedBridge, {
      candidateId: "pokko-painted-encounters-v5",
      mode: "world-painted",
      surfaceId: "explore-encounter-light-bridge",
      sceneId: "light-bridge-complete",
      cameraKey: "light-bridge-camera-v1",
    }, { requireTenKeyLayout: true, waitForFiniteAnimations: false });
    await waitForNewExploreAttempt(page, bridgeAttemptKey);

    const ordinaryQ6 = page.locator(
      '.explore-immersive[data-visual-surface-id="explore-ordinary-firefly"]',
    );
    await ordinaryQ6.waitFor({ timeout: STEP_TIMEOUT_MS });
    await seedDueMathSkills(page, [
      "sub_1d1d_nc_bridge",
      "sub_1d1d_c_bridge",
      "sub_2d1d_nc_bridge",
      "sub_2d1d_c_bridge",
    ]);
    await solveExploreAndWaitForNextProblem(page);

    const root = page.locator(
      '.explore-immersive[data-visual-surface-id="explore-encounter-root-tangle"]',
    );
    await root.waitFor({ timeout: STEP_TIMEOUT_MS });
    const rootCapture = await capture("q7-before", root, {
      candidateId: "pokko-painted-encounters-v5",
      mode: "world-painted",
      surfaceId: "explore-encounter-root-tangle",
      sceneId: "root-tangle-tangled",
      cameraKey: "root-tangle-camera-v1",
    }, { requireTenKey: true });
    const rootAttemptKey = await page.getByTestId("explore-attempt")
      .getAttribute("data-attempt-key");
    assert(rootAttemptKey, "visual audit root tangle must expose an attempt key");
    await solveExploreNumericProblem(page);

    const observation = page.locator(
      '.explore-paper-diorama[data-visual-surface-id="explore-observation-root-tangle"]',
    );
    await observation.waitFor({ timeout: RAPID_LOOP_CI_BUDGET_MS });
    const revealGroupId = randomUUID();
    const resolvedRoot = page.locator(
      '.explore-immersive[data-visual-surface-id="explore-encounter-root-tangle"][data-visual-scene-id="root-tangle-crossed"]',
    );
    await resolvedRoot.waitFor({ state: "attached", timeout: RAPID_LOOP_CI_BUDGET_MS });
    const resolvedRootCameraKey = await resolvedRoot.getAttribute("data-camera-key");
    const resolvedRootCrop = await readPaintedEncounterCrop(resolvedRoot, {
      surfaceId: "explore-encounter-root-tangle",
      sceneId: "root-tangle-crossed",
    });
    assert(
      resolvedRootCrop.activeScene?.decoded
        && resolvedRootCrop.projection?.valid
        && resolvedRootCrop.activeScene.currentSrc.endsWith(
          "/assets/explore/root-tangle/scene-crossed-light-path-pokko-v5.jpg",
        ),
      `Q7 continuity reference must be the decoded committed crossed world scene: ${JSON.stringify(resolvedRootCrop)}`,
    );
    const supportingCapture = await captureVisualAuditSupportingViewport({
      page,
      viewport,
      tempDir,
      targetVersion,
      revealGroupId,
      networkProbe,
    });
    const naturalObservationCrop = await readRootObservationCrop(observation);
    assert(
      naturalObservationCrop.pass,
      `Q7 observation focal points must be readable before any programmatic scroll: ${JSON.stringify(naturalObservationCrop)}`,
    );
    supportingCapture.observationCrop = naturalObservationCrop;
    supportingCaptures.push(supportingCapture);
    const observationCapture = await capture("q7-observation", observation, {
      candidateId: "root-tangle-light-path-v2",
      mode: "observation",
      surfaceId: "explore-observation-root-tangle",
      sceneId: "root-tangle-crossed",
      cameraKey: "root-tangle-camera-v1",
      observationId: "explore-observation:root-tangle-light-path",
      sourceEncounterId: "root-tangle",
    }, {
      captureScope: "locator-detail",
      revealGroupId,
      parentStage: "q7-reveal-composite",
    });
    assert(
      observationCapture.cameraKey === rootCapture.cameraKey
        && observationCapture.cameraKey === resolvedRootCameraKey,
      `root observation camera must equal the solved and resolved world camera: ${JSON.stringify({ before: rootCapture.cameraKey, resolved: resolvedRootCameraKey, observation: observationCapture.cameraKey })}`,
    );
    const worldSourceRect = resolvedRootCrop.storySourceRect;
    const observationSourceRect = naturalObservationCrop.sourceRect;
    const worldScene = resolvedRootCrop.activeScene;
    const observationSceneGeometry = naturalObservationCrop.activeScene;
    assert(
      worldSourceRect?.area > 0 && observationSourceRect?.area > 0,
      `Q7 camera continuity requires measurable source-space windows: ${JSON.stringify({ worldSourceRect, observationSourceRect })}`,
    );
    assert(
      worldScene?.naturalWidth === observationSceneGeometry?.naturalWidth
        && worldScene?.naturalHeight === observationSceneGeometry?.naturalHeight
        && worldScene.currentSrc === observationSceneGeometry.currentSrc,
      `Q7 camera continuity requires the exact same authored crossed plate: ${JSON.stringify({ worldScene, observationSceneGeometry })}`,
    );
    const intersection = {
      left: Math.max(worldSourceRect.left, observationSourceRect.left),
      right: Math.min(worldSourceRect.right, observationSourceRect.right),
      top: Math.max(worldSourceRect.top, observationSourceRect.top),
      bottom: Math.min(worldSourceRect.bottom, observationSourceRect.bottom),
    };
    intersection.width = Math.max(0, intersection.right - intersection.left);
    intersection.height = Math.max(0, intersection.bottom - intersection.top);
    intersection.area = intersection.width * intersection.height;
    const worldCoverage = intersection.area / worldSourceRect.area;
    const observationCoverage = intersection.area / observationSourceRect.area;
    const unionArea = worldSourceRect.area + observationSourceRect.area - intersection.area;
    const intersectionOverUnion = unionArea > 0 ? intersection.area / unionArea : 0;
    const widthRatio = observationSourceRect.width / worldSourceRect.width;
    const heightRatio = observationSourceRect.height / worldSourceRect.height;
    const areaRatio = observationSourceRect.area / worldSourceRect.area;
    const worldCenter = {
      x: (worldSourceRect.left + worldSourceRect.right) / 2,
      y: (worldSourceRect.top + worldSourceRect.bottom) / 2,
    };
    const observationCenter = {
      x: (observationSourceRect.left + observationSourceRect.right) / 2,
      y: (observationSourceRect.top + observationSourceRect.bottom) / 2,
    };
    const centerDeltaRatio = Math.hypot(
      observationCenter.x - worldCenter.x,
      observationCenter.y - worldCenter.y,
    ) / worldScene.naturalHeight;
    assert(
      worldCoverage >= 0.98,
      `Q7 observation must contain at least 98% of the solved world story window; got ${worldCoverage}: ${JSON.stringify({ worldSourceRect, observationSourceRect, intersection })}`,
    );
    assert(
      centerDeltaRatio <= 0.04,
      `Q7 source-space camera centers must stay within 4% of the authored plate height; got ${centerDeltaRatio}: ${JSON.stringify({ worldCenter, observationCenter })}`,
    );
    assert(
      widthRatio >= 0.98
        && widthRatio <= 1.3
        && heightRatio >= 0.98
        && heightRatio <= 1.3
        && areaRatio >= 0.95
        && areaRatio <= 1.45
        && intersectionOverUnion >= 0.7,
      `Q7 observation must preserve a symmetric same-camera crop, not merely contain the world window: ${JSON.stringify({ widthRatio, heightRatio, areaRatio, worldCoverage, observationCoverage, intersectionOverUnion, worldSourceRect, observationSourceRect })}`,
    );
    const worldObjectPosition = worldScene.objectPosition.trim().split(/\s+/);
    const observationObjectPosition = observationSceneGeometry.objectPosition.trim().split(/\s+/);
    assert(
      worldObjectPosition[0] === observationObjectPosition[0]
        && worldObjectPosition[0] === "50%",
      `Q7 resolved and observation scenes must share the authored horizontal object position: ${JSON.stringify({ worldObjectPosition, observationObjectPosition })}`,
    );
    observationCapture.cameraContinuity = {
      cameraKey: observationCapture.cameraKey,
      worldObjectPosition: worldScene.objectPosition,
      observationObjectPosition: observationSceneGeometry.objectPosition,
      objectPositionContract: {
        horizontalTokenEqual: worldObjectPosition[0] === observationObjectPosition[0],
        verticalTokensCompileToEquivalentSourceWindow: centerDeltaRatio <= 0.04
          && heightRatio >= 0.98
          && heightRatio <= 1.3,
      },
      worldSourceRect,
      observationSourceRect,
      intersection,
      worldCoverage,
      observationCoverage,
      intersectionOverUnion,
      widthRatio,
      heightRatio,
      areaRatio,
      worldCenter,
      observationCenter,
      centerDeltaRatio,
      focalPoints: naturalObservationCrop.points,
      pass: true,
    };
    assert(
      observationCapture.surfaceMedia.visibleImages.some((image) => (
        image.currentSrc.endsWith("/assets/explore/root-tangle/scene-crossed-light-path-pokko-v5.jpg")
      )),
      "root observation must render the crossed root-tangle scene from the committed encounter",
    );

    const fieldBook = page.locator(
      '.explore-research-book[data-visual-surface-id="explore-field-book-firefly"]',
    );
    const fieldBookCapture = await capture("field-book", fieldBook, {
      candidateId: "firefly-field-book-v1",
      mode: "field-book",
      surfaceId: "explore-field-book-firefly",
    }, {
      captureScope: "locator-detail",
      revealGroupId,
      parentStage: "q7-reveal-composite",
    });
    assert(
      observationCapture.screenshotSha256 !== fieldBookCapture.screenshotSha256,
      "q7 observation and field-book locator details must not be duplicate images",
    );
    assert(
      supportingCapture.revealGroupId === observationCapture.revealGroupId
        && supportingCapture.revealGroupId === fieldBookCapture.revealGroupId,
      "Q7 natural viewport and both locator details must belong to one reveal group",
    );
    await closeBlockingResearchDiscovery(page, /大発見！.*ねっこの むこうの ひかり道/, 3);
    await waitForNewExploreAttempt(page, rootAttemptKey);

    const ordinaryQ8 = page.locator(
      '.explore-immersive[data-visual-surface-id="explore-ordinary-firefly"]',
    );
    await ordinaryQ8.waitFor({ timeout: STEP_TIMEOUT_MS });
    await capture("q8", ordinaryQ8, {
      candidateId: "firefly-painted-pokko-v2",
      mode: "world-painted",
      surfaceId: "explore-ordinary-firefly",
      cameraKey: "firefly-flower-side-v2",
    }, { requireTenKey: true });
    await solveExploreNumericProblem(page);
    await waitForRouteBreakPastOptionalRareDiscovery(page);
    const primaryReturn = page.getByTestId("explore-run-primary-return");
    await primaryReturn.waitFor({ timeout: STEP_TIMEOUT_MS });
    await primaryReturn.click();
    await page.locator("#return-summary-title").waitFor({ timeout: STEP_TIMEOUT_MS });

    const returned = page.getByTestId("research-library-scene");
    await returned.locator('[data-character-id="pokko"]:visible').first()
      .waitFor({ timeout: STEP_TIMEOUT_MS });
    await returned.getByText(/ほたる花/, { exact: false }).first()
      .waitFor({ timeout: STEP_TIMEOUT_MS });
    const returnCapture = await capture("return", returned, {
      candidateId: "research-library-pokko-v1",
      mode: "archive",
    });
    assert(
      returnCapture.run?.runId === rootCapture.run?.runId,
      `return summary must remain attached to the original run: ${rootCapture.run?.runId} -> ${returnCapture.run?.runId}`,
    );
    await page.getByTestId("research-library-primary-action").click();
    await waitForExploreFirstProblemReady(page, ".snap-root-opening-art");
    const relaunched = page.locator(
      '.explore-immersive[data-visual-surface-id="explore-opening-snap-root"]',
    );
    await capture("relaunch", relaunched, {
      candidateId: "dig-pop-painted-v2",
      mode: "world-painted",
      surfaceId: "explore-opening-snap-root",
      sceneId: "snap-root-ready",
      cameraKey: "opening-snap-root-side-v1",
    }, { requireTenKey: true });

    await navigateHash(page, "/battle", /#\/battle$/);
    const base = page.locator(".game-hub");
    await capture("base", base, {
      candidateId: "pokko-base-painted-v1",
      mode: "base-map",
    });

    assert(
      captures.length === VISUAL_AUDIT_STAGE_ORDER.length,
      `${viewport.width}x${viewport.height} must produce all ${VISUAL_AUDIT_STAGE_ORDER.length} stages`,
    );
    assert(
      supportingCaptures.length === 1
        && supportingCaptures[0].revealGroupId === revealGroupId,
      `${viewport.width}x${viewport.height} must produce one grouped q7 reveal composite`,
    );
    assertVisualAuditRunContinuity(captures, viewport);
    return { captures, supportingCaptures };
  } finally {
    if (networkProbe) await networkProbe.detach();
    await context.close();
  }
};

const runVisualAudit = async (browser) => {
  activeBaseUrl = normalizeVisualAuditBaseUrl(
    process.env.SANSU_VISUAL_AUDIT_BASE_URL,
  );
  const workspace = await createVisualAuditWorkspace(
    process.env.SANSU_VISUAL_AUDIT_OUTPUT_DIR,
  );
  let published = false;
  try {
    const targetVersion = await readVisualAuditTargetVersion(activeBaseUrl);
    const visualAssetAttestation = await attestRequiredVisualAssets(activeBaseUrl);
    const repository = readVisualAuditRepositoryState(targetVersion.revision);
    const buildProvenance = await readVisualAuditBuildProvenance({
      targetVersion,
      repository,
      baseUrl: activeBaseUrl,
    });
    const captures = [];
    const supportingCaptures = [];
    for (const viewport of VISUAL_AUDIT_VIEWPORTS) {
      const viewportEvidence = await runVisualAuditViewport(
        browser,
        viewport,
        workspace.tempDir,
        targetVersion,
      );
      captures.push(...viewportEvidence.captures);
      supportingCaptures.push(...viewportEvidence.supportingCaptures);
    }
    const revisions = new Set(captures.map((capture) => capture.buildRevision));
    const deliveries = new Set(captures.map((capture) => capture.deliveryId));
    assert(
      revisions.size === 1 && revisions.has(targetVersion.revision),
      `all visual audit captures must use one build: ${JSON.stringify([...revisions])}`,
    );
    assert(
      deliveries.size === 1 && deliveries.has(targetVersion.delivery),
      `all visual audit captures must use one delivery: ${JSON.stringify([...deliveries])}`,
    );
    assert(
      supportingCaptures.length === VISUAL_AUDIT_VIEWPORTS.length
        && supportingCaptures.every((capture) => (
          capture.buildRevision === targetVersion.revision
          && capture.deliveryId === targetVersion.delivery
        ))
        && VISUAL_AUDIT_VIEWPORTS.every((viewport) => (
          supportingCaptures.filter((capture) => (
            capture.viewport.width === viewport.width
            && capture.viewport.height === viewport.height
          )).length === 1
        ))
        && new Set(
          supportingCaptures.map((capture) => capture.revealGroupId),
        ).size === VISUAL_AUDIT_VIEWPORTS.length,
      "visual audit must include one same-build q7 reveal composite per viewport",
    );

    const contactSheet = await createVisualAuditContactSheet(
      browser,
      workspace.tempDir,
      captures,
      supportingCaptures,
      targetVersion,
      repository,
      buildProvenance,
    );
    const coldLaunchAndReady = VISUAL_AUDIT_VIEWPORTS.map((viewport) => {
      const coldLaunch = captures.find((capture) => (
        capture.stage === "cold-launch"
        && capture.viewport.width === viewport.width
        && capture.viewport.height === viewport.height
      ));
      const ready = captures.find((capture) => (
        capture.stage === "ready"
        && capture.viewport.width === viewport.width
        && capture.viewport.height === viewport.height
      ));
      assert(coldLaunch && ready, `cold-launch/ready evidence missing at ${viewport.width}x${viewport.height}`);
      return {
        viewport,
        coldLaunchSha256: coldLaunch.screenshotSha256,
        readySha256: ready.screenshotSha256,
        pixelIdentical: coldLaunch.screenshotSha256 === ready.screenshotSha256,
      };
    });
    const targetVersionBeforePublication = await readVisualAuditTargetVersion(activeBaseUrl);
    assert(
      targetVersionBeforePublication.revision === targetVersion.revision
        && targetVersionBeforePublication.delivery === targetVersion.delivery
        && targetVersionBeforePublication.visualLineage === targetVersion.visualLineage,
      `visual audit target identity changed during capture: ${JSON.stringify({ start: targetVersion, end: targetVersionBeforePublication })}`,
    );
    const visualAssetAttestationBeforePublication = await attestRequiredVisualAssets(
      activeBaseUrl,
    );
    const repositoryBeforePublication = readVisualAuditRepositoryState(
      targetVersion.revision,
    );
    assert(
      repositoryBeforePublication.headRevision === repository.headRevision
        && repositoryBeforePublication.headTree === repository.headTree,
      `repository HEAD changed during visual audit: ${repository.headRevision} -> ${repositoryBeforePublication.headRevision}`,
    );
    const buildProvenanceBeforePublication = await readVisualAuditBuildProvenance({
      targetVersion: targetVersionBeforePublication,
      repository: repositoryBeforePublication,
      baseUrl: activeBaseUrl,
    });
    assertVisualAuditBuildProvenanceStable(
      buildProvenance,
      buildProvenanceBeforePublication,
      "during capture",
    );
    const manifest = {
      schemaVersion: "sansu-critical-path-visual-audit-v1",
      auditId: randomUUID(),
      generatedAt: new Date().toISOString(),
      actualTarget: activeBaseUrl,
      targetVersion,
      targetVersionBeforePublication,
      buildProvenance: {
        captureStart: buildProvenance,
        beforePublication: buildProvenanceBeforePublication,
        verifiedExactCleanBuild: buildProvenance.verifiedExactCleanBuild
          && buildProvenanceBeforePublication.verifiedExactCleanBuild,
      },
      visualAssetAttestation: {
        captureStart: visualAssetAttestation,
        beforePublication: visualAssetAttestationBeforePublication,
      },
      repository: {
        ...repository,
        beforePublication: repositoryBeforePublication,
        stableHead: true,
        runtimeInputsCleanAtStartAndBeforePublication: true,
      },
      browser: {
        engine: "chromium",
        version: browser.version(),
      },
      visualLineageId: "pokko-field-v1",
      requiredStages: VISUAL_AUDIT_STAGE_ORDER,
      viewports: VISUAL_AUDIT_VIEWPORTS,
      captureCount: captures.length,
      captures,
      supportingCaptureCount: supportingCaptures.length,
      supportingCaptures,
      contactSheet,
      evidenceSemantics: {
        coldLaunchAndReady: {
          note: "Cold launch clears HTTP/SW caches and prior explore run rows, then captures the first fully decoded frame of one newly created unanswered run. Ready rechecks that same asset state, so pixel identity is allowed and recorded explicitly.",
          byViewport: coldLaunchAndReady,
        },
        q7Reveal: {
          note: "Observation and field-book locator details are both paired with the same-build, same-moment full viewport composite.",
          simultaneousCompositeRequired: true,
          supportingStage: "q7-reveal-composite",
        },
      },
      gates: {
        visualMagnetism: {
          verdict: "PENDING_HUMAN_REVIEW",
          note: "Score the runtime contact sheet beside the approved benchmark.",
        },
        silentComprehensionAndSafety: {
          verdict: "PENDING_G5",
          note: "Requires five independent observers and verbatim answers.",
        },
        runtimeIntegrity: {
          verdict: "PASS",
          mixedVisibleLineageCount: [...captures, ...supportingCaptures].reduce(
            (count, capture) => count + capture.visibleIdentities.filter(
              (identity) => identity.lineageId !== "pokko-field-v1",
            ).length,
            0,
          ),
          visibleLegacyCount: [...captures, ...supportingCaptures].reduce(
            (count, capture) => count + capture.legacyVisibleCount,
            0,
          ),
          supportingCompositeCount: supportingCaptures.length,
        },
        production: {
          verdict: "HOLD",
          note: "G5 blind value testing and G6 production promotion remain separate.",
        },
      },
    };
    await fs.writeFile(
      path.join(workspace.tempDir, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      { flag: "wx" },
    );
    assert(
      !(await visualAuditPathExists(workspace.finalDir)),
      `visual audit output appeared during capture; refusing to overwrite it: ${workspace.finalDir}`,
    );
    const publicationGuardRepository = readVisualAuditRepositoryState(
      targetVersion.revision,
    );
    const publicationGuardTarget = await readVisualAuditTargetVersion(activeBaseUrl);
    const publicationGuardBuildProvenance = await readVisualAuditBuildProvenance({
      targetVersion: publicationGuardTarget,
      repository: publicationGuardRepository,
      baseUrl: activeBaseUrl,
    });
    assertVisualAuditBuildProvenanceStable(
      buildProvenance,
      publicationGuardBuildProvenance,
      "before publication",
    );
    assert(
      publicationGuardRepository.headRevision === repository.headRevision
        && publicationGuardRepository.headTree === repository.headTree
        && publicationGuardTarget.revision === targetVersion.revision
        && publicationGuardTarget.delivery === targetVersion.delivery
        && publicationGuardTarget.visualLineage === targetVersion.visualLineage,
      `visual audit publication guard changed after manifest creation: ${JSON.stringify({ publicationGuardRepository, publicationGuardTarget, publicationGuardBuildProvenance })}`,
    );
    await fs.rename(workspace.tempDir, workspace.finalDir);
    published = true;
    console.log(`Visual audit evidence written to ${workspace.finalDir}`);
  } finally {
    if (!published && await visualAuditPathExists(workspace.tempDir)) {
      await fs.rm(workspace.tempDir, { recursive: true, force: true });
    }
  }
};

const main = async () => {
  let devServer;
  let startedByScript = false;
  let browser;

  try {
    if (VISUAL_AUDIT_MODE) {
      browser = await chromium.launch({ headless: true });
      await runVisualAudit(browser);
      return;
    }

    const session = await getServerSession();
    activeBaseUrl = session.baseUrl;
    devServer = session.devServer;
    startedByScript = session.startedByScript;

    browser = await chromium.launch({ headless: true });

    const results = [];
    const rapidLoopBenchmarkRuns = Number.parseInt(
      process.env.SANSU_RAPID_LOOP_BENCHMARK_RUNS || "0",
      10,
    );
    if (rapidLoopBenchmarkRuns > 0) {
      results.push(await runScenario(
        `benchmarks Snap Root rapid-loop P95 across ${rapidLoopBenchmarkRuns} runs`,
        () => scenarioSnapRootTempoBenchmark(browser, rapidLoopBenchmarkRuns),
      ));
      if (!results.every(Boolean)) process.exitCode = 1;
      return;
    }
    if (process.env.SANSU_E2E_EXPLORE_RESUME_ONLY === "1") {
      results.push(await runScenario(
        "resumes fixed-ten explore across retry, route, discovery, and partial-input boundaries",
        () => scenarioExploreInterruptionResume(browser),
      ));
      if (!results.every(Boolean)) process.exitCode = 1;
      return;
    }
    if (process.env.SANSU_E2E_ROUTE_BOUNDARY_ONLY === "1") {
      results.push(await runScenario(
        "keeps the 390x800 route boundary fully visible",
        () => scenarioExploreLaunchAndReturn(browser, { width: 390, height: 800 }),
      ));
      if (!results.every(Boolean)) process.exitCode = 1;
      return;
    }
    if (process.env.SANSU_E2E_SHORT_EXPLORE_ONLY === "1") {
      results.push(await runScenario(
        "keeps the classic opening playable with expanded mobile browser chrome",
        () => scenarioOnboardingToExploreProblem(browser, { width: 390, height: 700 }),
      ));
      if (!results.every(Boolean)) process.exitCode = 1;
      return;
    }
    if (process.env.SANSU_E2E_SNAP_ROOT_ONLY === "1") {
      results.push(await runScenario(
        "runs the Snap Root breakthrough loop at 390px",
        () => scenarioSnapRootBreakthrough(browser),
      ));
      results.push(await runScenario(
        "keeps the Snap Root breakthrough loop playable on tablet",
        () => scenarioSnapRootBreakthrough(
          browser,
          { width: 768, height: 1024 },
          { seed: "b", now: 1000 },
        ),
      ));
      if (!results.every(Boolean)) process.exitCode = 1;
      return;
    }
    if (process.env.SANSU_E2E_LIGHT_BRIDGE_ONLY === "1") {
      for (const viewport of [
        { width: 390, height: 844 },
        { width: 768, height: 1024 },
        { width: 1024, height: 768 },
        { width: 1024, height: 1366 },
        { width: 1080, height: 1920 },
      ]) {
        results.push(await runScenario(
          `keeps the light bridge playable at ${viewport.width}x${viewport.height}`,
          () => scenarioLightBridgeVerticalSlice(browser, viewport),
        ));
      }
      if (!results.every(Boolean)) process.exitCode = 1;
      return;
    }
    if (process.env.SANSU_E2E_ROOT_TANGLE_ONLY === "1") {
      for (const viewport of [
        { width: 390, height: 844 },
        { width: 768, height: 1024 },
        { width: 1024, height: 768 },
        { width: 1024, height: 1366 },
        { width: 1080, height: 1920 },
      ]) {
        results.push(await runScenario(
          `keeps the root tangle playable at ${viewport.width}x${viewport.height}`,
          () => scenarioRootTangleVerticalSlice(browser, viewport),
        ));
      }
      if (!results.every(Boolean)) process.exitCode = 1;
      return;
    }
    results.push(await runScenario("redirects to onboarding when no profile", () => scenarioOnboardingShown(browser)));
    results.push(await runScenario("completes onboarding, chooses a route, and opens Makimodon", () => scenarioOnboardingToExploreProblem(browser)));
    results.push(await runScenario(
      "keeps the classic opening playable with expanded mobile browser chrome",
      () => scenarioOnboardingToExploreProblem(browser, { width: 390, height: 700 }),
    ));
    results.push(await runScenario("keeps the direct study route working", () => scenarioStudyRoute(browser)));
    results.push(await runScenario("keeps the direct review route working", () => scenarioReviewRoute(browser)));
    results.push(await runScenario("keeps the direct settings route working", () => scenarioSettingsRoute(browser)));
    results.push(await runScenario("keeps legacy fuwafuwa album out of child records", () => scenarioLegacyAlbumHidden(browser)));
    results.push(await runScenario("completes periodic test from stats and opens results", () => scenarioStatsToPeriodicTest(browser)));
    results.push(await runScenario("launches explore immediately and safely returns at a route break", () => scenarioExploreLaunchAndReturn(browser)));
    results.push(await runScenario("keeps the 390x800 route boundary fully visible", () => scenarioExploreLaunchAndReturn(
      browser,
      { width: 390, height: 800 },
    )));
    results.push(await runScenario("runs Root Pull v2 inline with reduced motion and the numeric keypad", () => scenarioRootPullV2Opening(browser)));
    results.push(await runScenario("runs the Snap Root breakthrough loop at 390px", () => scenarioSnapRootBreakthrough(browser)));
    results.push(await runScenario("keeps the Snap Root breakthrough loop playable on tablet", () => scenarioSnapRootBreakthrough(
      browser,
      { width: 768, height: 1024 },
      { seed: "b", now: 1000 },
    )));
    results.push(await runScenario("can exit safely after explore start persistence fails", () => scenarioExploreStartFailureExit(browser)));
    results.push(await runScenario("commits one explore answer under rapid double submit", () => scenarioExploreDoubleCommit(browser)));
    results.push(await runScenario("retries the same explore attempt after a save failure", () => scenarioExploreCommitRetry(browser)));
    results.push(await runScenario(
      "resumes fixed-ten explore across retry, route, discovery, and partial-input boundaries",
      () => scenarioExploreInterruptionResume(browser),
    ));
    results.push(await runScenario("finishes last-light rescue without blocking on an ordinary clue", () => scenarioExploreLastLightRescueFinish(browser)));
    results.push(await runScenario("retries voluntary return without early terminal progress", () => scenarioExploreReturnFinishRetry(browser)));
    results.push(await runScenario("grows the immersive light bridge from an addition answer", () => scenarioLightBridgeVerticalSlice(browser)));
    results.push(await runScenario("keeps the light bridge playable on tablet", () => scenarioLightBridgeVerticalSlice(
      browser,
      { width: 768, height: 1024 },
    )));
    results.push(await runScenario("keeps the light bridge connected on a landscape tablet", () => scenarioLightBridgeVerticalSlice(
      browser,
      { width: 1024, height: 768 },
    )));
    results.push(await runScenario("keeps the light bridge playable on a 1024px portrait tablet", () => scenarioLightBridgeVerticalSlice(
      browser,
      { width: 1024, height: 1366 },
    )));
    results.push(await runScenario("keeps the light bridge playable on a wide portrait tablet", () => scenarioLightBridgeVerticalSlice(
      browser,
      { width: 1080, height: 1920 },
    )));
    results.push(await runScenario("opens the root tangle with profile-near subtraction", () => scenarioRootTangleVerticalSlice(browser)));
    results.push(await runScenario("keeps the root tangle playable on tablet", () => scenarioRootTangleVerticalSlice(
      browser,
      { width: 768, height: 1024 },
    )));
    results.push(await runScenario("keeps the root tangle playable on a landscape tablet", () => scenarioRootTangleVerticalSlice(
      browser,
      { width: 1024, height: 768 },
    )));
    results.push(await runScenario("keeps the root tangle playable on a 1024px portrait tablet", () => scenarioRootTangleVerticalSlice(
      browser,
      { width: 1024, height: 1366 },
    )));
    results.push(await runScenario("keeps the root tangle playable on a wide portrait tablet", () => scenarioRootTangleVerticalSlice(
      browser,
      { width: 1080, height: 1920 },
    )));
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

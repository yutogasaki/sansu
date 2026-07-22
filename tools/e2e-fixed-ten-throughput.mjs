import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const HOST = "127.0.0.1";
const PORT_CANDIDATES = [4173, 4174, 4175, 4176];
const APP_TITLE_MARKER = "<title>ポッコのふしぎずかん</title>";
const FIXTURE_ID = "cold-open-fixed-ten-v1";
const OPENING_EXPERIENCE = "snap-root-v1";
const VIEWPORT = { width: 390, height: 844 };
const STEP_TIMEOUT_MS = 15_000;
const SERVER_TIMEOUT_MS = 45_000;
const CORRECT_BUDGET_MS = 650;
const INCORRECT_BUDGET_MS = 550;
const EXPECTED_QUESTIONS = [
  "1 + 1 =",
  "2 + 3 =",
  "4 + 2 =",
  "5 + 3 =",
  "7 + 1 =",
  "8 + 2 =",
  "9 + 3 =",
  "6 + 2 =",
  "3 + 3 =",
  "9 + 1 =",
];
const SCENARIOS = ["all-correct", "miss-at-q4-q8"];
const FIXTURE_HASH = createHash("sha256")
  .update(JSON.stringify(EXPECTED_QUESTIONS))
  .digest("hex");

const repetitions = Math.max(
  1,
  Number.parseInt(process.env.SANSU_FIXED_TEN_REPETITIONS || "10", 10) || 10,
);
const outputPath = resolve(
  process.env.SANSU_FIXED_TEN_OUTPUT || "output/fixed-ten-throughput/latest.json",
);

let activeBaseUrl = `http://${HOST}:${PORT_CANDIDATES[0]}`;

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

const percentile = (values, fraction) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * fraction) - 1);
  return sorted[index];
};

const median = (values) => percentile(values, 0.5);

const round = (value) => value === null || value === undefined
  ? value
  : Math.round(value * 10) / 10;

const roundRatio = (value) => Math.round(value * 1_000) / 1_000;

const readGitMetadata = () => {
  const revision = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });
  const status = spawnSync("git", ["status", "--porcelain"], { encoding: "utf8" });
  return {
    revision: revision.status === 0 ? revision.stdout.trim() : "unknown",
    dirty: status.status === 0 ? status.stdout.trim().length > 0 : true,
  };
};

const attachPageDiagnostics = (page) => {
  const pageErrors = [];
  const failedLocalRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    if (request.url().startsWith(activeBaseUrl)) {
      failedLocalRequests.push({
        url: request.url(),
        error: request.failure()?.errorText || "unknown",
      });
    }
  });
  return { pageErrors, failedLocalRequests };
};

const answerForQuestion = (question) => {
  const expression = question.match(/^(\d+)\s*\+\s*(\d+)\s*=$/);
  assert(expression, `fixed-ten question is not an addition expression: ${question}`);
  return Number(expression[1]) + Number(expression[2]);
};

const wrongAnswerFor = (answer) => answer === 9 ? 8 : answer + 1;

const buildBaseUrl = (port) => `http://${HOST}:${port}`;

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
    const probe = await probeServer(url);
    if (probe.expected) return;
    await delay(400);
  }
  throw new Error(`Sansu dev server did not become ready: ${url}`);
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
      env: { ...process.env, VITE_EXPLORE_EXPERIENCE: "classic-v1" },
    },
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
  let reusableUrl;
  for (const port of PORT_CANDIDATES) {
    const url = buildBaseUrl(port);
    const probe = await probeServer(url);
    if (probe.expected) {
      reusableUrl ||= url;
      continue;
    }
    if (probe.reachable) continue;

    const devServer = startDevServer(port);
    try {
      await waitForServer(url);
      return { baseUrl: url, devServer, startedByScript: true };
    } catch (error) {
      stopDevServer(devServer);
      throw error;
    }
  }
  if (reusableUrl) return { baseUrl: reusableUrl, devServer: null, startedByScript: false };
  throw new Error(`No benchmark port available: ${PORT_CANDIDATES.join(", ")}`);
};

const waitForHash = async (page, pattern) => {
  await page.waitForFunction(
    ({ source, flags }) => new RegExp(source, flags).test(window.location.hash),
    { source: pattern.source, flags: pattern.flags },
    { timeout: STEP_TIMEOUT_MS },
  );
};

const navigateHash = async (page, hash, pattern) => {
  await page.evaluate((nextHash) => {
    window.location.hash = nextHash;
  }, hash);
  await waitForHash(page, pattern);
};

const completeOnboarding = async (page) => {
  await page.goto(
    `/?explore_experience=${encodeURIComponent(OPENING_EXPERIENCE)}#/onboarding`,
    { waitUntil: "domcontentloaded" },
  );
  await page.getByRole("button", { name: "はじめる" }).click();
  await page.getByPlaceholder("あだ名でOK").fill("Fixed Ten");
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByRole("button", { name: /小学 1 年生/ }).click();
  await page.getByRole("button", { name: /さんすう だけ/ }).click();
  await page.getByRole("button", { name: /足し算まで/ }).click();
  await waitForHash(page, /#\/explore$/);
  await page.getByTestId("explore-attempt").waitFor({ timeout: STEP_TIMEOUT_MS });
  await page.locator('.snap-root-opening-art[data-asset-state="ready"]')
    .waitFor({ timeout: STEP_TIMEOUT_MS });
};

const setProfileSoundOff = async (page) => page.evaluate(() => new Promise((resolveUpdate, reject) => {
  const request = indexedDB.open("SansuDatabase");
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const database = request.result;
    const transaction = database.transaction(["profiles", "appData"], "readwrite");
    const profileStore = transaction.objectStore("profiles");
    const appDataStore = transaction.objectStore("appData");
    const profilesRequest = profileStore.getAll();
    profilesRequest.onerror = () => reject(profilesRequest.error);
    profilesRequest.onsuccess = () => {
      for (const profile of profilesRequest.result) {
        profileStore.put({ ...profile, soundEnabled: false });
      }
      const appRequest = appDataStore.get("app");
      appRequest.onerror = () => reject(appRequest.error);
      appRequest.onsuccess = () => {
        const app = appRequest.result;
        if (!app) return;
        const profiles = Object.fromEntries(
          Object.entries(app.profiles || {}).map(([id, profile]) => [
            id,
            { ...profile, soundEnabled: false },
          ]),
        );
        appDataStore.put({ ...app, profiles });
      };
    };
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => {
      database.close();
      resolveUpdate();
    };
  };
}));

const readLearningSnapshot = async (page) => page.evaluate(() => new Promise((resolveRead, reject) => {
  const request = indexedDB.open("SansuDatabase");
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const database = request.result;
    const storeNames = ["profiles", "logs", "memoryMath"];
    const transaction = database.transaction(storeNames, "readonly");
    const result = {};
    for (const storeName of storeNames) {
      const getAll = transaction.objectStore(storeName).getAll();
      getAll.onerror = () => reject(getAll.error);
      getAll.onsuccess = () => {
        result[storeName] = getAll.result;
      };
    }
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => {
      database.close();
      resolveRead(result);
    };
  };
}));

const readExploreSnapshot = async (page) => page.evaluate(() => new Promise((resolveRead, reject) => {
  const request = indexedDB.open("SansuDatabase");
  request.onerror = () => reject(request.error);
  request.onsuccess = () => {
    const database = request.result;
    const storeNames = ["exploreRuns", "exploreRunEvents"];
    const transaction = database.transaction(storeNames, "readonly");
    const result = {};
    for (const storeName of storeNames) {
      const getAll = transaction.objectStore(storeName).getAll();
      getAll.onerror = () => reject(getAll.error);
      getAll.onsuccess = () => {
        result[storeName] = getAll.result;
      };
    }
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => {
      database.close();
      resolveRead(result);
    };
  };
}));

const snapshotsEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const markNow = async (page) => page.evaluate(() => performance.now());

const elapsedSince = async (page, startedAt) => page.evaluate(
  (start) => performance.now() - start,
  startedAt,
);

const typeAndSubmit = async (page, value) => {
  await page.keyboard.type(String(value));
  await page.keyboard.press("Enter");
};

const assertFullTenKey = async (page) => {
  for (const digit of ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]) {
    assert(
      await page.getByRole("button", { name: digit, exact: true }).isVisible(),
      `TenKey is missing ${digit}`,
    );
  }
  for (const action of ["こたえを けす", "ひとつ もどす", "こたえる"]) {
    assert(
      await page.getByRole("button", { name: action, exact: true }).isVisible(),
      `TenKey is missing ${action}`,
    );
  }
};

const waitForStudyOperable = async (page, index) => {
  await page.waitForFunction(
    ({ fixtureId, expectedIndex }) => {
      const root = document.querySelector(`[data-benchmark-id="${fixtureId}"]`);
      const digit = [...document.querySelectorAll("button")].find(
        (button) => button.getAttribute("aria-label") === "1",
      );
      return root instanceof HTMLElement
        && Number(root.dataset.studyIndex) === expectedIndex
        && root.dataset.feedback === "none"
        && root.dataset.questionText
        && digit instanceof HTMLButtonElement
        && !digit.disabled;
    },
    { fixtureId: FIXTURE_ID, expectedIndex: index },
    { timeout: STEP_TIMEOUT_MS },
  );
};

const runStudyLane = async (browser, scenario, repetition) => {
  const context = await browser.newContext({
    baseURL: activeBaseUrl,
    locale: "ja-JP",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    viewport: VIEWPORT,
  });
  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page);
  await page.addInitScript(({ fixtureId }) => {
    window.__SANSU_E2E__ = {
      exploreBenchmark: { fixtureId, startIndex: 0 },
      exploreRun: { seed: "fixed-ten-warm", now: 100 },
    };
  }, { fixtureId: FIXTURE_ID });

  try {
    await completeOnboarding(page);
    await setProfileSoundOff(page);
    await navigateHash(
      page,
      `/study?session=dev&benchmark=${FIXTURE_ID}`,
      /#\/study\?session=dev&benchmark=/,
    );
    await waitForStudyOperable(page, 0);
    await assertFullTenKey(page);

    const beforeLearning = await readLearningSnapshot(page);
    assert(
      beforeLearning.profiles.every((profile) => profile.soundEnabled === false),
      "Study benchmark profile is not muted",
    );
    const questions = [];
    const correctOperableMs = [];
    const correctionAdvanceMs = [];
    const correctionFeedbackReadyMs = [];
    const interruptions = [];
    let terminalResultMs = null;
    let correctCount = 0;
    let attempts = 0;
    const runStartedAt = await markNow(page);

    for (let questionIndex = 0; questionIndex < EXPECTED_QUESTIONS.length; questionIndex += 1) {
      await waitForStudyOperable(page, questionIndex);
      const root = page.locator(`[data-benchmark-id="${FIXTURE_ID}"]`);
      const question = await root.getAttribute("data-question-text");
      assert(question === EXPECTED_QUESTIONS[questionIndex], (
        `Study Q${questionIndex + 1} mismatch: expected ${EXPECTED_QUESTIONS[questionIndex]}, got ${question}`
      ));
      questions.push(question);
      const answer = answerForQuestion(question);

      if (scenario === "miss-at-q4-q8" && (questionIndex === 3 || questionIndex === 7)) {
        const missStartedAt = await markNow(page);
        attempts += 1;
        await typeAndSubmit(page, wrongAnswerFor(answer));
        const nextButton = page.getByRole("button", { name: /次へ|つぎへ/ });
        await nextButton.waitFor({ timeout: STEP_TIMEOUT_MS });
        correctionFeedbackReadyMs.push(await elapsedSince(page, missStartedAt));
        interruptions.push({
          afterQuestion: questionIndex + 1,
          kind: "correction-next",
        });
        await nextButton.click();
        await waitForStudyOperable(page, questionIndex + 1);
        correctionAdvanceMs.push(await elapsedSince(page, missStartedAt));
        continue;
      }

      const answerStartedAt = await markNow(page);
      attempts += 1;
      correctCount += 1;
      await typeAndSubmit(page, answer);
      if (questionIndex === EXPECTED_QUESTIONS.length - 1) {
        await page.waitForFunction(
          ({ fixtureId }) => document.querySelector(
            `[data-benchmark-id="${fixtureId}"][data-benchmark-complete="true"]`,
          ) instanceof HTMLElement,
          { fixtureId: FIXTURE_ID },
          { timeout: STEP_TIMEOUT_MS },
        );
        terminalResultMs = await elapsedSince(page, answerStartedAt);
      } else {
        await waitForStudyOperable(page, questionIndex + 1);
        correctOperableMs.push(await elapsedSince(page, answerStartedAt));
      }
    }

    const durationMs = await elapsedSince(page, runStartedAt);
    await page.waitForTimeout(550);
    const terminalStudyRoot = page.locator(`[data-benchmark-id="${FIXTURE_ID}"]`);
    assert(
      await terminalStudyRoot.getAttribute("data-study-index") === "9"
        && await terminalStudyRoot.getAttribute("data-benchmark-complete") === "true",
      "Study fixed-ten generated or advanced to an eleventh problem",
    );
    const afterLearning = await readLearningSnapshot(page);
    assert(snapshotsEqual(beforeLearning, afterLearning), "Study benchmark changed learning state");
    assert(diagnostics.pageErrors.length === 0, `Study page errors: ${JSON.stringify(diagnostics.pageErrors)}`);
    assert(
      diagnostics.failedLocalRequests.length === 0,
      `Study local request failures: ${JSON.stringify(diagnostics.failedLocalRequests)}`,
    );

    return {
      lane: "study",
      scenario,
      repetition,
      questions,
      attempts,
      correctCount,
      firstPassCorrectCount: correctCount,
      eventualCorrectCount: correctCount,
      durationMs,
      completedProblemsPerMinute: 600_000 / durationMs,
      attemptsPerMinute: attempts * 60_000 / durationMs,
      correctOperableMs,
      terminalResultMs,
      correctionAdvanceMs,
      correctionFeedbackReadyMs,
      interruptions,
      persistence: {
        receiptScope: "not-applicable-dev-session",
        learningStateUnchanged: true,
      },
      diagnostics,
    };
  } finally {
    await context.close();
  }
};

const waitForExploreAttempt = async (page, fixtureIndex, previousAttemptKey) => {
  try {
    await page.waitForFunction(
      ({ expectedIndex, priorKey }) => {
        const attempt = document.querySelector('[data-testid="explore-attempt"]');
        const encounter = document.querySelector('.explore-immersive[data-state="idle"]');
        const digit = [...document.querySelectorAll("button")].find(
          (button) => button.getAttribute("aria-label") === "1",
        );
        return attempt instanceof HTMLElement
          && Number(attempt.dataset.benchmarkIndex) === expectedIndex
          && Boolean(attempt.dataset.attemptKey)
          && (!priorKey || attempt.dataset.attemptKey !== priorKey)
          && attempt.dataset.saveState === "idle"
          && encounter instanceof HTMLElement
          && digit instanceof HTMLButtonElement
          && !digit.disabled;
      },
      { expectedIndex: fixtureIndex, priorKey: previousAttemptKey || null },
      { timeout: STEP_TIMEOUT_MS },
    );
  } catch (error) {
    const state = await page.evaluate(() => {
      const world = document.querySelector(".explore-world");
      const attempt = document.querySelector('[data-testid="explore-attempt"]');
      const digit = [...document.querySelectorAll("button")].find(
        (button) => button.getAttribute("aria-label") === "1",
      );
      return {
        hash: window.location.hash,
        control: window.__SANSU_E2E__,
        world: world instanceof HTMLElement ? { ...world.dataset } : null,
        attempt: attempt instanceof HTMLElement ? { ...attempt.dataset } : null,
        encounterState: document.querySelector(".explore-immersive")?.getAttribute("data-state"),
        digitDisabled: digit instanceof HTMLButtonElement ? digit.disabled : null,
        bodyText: document.body.innerText.slice(0, 800),
      };
    });
    throw new Error(`Explore Q${fixtureIndex + 1} did not become operable: ${JSON.stringify(state)}\n${error}`);
  }
};

const waitForExploreRetry = async (page, fixtureIndex, previousAttemptKey) => {
  await waitForExploreAttempt(page, fixtureIndex, previousAttemptKey);
  const question = await page.locator('[data-question-text]').getAttribute("data-question-text");
  assert(question === EXPECTED_QUESTIONS[fixtureIndex], `Explore retry changed Q${fixtureIndex + 1}`);
};

const detectExplorePostAnswerState = async (
  page,
  previousAttemptKey,
  expectedFixtureIndex,
) => page.waitForFunction(
  ({ priorKey, expectedIndex }) => {
    const visible = (element) => element instanceof HTMLElement
      && element.getBoundingClientRect().width > 0
      && element.getBoundingClientRect().height > 0;
    const dialog = document.querySelector('.explore-research-overlay[role="dialog"], [role="dialog"][aria-labelledby="discovery-title"]');
    if (visible(dialog)) return "discovery";
    const attempt = document.querySelector('[data-testid="explore-attempt"]');
    const digit = [...document.querySelectorAll("button")].find(
      (button) => button.getAttribute("aria-label") === "1",
    );
    if (
      attempt instanceof HTMLElement
      && attempt.dataset.attemptKey
      && attempt.dataset.attemptKey !== priorKey
      && Number(attempt.dataset.benchmarkIndex) === expectedIndex
      && attempt.dataset.saveState === "idle"
      && document.querySelector('.explore-immersive[data-state="idle"]')
      && digit instanceof HTMLButtonElement
      && !digit.disabled
    ) return "attempt";
    if (visible(document.querySelector("#explore-path-choice-title"))) return "path-choice";
    if (visible(document.querySelector("#return-summary-title"))) return "summary";
    return false;
  },
  { priorKey: previousAttemptKey, expectedIndex: expectedFixtureIndex },
  { timeout: STEP_TIMEOUT_MS },
);

const closeExploreDiscovery = async (page) => {
  const selector = '.explore-research-overlay[role="dialog"], [role="dialog"][aria-labelledby="discovery-title"]';
  const dialogs = page.locator(selector);
  let dialog;
  for (let index = 0; index < await dialogs.count(); index += 1) {
    const candidate = dialogs.nth(index);
    if (await candidate.isVisible()) {
      dialog = candidate;
      break;
    }
  }
  if (!dialog) return;

  const researchClose = dialog.getByRole("button", { name: "調査ノートを とじる" });
  const closeButton = await researchClose.count()
    ? researchClose
    : dialog.getByRole("button", { name: "ひょうほんを バッグへ" });
  try {
    await closeButton.click({ timeout: 3_000 });
    await dialog.waitFor({ state: "hidden", timeout: 3_000 });
  } catch (error) {
    const stillVisible = await page.locator(selector).evaluateAll((elements) => elements.some((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }));
    if (stillVisible) throw error;
  }
};

const configureExploreReplay = async (page, repetition, scenario) => {
  await page.evaluate(({ fixtureId, seed, now }) => {
    window.__SANSU_E2E__ = {
      ...(window.__SANSU_E2E__ || {}),
      exploreBenchmark: { fixtureId, startIndex: 8 },
      exploreRun: { seed, now, maxEnergy: 2 },
    };
  }, {
    fixtureId: FIXTURE_ID,
    seed: `fixed-ten-${scenario}-${repetition}-b`,
    now: 20_000 + repetition,
  });
};

const settleExploreCorrect = async ({
  page,
  previousAttemptKey,
  questionIndex,
  repetition,
  scenario,
  interruptions,
}) => {
  let firstState;
  while (true) {
    const handle = await detectExplorePostAnswerState(
      page,
      previousAttemptKey,
      questionIndex + 1,
    );
    const state = await handle.jsonValue();
    if (!firstState) firstState = state;
    if (state === "attempt") {
      return { firstState, terminal: false };
    }
    if (state === "discovery") {
      interruptions.push({ afterQuestion: questionIndex + 1, kind: "discovery-close" });
      await closeExploreDiscovery(page);
      continue;
    }
    if (state === "path-choice") {
      const heading = page.locator("#explore-path-choice-title");
      const section = heading.locator("xpath=ancestor::section[1]");
      const routeCards = section.locator(".explore-route-card");
      if (await routeCards.count()) {
        interruptions.push({ afterQuestion: questionIndex + 1, kind: "route-choice" });
        await routeCards.first().click();
        continue;
      }

      assert(questionIndex === 7, `empty route appeared after Q${questionIndex + 1}`);
      interruptions.push({ afterQuestion: 8, kind: "return" });
      await section.getByRole("button", { name: "ここまでを ノートに のこす" }).click();
      await page.locator("#return-summary-title").waitFor({ timeout: STEP_TIMEOUT_MS });
      await configureExploreReplay(page, repetition, scenario);
      interruptions.push({ afterQuestion: 8, kind: "replay" });
      await page.getByRole("button", { name: "もういちど たんけん" }).click();
      await waitForExploreAttempt(page, 8);
      return { firstState, terminal: false };
    }
    if (state === "summary") {
      assert(questionIndex === 9, `summary appeared after Q${questionIndex + 1}`);
      return { firstState, terminal: true };
    }
  }
};

const runExploreLane = async (browser, scenario, repetition) => {
  const context = await browser.newContext({
    baseURL: activeBaseUrl,
    locale: "ja-JP",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    viewport: VIEWPORT,
  });
  const page = await context.newPage();
  const diagnostics = attachPageDiagnostics(page);
  await page.addInitScript(({ fixtureId, seed, now }) => {
    window.__SANSU_E2E__ = {
      exploreBenchmark: { fixtureId, startIndex: 0 },
      exploreRun: { seed, now, maxEnergy: 12 },
    };
  }, {
    fixtureId: FIXTURE_ID,
    seed: `fixed-ten-${scenario}-${repetition}-warm`,
    now: 1_000 + repetition,
  });

  try {
    await completeOnboarding(page);
    await setProfileSoundOff(page);
    await page.evaluate(({ fixtureId, seed, now }) => {
      window.__SANSU_E2E__ = {
        ...(window.__SANSU_E2E__ || {}),
        exploreBenchmark: { fixtureId, startIndex: 0 },
        exploreRun: { seed, now, maxEnergy: 12 },
      };
    }, {
      fixtureId: FIXTURE_ID,
      seed: `fixed-ten-${scenario}-${repetition}-a`,
      now: 10_000 + repetition,
    });
    await navigateHash(page, "/battle", /#\/battle/);
    await navigateHash(page, "/explore", /#\/explore/);
    await waitForExploreAttempt(page, 0);
    await page.locator('.snap-root-opening-art[data-asset-state="ready"]')
      .waitFor({ timeout: STEP_TIMEOUT_MS });
    await assertFullTenKey(page);
    assert(
      await page.locator(".explore-world").getAttribute("data-benchmark-id") === FIXTURE_ID,
      "Explore did not expose the fixed-ten lane",
    );
    const openingArt = page.locator(".snap-root-opening-art");
    const runtimeIdentity = {
      deliveryId: await openingArt.getAttribute("data-delivery-id"),
      visualCandidateId: await openingArt.getAttribute("data-visual-candidate-id"),
    };
    assert(runtimeIdentity.deliveryId === "snap-root-v1", `Unexpected delivery: ${JSON.stringify(runtimeIdentity)}`);
    assert(runtimeIdentity.visualCandidateId === "dig-pop-painted-v2", `Unexpected candidate: ${JSON.stringify(runtimeIdentity)}`);

    const beforeLearning = await readLearningSnapshot(page);
    assert(
      beforeLearning.profiles.every((profile) => profile.soundEnabled === false),
      "Explore benchmark profile is not muted",
    );
    const questions = [];
    const correctOperableMs = [];
    const coldOpenCorrectOperableMs = [];
    const correctBoundaryMs = [];
    const sameQuestionOperableMs = [];
    const interruptions = [];
    const runIds = [];
    let attempts = 0;
    const runStartedAt = await markNow(page);

    for (let questionIndex = 0; questionIndex < EXPECTED_QUESTIONS.length; questionIndex += 1) {
      const attempt = page.getByTestId("explore-attempt");
      const runId = await attempt.getAttribute("data-run-id");
      if (runId && !runIds.includes(runId)) runIds.push(runId);
      assert(
        Number(await attempt.getAttribute("data-benchmark-index")) === questionIndex,
        `Explore fixture index mismatch at Q${questionIndex + 1}`,
      );
      const question = await page.locator('[data-question-text]').getAttribute("data-question-text");
      assert(question === EXPECTED_QUESTIONS[questionIndex], (
        `Explore Q${questionIndex + 1} mismatch: expected ${EXPECTED_QUESTIONS[questionIndex]}, got ${question}`
      ));
      questions.push(question);
      const answer = answerForQuestion(question);

      let currentAttemptKey = await attempt.getAttribute("data-attempt-key");
      assert(currentAttemptKey, `Explore Q${questionIndex + 1} has no attempt key`);
      if (scenario === "miss-at-q4-q8" && (questionIndex === 3 || questionIndex === 7)) {
        const missStartedAt = await markNow(page);
        attempts += 1;
        await typeAndSubmit(page, wrongAnswerFor(answer));
        await waitForExploreRetry(page, questionIndex, currentAttemptKey);
        sameQuestionOperableMs.push(await elapsedSince(page, missStartedAt));
        currentAttemptKey = await attempt.getAttribute("data-attempt-key");
        assert(currentAttemptKey, `Explore Q${questionIndex + 1} retry has no attempt key`);
      }

      const answerStartedAt = await markNow(page);
      attempts += 1;
      await typeAndSubmit(page, answer);
      const settled = await settleExploreCorrect({
        page,
        previousAttemptKey: currentAttemptKey,
        questionIndex,
        repetition,
        scenario,
        interruptions,
      });
      const transitionMs = await elapsedSince(page, answerStartedAt);
      if (settled.firstState === "attempt") {
        correctOperableMs.push(transitionMs);
        if (questionIndex <= 1) coldOpenCorrectOperableMs.push(transitionMs);
      } else {
        correctBoundaryMs.push({
          question: questionIndex + 1,
          state: settled.firstState,
          milliseconds: transitionMs,
        });
      }
    }

    const durationMs = await elapsedSince(page, runStartedAt);
    const afterLearning = await readLearningSnapshot(page);
    assert(snapshotsEqual(beforeLearning, afterLearning), "Explore fixed-ten changed SRS learning state");
    const exploreSnapshot = await readExploreSnapshot(page);
    const answerEvents = exploreSnapshot.exploreRunEvents.filter((event) => (
      runIds.includes(event.runId) && event.type === "problem_answered"
    ));
    const attemptKeys = answerEvents.map((event) => event.attemptKey);
    const runRecords = runIds.map((runId) => exploreSnapshot.exploreRuns.find(
      (run) => run.runId === runId,
    ));
    assert(runRecords.every(Boolean), "Explore fixed-ten did not persist both run records");
    const expectedRunAggregates = scenario === "all-correct"
      ? [
        { problemsAnswered: 8, correctCount: 8, incorrectCount: 0, status: "returned" },
        { problemsAnswered: 2, correctCount: 2, incorrectCount: 0, status: "rescued" },
      ]
      : [
        { problemsAnswered: 10, correctCount: 8, incorrectCount: 2, status: "returned" },
        { problemsAnswered: 2, correctCount: 2, incorrectCount: 0, status: "rescued" },
      ];
    const runAggregateIntegrity = runRecords.every((run, index) => {
      const expected = expectedRunAggregates[index];
      return run.problemsAnswered === expected.problemsAnswered
        && run.correctCount === expected.correctCount
        && run.incorrectCount === expected.incorrectCount
        && run.skippedCount === 0
        && run.status === expected.status;
    });
    const endedEvents = exploreSnapshot.exploreRunEvents.filter((event) => (
      runIds.includes(event.runId) && event.type === "run_ended"
    ));
    const terminalEventIntegrity = endedEvents.length === 2
      && runIds.every((runId, index) => endedEvents.some((event) => (
        event.runId === runId
        && event.payload.status === expectedRunAggregates[index].status
      )));
    const assignmentIntegrityCount = answerEvents.filter((event) => {
      const run = runRecords.find((candidate) => candidate.runId === event.runId);
      const assignment = Object.values(run?.learningAssignments || {}).find(
        (candidate) => candidate.assignmentKey === event.assignmentKey,
      );
      return event.learningSource === "game-only-fallback"
        && event.learningLogId === undefined
        && event.recordedSkillId === "add_1d_1"
        && assignment?.source === "game-only-fallback"
        && assignment.affectsSrs === false
        && assignment.categoryId === event.recordedSkillId
        && assignment.gateId === event.gateId
        && assignment.isReview === false
        && assignment.isMaintenanceCheck === false;
    }).length;
    assert(answerEvents.length === attempts, `Explore expected ${attempts} answer receipts, got ${answerEvents.length}`);
    assert(new Set(attemptKeys).size === attemptKeys.length, "Explore fixed-ten wrote a duplicate attempt key");
    assert(answerEvents.every((event) => event.affectsSrs === false), "Explore fixed-ten wrote an SRS-affecting event");
    assert(runIds.length === 2, `Explore fixed-ten should use two real runs, got ${runIds.length}`);
    assert(runAggregateIntegrity, `Explore fixed-ten run aggregates drifted: ${JSON.stringify(runRecords)}`);
    assert(terminalEventIntegrity, `Explore fixed-ten terminal events drifted: ${JSON.stringify(endedEvents)}`);
    assert(
      assignmentIntegrityCount === answerEvents.length,
      "Explore fixed-ten event/assignment source integrity failed",
    );
    assert(diagnostics.pageErrors.length === 0, `Explore page errors: ${JSON.stringify(diagnostics.pageErrors)}`);
    assert(
      diagnostics.failedLocalRequests.length === 0,
      `Explore local request failures: ${JSON.stringify(diagnostics.failedLocalRequests)}`,
    );

    return {
      lane: "explore",
      scenario,
      repetition,
      questions,
      attempts,
      correctCount: 10,
      firstPassCorrectCount: scenario === "all-correct" ? 10 : 8,
      eventualCorrectCount: 10,
      durationMs,
      completedProblemsPerMinute: 600_000 / durationMs,
      attemptsPerMinute: attempts * 60_000 / durationMs,
      correctOperableMs,
      coldOpenCorrectOperableMs,
      correctBoundaryMs,
      sameQuestionOperableMs,
      interruptions,
      runIds,
      runtimeIdentity,
      persistence: {
        receiptCount: answerEvents.length,
        uniqueAttemptKeyCount: new Set(attemptKeys).size,
        affectsSrsFalseCount: answerEvents.filter((event) => event.affectsSrs === false).length,
        gameOnlyFallbackCount: answerEvents.filter(
          (event) => event.learningSource === "game-only-fallback",
        ).length,
        learningLogAbsentCount: answerEvents.filter(
          (event) => event.learningLogId === undefined,
        ).length,
        assignmentIntegrityCount,
        runAggregateIntegrity,
        terminalEventIntegrity,
        runAggregates: runRecords.map((run) => ({
          runId: run.runId,
          status: run.status,
          problemsAnswered: run.problemsAnswered,
          correctCount: run.correctCount,
          incorrectCount: run.incorrectCount,
          skippedCount: run.skippedCount,
        })),
        learningStateUnchanged: true,
      },
      diagnostics,
    };
  } finally {
    await context.close();
  }
};

const summarizeValues = (values) => ({
  sampleCount: values.length,
  median: round(median(values)),
  p95: round(percentile(values, 0.95)),
});

const aggregateLane = (runs, lane, scenario) => {
  const selected = runs.filter((run) => run.lane === lane && run.scenario === scenario);
  assert(selected.length > 0, `No ${lane}/${scenario} runs were recorded`);
  const throughput = selected.map((run) => run.completedProblemsPerMinute);
  const attemptsPerMinute = selected.map((run) => run.attemptsPerMinute);
  const interruptionCounts = selected.map((run) => run.interruptions.length);
  const interruptionBreakdown = selected.flatMap((run) => run.interruptions)
    .reduce((counts, interruption) => ({
      ...counts,
      [interruption.kind]: (counts[interruption.kind] || 0) + 1,
    }), {});
  const totalQuestions = selected.length * EXPECTED_QUESTIONS.length;
  const totalAttempts = selected.reduce((sum, run) => sum + run.attempts, 0);
  const totalCorrectAttempts = selected.reduce((sum, run) => sum + run.correctCount, 0);
  const totalFirstPassCorrect = selected.reduce((sum, run) => sum + run.firstPassCorrectCount, 0);
  const totalEventualCorrect = selected.reduce((sum, run) => sum + run.eventualCorrectCount, 0);

  return {
    lane,
    scenario,
    runCount: selected.length,
    completedProblemsPerMinute: {
      median: round(median(throughput)),
      p95: round(percentile(throughput, 0.95)),
      range: [round(Math.min(...throughput)), round(Math.max(...throughput))],
    },
    attemptsPerMinute: {
      median: round(median(attemptsPerMinute)),
    },
    accuracy: {
      firstPass: roundRatio(totalFirstPassCorrect / totalQuestions),
      attempt: roundRatio(totalCorrectAttempts / totalAttempts),
      eventual: roundRatio(totalEventualCorrect / totalQuestions),
    },
    correctOperableMs: summarizeValues(selected.flatMap((run) => run.correctOperableMs)),
    coldOpenCorrectOperableMs: summarizeValues(
      selected.flatMap((run) => run.coldOpenCorrectOperableMs || []),
    ),
    terminalResultMs: summarizeValues(
      selected.flatMap((run) => run.terminalResultMs === null ? [] : [run.terminalResultMs]),
    ),
    correctionFeedbackReadyMs: summarizeValues(
      selected.flatMap((run) => run.correctionFeedbackReadyMs || []),
    ),
    correctionAdvanceMs: summarizeValues(
      selected.flatMap((run) => run.correctionAdvanceMs || []),
    ),
    sameQuestionOperableMs: summarizeValues(
      selected.flatMap((run) => run.sameQuestionOperableMs || []),
    ),
    interruptionCount: {
      median: round(median(interruptionCounts)),
      range: [Math.min(...interruptionCounts), Math.max(...interruptionCounts)],
      breakdown: interruptionBreakdown,
    },
  };
};

const buildReport = (runs, environment) => {
  const aggregates = SCENARIOS.flatMap((scenario) => [
    aggregateLane(runs, "study", scenario),
    aggregateLane(runs, "explore", scenario),
  ]);
  const findAggregate = (lane, scenario) => aggregates.find((aggregate) => (
    aggregate.lane === lane && aggregate.scenario === scenario
  ));
  const studyAll = findAggregate("study", "all-correct");
  const exploreAll = findAggregate("explore", "all-correct");
  const studyMiss = findAggregate("study", "miss-at-q4-q8");
  const exploreMiss = findAggregate("explore", "miss-at-q4-q8");
  const rawMedianThroughput = (lane, scenario) => median(runs
    .filter((run) => run.lane === lane && run.scenario === scenario)
    .map((run) => run.completedProblemsPerMinute));
  const throughputRatio = rawMedianThroughput("explore", "all-correct")
    / rawMedianThroughput("study", "all-correct");
  const missThroughputRatio = rawMedianThroughput("explore", "miss-at-q4-q8")
    / rawMedianThroughput("study", "miss-at-q4-q8");
  const exactFixture = runs.every((run) => (
    JSON.stringify(run.questions) === JSON.stringify(EXPECTED_QUESTIONS)
  ));
  const persistenceIntegrity = runs.every((run) => (
    run.persistence.learningStateUnchanged
    && (run.lane !== "explore" || run.persistence.receiptCount === run.attempts)
    && (run.lane !== "explore" || run.persistence.uniqueAttemptKeyCount === run.attempts)
    && (run.lane !== "explore" || run.persistence.affectsSrsFalseCount === run.attempts)
    && (run.lane !== "explore" || run.persistence.gameOnlyFallbackCount === run.attempts)
    && (run.lane !== "explore" || run.persistence.learningLogAbsentCount === run.attempts)
    && (run.lane !== "explore" || run.persistence.assignmentIntegrityCount === run.attempts)
    && (run.lane !== "explore" || run.persistence.runAggregateIntegrity)
    && (run.lane !== "explore" || run.persistence.terminalEventIntegrity)
  ));
  const expectedInterruptionKinds = new Set([
    "correction-next",
    "discovery-close",
    "route-choice",
    "return",
    "replay",
  ]);
  const unexpectedInterruptions = runs.flatMap((run) => run.interruptions)
    .filter((interruption) => !expectedInterruptionKinds.has(interruption.kind));
  const earlyExploreInterruptions = runs
    .filter((run) => run.lane === "explore")
    .flatMap((run) => run.interruptions)
    .filter((interruption) => interruption.afterQuestion <= 2);
  const runtimeIdentityMatches = runs
    .filter((run) => run.lane === "explore")
    .every((run) => (
      run.runtimeIdentity.deliveryId === OPENING_EXPERIENCE
      && run.runtimeIdentity.visualCandidateId === "dig-pop-painted-v2"
    ));
  const candidateColdOpenCorrectSamples = runs
    .filter((run) => run.lane === "explore" && run.scenario === "all-correct")
    .flatMap((run) => run.coldOpenCorrectOperableMs);
  const exploreSameQuestionSamples = runs
    .filter((run) => run.lane === "explore" && run.scenario === "miss-at-q4-q8")
    .flatMap((run) => run.sameQuestionOperableMs);
  const studyCorrectionFeedbackSamples = runs
    .filter((run) => run.lane === "study" && run.scenario === "miss-at-q4-q8")
    .flatMap((run) => run.correctionFeedbackReadyMs);
  const rawCandidateCorrectP95 = percentile(candidateColdOpenCorrectSamples, 0.95);
  const rawExploreIncorrectP95 = percentile(exploreSameQuestionSamples, 0.95);
  const cellRunCounts = Object.fromEntries(aggregates.map((aggregate) => [
    `${aggregate.lane}:${aggregate.scenario}`,
    aggregate.runCount,
  ]));
  const gates = {
    exactFixedTen: exactFixture,
    allCorrectExploreThroughputNotBelowStudy: throughputRatio >= 1,
    candidateQ1Q2CorrectOperableP95Within650Ms: rawCandidateCorrectP95 !== null
      && rawCandidateCorrectP95 <= CORRECT_BUDGET_MS,
    exploreSameQuestionOperableP95Within550Ms: rawExploreIncorrectP95 !== null
      && rawExploreIncorrectP95 <= INCORRECT_BUDGET_MS,
    persistenceIntegrity,
    noUnexpectedInterruptions: unexpectedInterruptions.length === 0,
    firstTwoExploreAnswersNeedNoExtraTap: earlyExploreInterruptions.length === 0,
    runtimeIdentityMatches,
  };
  const eligibility = {
    tenRunsInEveryCell: Object.values(cellRunCounts).every((count) => count >= 10),
    twentyCandidateQ1Q2CorrectSamples: candidateColdOpenCorrectSamples.length >= 20,
    twentyExploreIncorrectSamples: exploreSameQuestionSamples.length >= 20,
    twentyStudyCorrectionFeedbackSamples: studyCorrectionFeedbackSamples.length >= 20,
    exactFixture,
    cleanRevision: !environment.git.dirty,
    harnessOwnedServer: environment.server.startedByHarness,
    runtimeIdentityMatches,
  };
  const evidenceEligible = Object.values(eligibility).every(Boolean);
  const fixedTenTechnicalPass = Object.values(gates).every(Boolean);

  return {
    schemaVersion: 2,
    fixtureId: FIXTURE_ID,
    fixtureHash: FIXTURE_HASH,
    generatedAt: new Date().toISOString(),
    environment,
    conditions: {
      viewport: VIEWPORT,
      reducedMotion: true,
      sound: "off-in-active-profile",
      input: "physical-keyboard",
      assets: "warmed-before-measurement",
      openingExperience: OPENING_EXPERIENCE,
      repetitions,
      order: "Study/Explore alternated by repetition and scenario",
      thinkingTime: "automation-only; no artificial child thinking delay",
      plannerTruth: "fixed UI fixture; production planner authenticity remains a separate gate",
    },
    semantics: {
      allCorrect: "Primary apples-to-apples fixed-ten throughput gate.",
      missAtQ4Q8: "Diagnostic recovery/friction evidence. Study shows correction then advances; Explore retries and corrects the same question.",
      incorrectTiming: "The 550ms gate applies only to Explore same-question operability. Study correction feedback and explicit advance are reported separately.",
      exploreRunShape: "8 answers, real return, real summary/restart, then 2 answers.",
      interruptions: "Every required non-answer click is counted; automation clicks immediately, so child decision time is not included.",
    },
    aggregates,
    comparison: {
      allCorrectExploreToStudyThroughputRatio: roundRatio(throughputRatio),
      allCorrectStudyMedianProblemsPerMinute: studyAll.completedProblemsPerMinute.median,
      allCorrectExploreMedianProblemsPerMinute: exploreAll.completedProblemsPerMinute.median,
      missFlowExploreToStudyThroughputRatio: roundRatio(missThroughputRatio),
      missFlowStudyMedianProblemsPerMinute: studyMiss.completedProblemsPerMinute.median,
      missFlowExploreMedianProblemsPerMinute: exploreMiss.completedProblemsPerMinute.median,
      candidateQ1Q2CorrectOperableP95Ms: round(rawCandidateCorrectP95),
      exploreSameQuestionOperableP95Ms: round(rawExploreIncorrectP95),
    },
    evidence: {
      status: evidenceEligible ? "gating" : "diagnostic",
      eligible: evidenceEligible,
      eligibility,
      cellRunCounts,
      sampleCounts: {
        candidateQ1Q2Correct: candidateColdOpenCorrectSamples.length,
        exploreIncorrectSameQuestion: exploreSameQuestionSamples.length,
        studyCorrectionFeedback: studyCorrectionFeedbackSamples.length,
      },
    },
    gates,
    fixedTenTechnicalPass,
    pass: evidenceEligible && fixedTenTechnicalPass,
    productionDecision: "not-evaluated-hold",
    runs,
  };
};

const main = async () => {
  let browser;
  let devServer;
  let startedByScript = false;
  try {
    const serverSession = await getServerSession();
    activeBaseUrl = serverSession.baseUrl;
    devServer = serverSession.devServer;
    startedByScript = serverSession.startedByScript;
    browser = await chromium.launch({ headless: true });
    const environment = {
      git: readGitMetadata(),
      app: {
        titleMarker: APP_TITLE_MARKER,
        baseUrl: activeBaseUrl,
      },
      server: {
        startedByHarness: startedByScript,
      },
      browser: {
        engine: "chromium",
        version: browser.version(),
      },
      productionDefaultOpeningExperience: "classic-v1",
      validationOpeningExperience: OPENING_EXPERIENCE,
      visualCandidateId: "dig-pop-painted-v2",
    };

    const runs = [];
    for (let repetition = 1; repetition <= repetitions; repetition += 1) {
      for (let scenarioIndex = 0; scenarioIndex < SCENARIOS.length; scenarioIndex += 1) {
        const scenario = SCENARIOS[scenarioIndex];
        const exploreFirst = (repetition + scenarioIndex) % 2 === 0;
        const lanes = exploreFirst ? ["explore", "study"] : ["study", "explore"];
        for (const lane of lanes) {
          process.stdout.write(`Benchmark ${repetition}/${repetitions} ${scenario} ${lane}... `);
          const run = lane === "study"
            ? await runStudyLane(browser, scenario, repetition)
            : await runExploreLane(browser, scenario, repetition);
          runs.push(run);
          console.log(`${round(run.completedProblemsPerMinute)} problems/min, ${run.interruptions.length} interruptions`);
        }
      }
    }

    const report = buildReport(runs, environment);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log("Fixed-ten throughput summary", {
      output: outputPath,
      comparison: report.comparison,
      gates: report.gates,
      evidence: report.evidence,
      fixedTenTechnicalPass: report.fixedTenTechnicalPass,
      pass: report.pass,
    });
    if (report.evidence.eligible && !report.pass) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (startedByScript && devServer) stopDevServer(devServer);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});

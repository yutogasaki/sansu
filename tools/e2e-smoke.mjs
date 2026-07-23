import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";

const HOST = "127.0.0.1";
const PORT_CANDIDATES = [4173, 4174, 4175];
const APP_TITLE_MARKER = "<title>ポッコのふしぎずかん</title>";
const DEV_START_TIMEOUT_MS = 45_000;
const STEP_TIMEOUT_MS = 15_000;
const SCENARIO_TIMEOUT_MS = 60_000;
const RAPID_LOOP_CI_BUDGET_MS = 1_500;
const RAPID_LOOP_CORRECT_PRODUCT_BUDGET_MS = 650;
const RAPID_LOOP_INCORRECT_PRODUCT_BUDGET_MS = 550;
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
  throw new Error(`Fuwamana dev server did not become ready within ${timeoutMs}ms: ${url}`);
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
      console.log(`Fuwamana is already running on ${url}; looking for a dedicated smoke-test port.`);
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

  throw new Error(`Unable to find a free port for Fuwamana dev server. Tried: ${PORT_CANDIDATES.join(", ")}`);
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

const scenarioOnboardingToExploreProblem = async (browser) => {
  const context = await browser.newContext({ baseURL: activeBaseUrl });
  const page = await context.newPage();
  await clearClientStorage(page);

  await completeOnboarding(page);
  await waitForExploreFirstProblemReady(page);

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

const scenarioExploreLaunchAndReturn = async (browser) => {
  const context = await browser.newContext({ baseURL: activeBaseUrl, reducedMotion: "reduce" });
  const page = await context.newPage();
  await clearClientStorage(page);

  await completeOnboarding(page, /足し算まで/);
  await waitForExploreFirstProblemReady(page);
  const returningRunId = await page.locator(".explore-world").getAttribute("data-run-id");
  await solveMakimodonOpening(page);
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
  await art.waitFor({ timeout: STEP_TIMEOUT_MS });
  await page.locator('.snap-root-opening-art[data-asset-state="ready"]')
    .waitFor({ timeout: STEP_TIMEOUT_MS });
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
  await page.screenshot({ path: `${runtimeAuditDir}/${viewport.width}-ready.png` });

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
      await page.screenshot({ path: `${runtimeAuditDir}/390-${expectedStage}.png` });
    }

    const finalAnswer = await getExploreNumericAnswer(page);
    await page.keyboard.type(String(finalAnswer));
    await page.getByRole("button", { name: "こたえる" }).click();
    await page.locator('.snap-root-opening-art[data-stage="popped"]')
      .waitFor({ timeout: RAPID_LOOP_CI_BUDGET_MS });
    await assertSnapRootPaintedResolution(page, viewport);
    await page.screenshot({ path: `${runtimeAuditDir}/390-popped.png` });
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
      await page.screenshot({ path: `${runtimeAuditDir}/${viewport.width}-${expectedStage}.png` });
    }

    const finalAnswer = await getExploreNumericAnswer(page);
    await page.keyboard.type(String(finalAnswer));
    await page.getByRole("button", { name: "こたえる" }).click();
    await page.locator('.snap-root-opening-art[data-stage="popped"]')
      .waitFor({ timeout: RAPID_LOOP_CI_BUDGET_MS });
    await assertSnapRootViewportFit(page, viewport, { requireTappable: false });
    await assertSnapRootPaintedResolution(page, viewport);
    await page.screenshot({ path: `${runtimeAuditDir}/${viewport.width}-popped.png` });
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
  assert(
    await discovery.getByRole("list", { name: `${expectedClueCount}つの手掛かりを発見` }).isVisible(),
    `blocking research discovery should be backed by ${expectedClueCount} ordered clues`,
  );
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
    assert(q7Checkpoint?.state.steps === 7, `blocking discovery should be the Q7 boundary; got ${q7Checkpoint?.state.steps}`);
    assert(q7Discovery, "Q7 blocking discovery should be durable before it is acknowledged");
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
  await clearClientStorage(page);

  await completeOnboarding(page, /足し算まで/);
  await clearIndexedDbRows(page, "memoryMath");
  await waitForExploreFirstProblemReady(page);

  const logsBefore = await countIndexedDbRows(page, "logs");
  await solveMakimodonOpening(page);
  await chooseFirstExploreRoute(page);
  await seedDueMathSkills(page, [
    "add_1d_1_bridge",
    "add_1d_2_bridge",
    "add_2d1d_nc_bridge",
    "add_2d1d_c_bridge",
  ]);
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
  const lightBridgeArt = page.getByTestId("authored-light-bridge-art");
  await lightBridgeArt.waitFor({ timeout: STEP_TIMEOUT_MS });
  assert(
    await lightBridgeArt.getAttribute("data-stage") === "idle",
    "the authored light bridge should enter at its idle stage",
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
    await lightBridgeArt.getAttribute("data-stage") === "incorrect",
    "the authored bridge should react to an incorrect answer",
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
  await page.getByText(/左右の ひかりの流れを見て、もういちど ためせるよ/)
    .waitFor({ timeout: STEP_TIMEOUT_MS });

  const bridgeAttemptKey = await page.getByTestId("explore-attempt").getAttribute("data-attempt-key");
  assert(bridgeAttemptKey, "light bridge retry should expose its attempt key");
  await solveExploreAddition(page);
  await page.getByText(/せいかい！ ひかりが ぱっと つながった/).waitFor({ timeout: STEP_TIMEOUT_MS });
  assert(
    await lightBridgeArt.getAttribute("data-stage") === "correct",
    "the authored bridge should reveal its connected state on a correct answer",
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
  const rootArt = page.getByTestId("authored-root-tangle-art");
  await rootArt.waitFor({ timeout: STEP_TIMEOUT_MS });
  assert(
    await rootArt.getAttribute("data-stage") === "idle",
    "the authored root tangle should enter at its tangled idle stage",
  );
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
    await rootArt.getAttribute("data-stage") === "incorrect",
    "the authored root tangle should react to an incorrect answer",
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
    await rootArt.getAttribute("data-stage") === "correct",
    "the authored root tangle should reveal its opened passage after a correct answer",
  );
  await closeBlockingResearchDiscovery(page, /大発見！.*ほたる花の ひかり道/, 3);
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
    results.push(await runScenario("redirects to onboarding when no profile", () => scenarioOnboardingShown(browser)));
    results.push(await runScenario("completes onboarding, chooses a route, and opens Makimodon", () => scenarioOnboardingToExploreProblem(browser)));
    results.push(await runScenario("keeps the direct study route working", () => scenarioStudyRoute(browser)));
    results.push(await runScenario("keeps the direct review route working", () => scenarioReviewRoute(browser)));
    results.push(await runScenario("keeps the direct settings route working", () => scenarioSettingsRoute(browser)));
    results.push(await runScenario("keeps legacy fuwafuwa album out of child records", () => scenarioLegacyAlbumHidden(browser)));
    results.push(await runScenario("completes periodic test from stats and opens results", () => scenarioStatsToPeriodicTest(browser)));
    results.push(await runScenario("launches explore immediately and safely returns at a route break", () => scenarioExploreLaunchAndReturn(browser)));
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
    results.push(await runScenario("opens the root tangle with profile-near subtraction", () => scenarioRootTangleVerticalSlice(browser)));
    results.push(await runScenario("keeps the root tangle playable on tablet", () => scenarioRootTangleVerticalSlice(
      browser,
      { width: 768, height: 1024 },
    )));
    results.push(await runScenario("keeps the root tangle playable on a landscape tablet", () => scenarioRootTangleVerticalSlice(
      browser,
      { width: 1024, height: 768 },
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

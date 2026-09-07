import assert from 'node:assert/strict';

export const ISLAND_CANDIDATE = 'mystic-island-procedural-v2';
export const button = (page, name) => page.getByRole('button', { name, exact: true });
export const activate = (locator, touch = false) => touch ? locator.tap() : locator.click();

export async function seedDev(page, { skill = 'add_1d_1', subject = 'math', familiar = true, name = 'つむぎ' } = {}) {
    return page.evaluate(async ({ skill, subject, familiar, name }) => {
        const { db } = await import('/src/db/index.ts');
        const { createInitialProfile } = await import('/src/domain/user/profile.ts');
        const { saveProfile, setActiveProfileId } = await import('/src/domain/user/repository.ts');
        const { getLevelForSkill } = await import('/src/domain/math/curriculum.ts');
        const { MATH_GENERATORS } = await import('/src/domain/math/index.ts');
        const { ENGLISH_WORDS } = await import('/src/domain/english/words.ts');
        const profile = createInitialProfile(name, 2, Math.max(0, (getLevelForSkill(skill) || 1) - 1), 1, subject);
        profile.soundEnabled = false;
        await saveProfile(profile);
        await setActiveProfileId(profile.id);
        const memory = id => ({ profileId: profile.id, id, strength: 2, nextReview: id === skill ? '2000-01-01' : '2099-01-01',
            updatedAt: '2000-01-01', totalAnswers: 20, correctAnswers: 18, incorrectAnswers: 2, skippedAnswers: 0 });
        if (familiar) {
            await db.memoryMath.bulkPut(Object.keys(MATH_GENERATORS).filter(id => getLevelForSkill(id) <= profile.mathMaxUnlocked)
                .map(id => ({ ...memory(id), status: getLevelForSkill(id) < profile.mathMainLevel ? 'retired' : 'active' })));
            await db.memoryVocab.bulkPut(ENGLISH_WORDS.filter(word => word.level <= profile.vocabMaxUnlocked).map(word => memory(word.id)));
        } else if (skill) await db.memoryMath.put({ ...memory(skill), totalAnswers: 0, correctAnswers: 0, incorrectAnswers: 0, status: 'active' });
        return profile.id;
    }, { skill, subject, familiar, name });
}

export async function readNative(page, profileId) {
    return page.evaluate(async profileId => {
        const open = indexedDB.open('SansuDatabase');
        const database = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
        const tableNames = ['islands', 'islandPlans', 'islandEvents', 'logs', 'memoryMath', 'memoryVocab', 'exploreRuns'];
        const entries = await Promise.all(tableNames.map(async name => {
            const request = database.transaction(name).objectStore(name).getAll();
            const rows = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
            return [name, profileId ? rows.filter(row => row.profileId === profileId) : rows];
        }));
        database.close();
        const state = Object.fromEntries(entries);
        const island = state.islands[0];
        return { ...state, island, plan: state.islandPlans.find(plan => plan.id === island?.pendingPlanId) };
    }, profileId);
}

export async function seedNative(page, id) {
    return page.evaluate(async id => {
        const request = indexedDB.open('SansuDatabase');
        const database = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const profile = { id, name: 'つむぎ', grade: 2, mathStartLevel: 0, mathMainLevel: 1, mathMaxUnlocked: 1,
            vocabStartLevel: 1, vocabMainLevel: 1, vocabMaxUnlocked: 1, subjectMode: 'math', soundEnabled: false,
            mathSkills: {}, vocabWords: {}, mathLevels: [{ level: 1, unlocked: true, enabled: true, recentAnswersNonReview: [] }],
            streak: 0, todayCount: 0, recentAttempts: [], hissanModeEnabled: false };
        const transaction = database.transaction(['profiles', 'appData'], 'readwrite');
        transaction.objectStore('profiles').put(profile);
        transaction.objectStore('appData').put({ id: 'app', schemaVersion: 1, activeProfileId: id, profiles: { [id]: profile } });
        await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); });
        localStorage.setItem('sansu_active_profile', id);
        database.close();
        return id;
    }, id);
}

export async function waitMode(page, mode) {
    await page.locator(`.island-page[data-mode="${mode}"]`).waitFor();
}

export async function waitReady(page) {
    await page.locator(`.island-page[data-visual-candidate-id="${ISLAND_CANDIDATE}"]`).waitFor();
    await page.locator('[data-renderer="three"] canvas').waitFor();
}

export async function runtimeMetadata(page) {
    return page.locator('.island-page').evaluate(element => ({
        revision: element.dataset.buildRevision,
        version: element.dataset.buildVersion,
        delivery: element.dataset.deliveryId,
        candidate: element.dataset.visualCandidateId,
        learningCandidate: element.dataset.learningCandidate ?? 'not-applicable',
        mode: element.dataset.mode,
        renderer: document.querySelector('[data-renderer]')?.getAttribute('data-renderer'),
        artDirection: document.querySelector('[data-renderer]')?.getAttribute('data-art-direction'),
        drawCalls: Number(document.querySelector('[data-renderer]')?.getAttribute('data-draw-calls') ?? 0),
        expanded: document.querySelector('[data-renderer]')?.getAttribute('data-expanded'),
        residentAction: document.querySelector('[data-renderer]')?.getAttribute('data-resident-action'),
        residentItemId: document.querySelector('[data-renderer]')?.getAttribute('data-resident-item-id'),
        viewport: { width: innerWidth, height: innerHeight },
        serviceWorkerControlled: Boolean(navigator.serviceWorker.controller),
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    }));
}

export async function answerUI(page, plan, { incorrect = false, touch = false, dev = true } = {}) {
    const slot = plan.slots[plan.cursor];
    const answer = dev ? await page.evaluate(async slot => {
        const { parkHissanGrid } = await import('/src/domain/park/learning.ts');
        const grid = parkHissanGrid(slot.problem);
        return grid ? grid.steps[slot.hissanStep || 0].correctValues : slot.problem.correctAnswer;
    }, slot) : slot.problem.correctAnswer;
    const inputType = await page.locator('.park-answer').getAttribute('data-input-type');
    let submit;
    if (inputType === 'choice') {
        const choice = slot.problem.inputConfig.choices.find(choice => incorrect ? choice.value !== answer : choice.value === answer);
        assert(choice, 'Expected a matching UI answer choice');
        submit = page.locator('.park-choices').getByRole('button', { name: choice.label, exact: true });
    } else {
        const values = Array.isArray(answer) ? answer : [answer];
        const entered = incorrect ? values.map(value => String(value) === '9' ? '8' : '9') : values;
        for (let index = 0; index < entered.length; index++) {
            if (inputType !== 'hissan') await activate(page.locator('.park-input').nth(index), touch);
            for (const digit of String(entered[index])) {
                if (touch) await activate(page.locator('.park-keypad').getByRole('button', { name: digit === '.' ? 'しょうすうてん' : digit, exact: true }), true);
                else await page.keyboard.type(digit);
            }
        }
        submit = button(page, 'こたえる');
    }
    // Start in the actual submit event, excluding Playwright transport and typing time.
    await page.evaluate(({ revision }) => {
        window.__islandAnswerTiming = undefined;
        document.addEventListener('click', () => {
            const started = performance.now();
            const tick = () => {
                const learning = document.querySelector('[data-island-plan-revision]');
                const form = document.querySelector('.park-answer');
                const ready = form?.querySelector('.park-choices button:not(:disabled), .park-keypad button[aria-label="1"]:not(:disabled)');
                const completed = document.querySelector('.island-page')?.getAttribute('data-mode') === 'reward';
                if ((learning && Number(learning.getAttribute('data-island-plan-revision')) > revision && ready) || completed) {
                    window.__islandAnswerTiming = { ms: performance.now() - started, completed };
                } else requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        }, { capture: true, once: true });
    }, { revision: plan.revision });
    await activate(submit, touch);
    await page.waitForFunction(() => Boolean(window.__islandAnswerTiming), undefined, { timeout: 10000 });
    const timing = await page.evaluate(() => window.__islandAnswerTiming);
    const next = await readNative(page, plan.profileId);
    const saved = next.islandPlans.find(candidate => candidate.id === plan.id);
    assert(saved.revision > plan.revision, 'UI submit must persist a new revision');
    if (incorrect) {
        assert.equal(saved.cursor, plan.cursor);
        assert.deepEqual(saved.slots[plan.cursor].problem, slot.problem);
    }
    return { ...timing, incorrect, inputType, beforeRevision: plan.revision, afterRevision: saved.revision, state: next };
}

export async function assertKeypad(page, requireViewport = true) {
    if (await page.locator('.park-choices').count()) return;
    for (const name of ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', 'こたえを けす', 'ひとつ もどす', 'こたえる']) {
        const key = page.locator('.park-keypad').getByRole('button', { name, exact: true });
        await key.waitFor();
        if (requireViewport) {
            const box = await key.boundingBox();
            const viewport = page.viewportSize();
            assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1,
                `Key ${name} must remain visible without scrolling: ${JSON.stringify(box)}`);
        }
    }
}

export const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * fraction) - 1)] ?? null;

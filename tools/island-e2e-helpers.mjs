import assert from 'node:assert/strict';

export const ISLAND_CANDIDATE = 'mystic-island-shore-garden-v7';
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
            updatedAt: '2000-01-01', totalAnswers: 20, correctAnswers: 18, independentCorrectAnswers: 18, incorrectAnswers: 2, skippedAnswers: 0 });
        if (familiar) {
            await db.memoryMath.bulkPut(Object.keys(MATH_GENERATORS).filter(id => getLevelForSkill(id) <= profile.mathMaxUnlocked)
                .map(id => ({ ...memory(id), status: getLevelForSkill(id) < profile.mathMainLevel ? 'retired' : 'active' })));
            await db.memoryVocab.bulkPut(ENGLISH_WORDS.filter(word => word.level <= profile.vocabMaxUnlocked).map(word => memory(word.id)));
        } else if (skill) await db.memoryMath.put({ ...memory(skill), totalAnswers: 0, correctAnswers: 0, independentCorrectAnswers: 0, incorrectAnswers: 0, status: 'active' });
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
    await page.waitForFunction(() => {
        const root = document.querySelector('.island-page');
        // Learning deliberately hides its mounted world; wait for the actual input surface.
        if (root?.getAttribute('data-mode') === 'learning') return Boolean(root.querySelector('[data-input-ready="true"] .park-answer'));
        const canvas = root?.querySelector('[data-renderer="three"] canvas');
        return Boolean(canvas && canvas.getBoundingClientRect().width > 0 && canvas.getBoundingClientRect().height > 0);
    });
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
    const before = await readNative(page, plan.profileId);
    assert.equal(before.plan?.id, plan.id); assert.equal(before.plan.revision, plan.revision);
    const expectedNextPlanId = JSON.stringify(['island-plan-v1', plan.profileId, before.island.completedSets + 1]);
    const slot = plan.slots[plan.cursor];
    const answer = dev ? await page.evaluate(async slot => {
        const { parkHissanGrid } = await import('/src/domain/park/learning.ts');
        const grid = parkHissanGrid(slot.problem);
        return grid ? grid.steps[slot.hissanStep || 0].correctValues : slot.problem.correctAnswer;
    }, slot) : slot.problem.correctAnswer;
    const inputType = await page.locator('.park-answer').getAttribute('data-input-type');
    const automatic = await page.locator('.park-answer').getAttribute('data-answer-completion') === 'automatic';
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
            const digits = String(entered[index]);
            for (const [position, digit] of [...digits].entries()) {
                if (automatic && index === entered.length - 1 && position === digits.length - 1) {
                    submit = page.locator('.park-keypad').getByRole('button', { name: digit === '.' ? 'しょうすうてん' : digit, exact: true });
                    continue; // The last digit is now the actual submit gesture.
                }
                if (touch) await activate(page.locator('.park-keypad').getByRole('button', { name: digit === '.' ? 'しょうすうてん' : digit, exact: true }), true);
                else await page.keyboard.type(digit);
            }
        }
        if (!automatic) submit = page.locator('.park-answer .park-keypad [data-keypad-submit]');
    }
    // Start in the actual submit event, excluding Playwright transport and typing time.
    await page.evaluate(({ planId, revision, expectedNextPlanId, allowNext, allowReward }) => {
        window.__islandAnswerTiming = undefined;
        document.addEventListener('click', () => {
            const started = performance.now();
            const tick = () => {
                const learning = document.querySelector('[data-island-plan-revision]');
                const ready = learning?.getAttribute('data-input-ready') === 'true';
                const completed = allowReward && document.querySelector('.island-page')?.getAttribute('data-mode') === 'reward';
                const autoContinued = allowNext && ready && learning.getAttribute('data-island-plan-id') === expectedNextPlanId
                    && Number(learning.getAttribute('data-island-plan-revision')) === 0
                    && learning.querySelector('.island-light-trail')?.getAttribute('aria-label')?.startsWith('1もんめ、');
                if ((ready && learning.getAttribute('data-island-plan-id') === planId
                    && Number(learning.getAttribute('data-island-plan-revision')) === revision + 1) || autoContinued || completed) {
                    window.__islandAnswerTiming = { ms: performance.now() - started, completed, autoContinued: Boolean(autoContinued) };
                } else requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        }, { capture: true, once: true });
    }, { planId: plan.id, revision: plan.revision, expectedNextPlanId,
        allowNext: !incorrect && plan.cursor === plan.slots.length - 1 && (before.island.completedSets > 0 || Boolean(plan.growthTarget)),
        allowReward: !incorrect && plan.cursor === plan.slots.length - 1
            && !plan.growthTarget && plan.id === JSON.stringify(['island-plan-v1', plan.profileId, 0]) });
    await activate(submit, touch);
    await page.waitForFunction(() => Boolean(window.__islandAnswerTiming), undefined, { timeout: 10000 });
    const timing = await page.evaluate(() => window.__islandAnswerTiming);
    const next = await readNative(page, plan.profileId);
    const saved = next.islandPlans.find(candidate => candidate.id === plan.id);
    assert.equal(saved.revision, plan.revision + 1, 'One UI submit persists exactly one revision');
    assert.deepEqual(saved.slots.map(slot => slot.problem), plan.slots.map(slot => slot.problem));
    const events = next.islandEvents.filter(event => event.type === 'answer' && !before.islandEvents.some(old => old.id === event.id));
    assert.equal(events.length, 1); assert.equal(events[0].id, JSON.stringify(['island-action-v1', plan.profileId, plan.id, plan.revision]));
    if (timing.autoContinued) {
        assert.equal(saved.status, 'completed'); assert.equal(saved.cursor, saved.slots.length);
        assert.equal(next.island.completedSets, before.island.completedSets + 1);
        assert.equal(next.plan.id, expectedNextPlanId); assert.equal(next.island.pendingPlanId, expectedNextPlanId);
        assert.equal(next.plan.status, 'active'); assert.equal(next.plan.cursor, 0); assert.equal(next.plan.revision, 0);
        assertIslandSectionGrowth(before, next, plan);
        const added = next.islandEvents.filter(event => !before.islandEvents.some(old => old.id === event.id));
        assert.equal(added.filter(event => event.type === 'plan_completed' && event.planId === plan.id).length, 1);
        assert.equal(added.filter(event => event.type === 'plan_started' && event.planId === expectedNextPlanId).length, 1);
    }
    if (incorrect) {
        assert.equal(saved.cursor, plan.cursor);
        assert.deepEqual(saved.slots[plan.cursor].problem, slot.problem);
    }
    return { ...timing, incorrect, inputType, beforeRevision: plan.revision, afterRevision: saved.revision, state: next };
}

/** Check the actual saved plan's contract: legacy choices remain owned; new
 * sections mature a place once without manufacturing another gift. */
export function assertIslandSectionGrowth(before, after, plan = before.plan) {
    assert.deepEqual(after.island.pendingRewards.slice(0, before.island.pendingRewards.length), before.island.pendingRewards);
    if (!plan.growthTarget) {
        assert.equal(after.island.pendingRewards.length, before.island.pendingRewards.length + 1);
        assert.equal(after.island.pendingRewards.at(-1).planId, plan.id);
        return;
    }
    assert.deepEqual(after.island.pendingRewards, before.island.pendingRewards, 'Automatic growth adds no unclaimed furniture');
    assert(before.island.growth && after.island.growth, 'A new growth reservation has persistent growth state');
    for (const habitat of ['garden', 'waterside', 'grove', 'village']) {
        const progress = before.island.growth.progress[habitat], pending = before.island.growth.pendingAnswers?.[habitat] ?? 0;
        if (plan.rewardPacing === 'answers-v1') {
            // Independent cumulative thresholds check marks and saved fractions together.
            const totals = [0, 3, 9, 18, 30, 45, 63];
            const total = Math.min(63, totals[progress] + pending + (habitat === plan.growthTarget ? plan.slots.length : 0));
            const expected = totals.filter(value => value <= total).length - 1;
            assert.equal(after.island.growth.progress[habitat], expected, 'Only completed whole problems grow the frozen place');
            assert.equal(after.island.growth.pendingAnswers[habitat], total - totals[expected], 'Partial effort is saved without duplication');
        } else {
            assert.equal(after.island.growth.progress[habitat], Math.min(6, progress + Number(habitat === plan.growthTarget)),
                'A saved legacy reservation retains one growth mark');
        }
    }
    assert.equal(after.island.customization.points, (before.island.customization?.points ?? before.island.completedSets * 10)
        + (plan.rewardPacing === 'answers-v1' ? plan.slots.length : 10), 'The saved wallet receives the frozen reservation reward once');
    for (const item of before.island.items) {
        const current = after.island.items.find(candidate => candidate.id === item.id);
        assert(current, 'Growth keeps every owned identity');
        assert.deepEqual(current.position, item.position, 'Growth respects moved and stored objects');
        assert.equal(current.rotation, item.rotation);
    }
}

export async function assertKeypad(page, requireViewport = true) {
    if (await page.locator('.park-choices').count()) return;
    const names = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', 'こたえを けす', 'ひとつ もどす'];
    if (!await page.locator('[data-written-auto-confirm]').count()) names.push('こたえる');
    for (const name of names) {
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

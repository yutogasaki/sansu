import assert from 'node:assert/strict';
import { activate, button, readNative } from './island-e2e-helpers.mjs';
import { expectedLearningAnswer, expectedLearningModel } from './island-learning-fixtures.mjs';
import { waitLearningReady } from './island-learning-checks.mjs';

export async function readSupportStores(page) {
    return page.evaluate(async () => {
        const open = indexedDB.open('SansuDatabase');
        const d = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
        const names = [...d.objectStoreNames], tx = d.transaction(names);
        const result = Object.fromEntries(await Promise.all(names.map(name => new Promise((resolve, reject) => {
            const request = tx.objectStore(name).getAll();
            request.onsuccess = () => resolve([name, request.result]); request.onerror = () => reject(request.error);
        }))));
        d.close(); return result;
    });
}

export async function readSupportDraft(page) {
    return page.locator('.park-answer').evaluate(root => ({
        fields: [...root.querySelectorAll('.park-input')].map(node => ({ value: node.querySelector('span')?.textContent,
            active: node.getAttribute('aria-pressed') })),
        written: [...root.querySelectorAll('.park-question [data-written-input]')].map(node => ({
            cell: node.getAttribute('data-written-input'), value: node.textContent, active: node.getAttribute('aria-pressed') })),
        legacy: [...root.querySelectorAll('.park-question .font-mono')].map(node => ({
            value: node.textContent, active: node.className.includes('border-cyan-400') })),
    }));
}

export async function assertWrittenSupportControls(page, { allowScroll = false } = {}) {
    const result = [];
    for (const control of await page.locator('.park-keypad button, .park-question [data-written-input], .island-learning-actions button').all()) {
        if (allowScroll) await control.scrollIntoViewIfNeeded();
        const rect = await control.evaluate(element => {
            const r = element.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return { name: element.getAttribute('aria-label') || element.textContent.trim(), width: r.width, height: r.height,
                visible: r.top >= -.5 && r.left >= -.5 && r.bottom <= innerHeight + .5 && r.right <= innerWidth + .5,
                hit: hit === element || element.contains(hit), disabled: element.disabled };
        });
        assert(rect.width >= 43.5 && rect.height >= 43.5 && rect.visible && (rect.disabled || rect.hit), JSON.stringify(rect));
        result.push(rect);
    }
    for (const name of [...'7894561230', 'こたえを けす', 'ひとつ もどす']) assert(result.some(control => control.name === name));
    const keypad = await page.locator('.park-keypad').boundingBox();
    assert.equal(keypad.height, page.viewportSize().width < 700 ? 224 : 250);
    return result;
}

export async function enterSupportDraft(page, state, touch) {
    const inputType = await page.locator('.park-answer').getAttribute('data-input-type');
    if (inputType === 'choice') return { applicable: false, reason: 'Choices submit immediately; mounted form identity is checked instead.' };
    await activate(button(page, 'こたえを けす'), touch);
    if (inputType === 'hissan') {
        const expected = expectedLearningAnswer(state.plan.slots[state.plan.cursor], inputType);
        await page.keyboard.type(expected.values[0]);
    } else {
        await activate(page.locator('.park-input').first(), touch);
        await page.keyboard.type('3');
        if (inputType === 'multi-number') {
            await activate(page.locator('.park-input').nth(1), touch);
            await page.keyboard.type('8');
        }
    }
    return { applicable: true, value: await readSupportDraft(page) };
}

/** Start at a trusted native click, then observe the next rendered operable revision. */
export async function supportAction(page, before, label, type, touch, { double = false } = {}) {
    const plan = before.plan;
    await waitLearningReady(page, plan);
    await page.evaluate(({ label, id, revision, type }) => {
        window.__islandSupportTiming = undefined;
        const onClick = event => {
            const target = event.target.closest?.('button');
            if (target?.textContent.trim() !== label) return;
            document.removeEventListener('click', onClick, true);
            const started = performance.now(), native = { isTrusted: event.isTrusted, at: started, label,
                x: event.clientX, y: event.clientY, timeOrigin: performance.timeOrigin };
            const tick = () => {
                const root = document.querySelector('[data-island-plan-id]');
                const terminal = document.querySelector('.island-page')?.dataset.mode === 'reward';
                const ready = root?.dataset.islandPlanId === id && Number(root.dataset.islandPlanRevision) === revision + 1
                    && root.dataset.inputReady === 'true' && (type !== 'supported_completed'
                        || document.querySelector('.park-choices button:not(:disabled), .park-keypad button[aria-label="1"]:not(:disabled)'));
                if (terminal || ready) window.__islandSupportTiming = { native, ms: performance.now() - started, terminal };
                else requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        };
        document.addEventListener('click', onClick, true);
    }, { label, id: plan.id, revision: plan.revision, type });
    const control = button(page, label);
    if (double) await control.dblclick({ delay: 0 }); else await activate(control, touch);
    await page.waitForFunction(() => Boolean(window.__islandSupportTiming));
    const timing = await page.evaluate(() => window.__islandSupportTiming);
    assert(timing.native.isTrusted, 'Support must come from a real native UI click');
    const after = await readNative(page, plan.profileId), saved = after.islandPlans.find(item => item.id === plan.id);
    assert.equal(saved.revision, plan.revision + 1, 'One support gesture creates one revision');
    assert.deepEqual(saved.slots.map(slot => slot.problem), plan.slots.map(slot => slot.problem));
    const events = after.islandEvents.filter(event => !before.islandEvents.some(prior => prior.id === event.id));
    const receipt = events.find(event => event.type === type);
    assert(receipt && events.filter(event => event.type === type).length === 1);
    assert.equal(receipt.id, JSON.stringify(['island-action-v1', plan.profileId, plan.id, plan.revision]));
    assert.deepEqual(receipt.action, { type });
    assert.deepEqual(saved.slots[plan.cursor].hissanValues, plan.slots[plan.cursor].hissanValues, 'Models never write solved Hissan cells');
    assert.equal(saved.slots[plan.cursor].hissanStep, plan.slots[plan.cursor].hissanStep);
    if (type === 'skipped') {
        const logs = after.logs.filter(log => !before.logs.some(previous => previous.id === log.id));
        assert.equal(logs.length, 1); assert.equal(logs[0].result, 'skipped');
        assert.equal(receipt.learningLogId, logs[0].id);
    } else { assert.deepEqual(after.logs, before.logs); assert.equal(receipt.learningLogId, undefined); }
    if (type === 'supported_completed') {
        assert.equal(receipt.result, 'supported-completion');
        assert.equal(saved.cursor, plan.cursor + 1);
        assert(timing.ms <= 650, `Supported completion exposes the next input without a forced wait: ${timing.ms}ms`);
    } else {
        assert.equal(saved.cursor, plan.cursor);
        assert.equal(saved.slots[plan.cursor].supportStage, type === 'model_opened' ? 'model' : 'hint');
    }
    return { after, saved, receipt, timing, events };
}

export async function assertModelSurface(page, slot) {
    const surface = page.locator('.island-support-model');
    await surface.waitFor();
    assert.equal(await page.locator('.island-answer-stage').getAttribute('data-support-stage'), 'model');
    assert.equal(await page.locator('.park-keypad:visible, .park-inputs:visible, .park-choices:visible').count(), 0);
    assert.equal(await page.locator('.park-answer .park-keypad button:not(:disabled), .park-answer .park-choices button:not(:disabled), .park-input:not(:disabled)').count(), 0);
    const type = await page.locator('.park-answer').getAttribute('data-input-type');
    if (type === 'hissan') {
        const grid = expectedLearningModel(slot);
        assert(grid && grid.writtenLayout, 'This separate case requires the actual full written multiplication/division model');
        assert.equal(Number(await surface.locator('.written-arithmetic').getAttribute('data-written-step')), grid.steps.length);
        assert.equal(await surface.locator('[data-written-input]').count(), 0);
        const offset = grid.writtenLayout.kind === 'multiplication' ? 1 : 0;
        for (const [index, row] of grid.rows.entries()) {
            if (row.type === 'separator') continue;
            const actual = await surface.locator(`[data-row="${index}"] .written-cell`).allTextContents();
            assert.deepEqual(actual, row.cells.slice(offset).map(cell => cell.correctValue ?? cell.value), `Full worked row ${index} retains every frozen digit/place`);
        }
        const history = await surface.locator('.written-history').evaluate(element => ({ client: element.clientHeight, scroll: element.scrollHeight }));
        assert(history.scroll <= history.client + 1, 'Full model rows are not clipped into the tiny live-input history viewport');
    } else {
        const expected = slot.problem.displayAnswer ?? (Array.isArray(slot.problem.correctAnswer) ? slot.problem.correctAnswer.join(' / ') : slot.problem.correctAnswer);
        // Vocabulary deliberately uses a plain word span; math may contain glyphs.
        const answer = surface.locator('.island-support-answer > span');
        const rendered = await answer.evaluate(element => [...element.childNodes].map(node => node instanceof Element
            && node.hasAttribute('data-island-glyph') ? node.getAttribute('data-island-glyph') : node.textContent).join(''));
        assert.equal(rendered, String(expected));
    }
    const next = button(page, 'つぎへ すすむ');
    await next.scrollIntoViewIfNeeded();
    const geometry = await next.evaluate(element => {
        const r = element.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { width: r.width, height: r.height, visible: r.top >= 0 && r.bottom <= innerHeight, hit: hit === element || element.contains(hit) };
    });
    assert(geometry.width >= 43.5 && geometry.height >= 43.5 && geometry.visible && geometry.hit);
    return { inputType: type, geometry };
}

export async function assertModelKeyboardBlocked(page) {
    const stores = await readSupportStores(page), draft = await readSupportDraft(page);
    // A real click on the displayed model gives the page focus, without activating
    // Finish. Keyboard events are genuine browser input, never dispatched JS.
    await page.locator('.island-support-model strong').filter({ hasText: /^おてほん$/ }).click();
    await page.keyboard.type('0123456789');
    for (const key of ['Backspace', 'ArrowLeft', 'ArrowRight', 'Enter']) await page.keyboard.press(key);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.deepEqual(await readSupportDraft(page), draft, 'Model keys cannot edit the retained live draft');
    assert.deepEqual(await readSupportStores(page), stores, 'Model keys cannot submit, finish or write any store');
    return { nativeKeys: '0123456789 / Backspace / ArrowLeft / ArrowRight / Enter', storesUnchanged: Object.keys(stores).length };
}

export function assertSupportedIntegrity(before, after, plan, cursor) {
    const slot = plan.slots[cursor], subject = slot.problem.subject, id = slot.problem.categoryId;
    const table = subject === 'math' ? 'memoryMath' : 'memoryVocab';
    const previous = before[table].find(row => row.profileId === plan.profileId && row.id === id);
    const current = after[table].find(row => row.profileId === plan.profileId && row.id === id);
    assert(previous && current);
    const withoutTiming = row => { const { updatedAt, nextReview, ...rest } = row; void updatedAt; void nextReview; return rest; };
    assert.deepEqual(withoutTiming(current), withoutTiming(previous), 'Supported finish changes no mastery/counter/weak state');
    assert(current.nextReview <= previous.nextReview && current.nextReview <= new Date().toISOString());
    for (const [store, rows] of Object.entries(before)) {
        if (!['islandPlans', 'islandEvents', 'islands', 'profiles', 'appData', table].includes(store)) assert.deepEqual(after[store], rows, `${store} unchanged`);
    }
    for (const row of before[table]) if (row.id !== id || row.profileId !== plan.profileId) {
        assert.deepEqual(after[table].find(other => other.id === row.id && other.profileId === row.profileId), row);
    }
    assert.equal(after[table].length, before[table].length);
    const normalizeProfile = profile => {
        const copy = structuredClone(profile), field = subject === 'math' ? 'mathSkills' : 'vocabWords';
        if (copy.id !== plan.profileId) return copy;
        if (copy[field]?.[id]) copy[field][id] = withoutTiming(copy[field][id]);
        return copy;
    };
    assert.deepEqual(after.profiles.map(normalizeProfile), before.profiles.map(normalizeProfile), 'Supported finish cannot promote a profile');
    const normalizeApp = rows => rows.map(row => ({ ...row, profiles: Object.fromEntries(Object.entries(row.profiles).map(([key, value]) => [key, normalizeProfile(value)])) }));
    assert.deepEqual(normalizeApp(after.appData), normalizeApp(before.appData));
    for (const island of before.islands) {
        const next = after.islands.find(row => row.profileId === island.profileId);
        assert.deepEqual(next.items, island.items, 'Support completion does not change furniture');
        if (island.profileId !== plan.profileId) assert.deepEqual(next, island);
    }
    if (subject === 'math') assert(after.islands.find(row => row.profileId === plan.profileId).pendingMathChecks
        .some(check => check.skillId === id), 'The supported question still needs a different independent check');
    return { storesCompared: Object.keys(before).length, due: current.nextReview, strength: current.strength, correctAnswers: current.correctAnswers };
}

export async function omitLegacySupportField(page, state) {
    const before = await readSupportStores(page), { id, cursor } = state.plan;
    await page.evaluate(async ({ id, cursor }) => {
        const open = indexedDB.open('SansuDatabase');
        const d = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
        const tx = d.transaction('islandPlans', 'readwrite'), table = tx.objectStore('islandPlans'), request = table.get(id);
        request.onsuccess = () => { const plan = request.result; delete plan.slots[cursor].supportStage; table.put(plan); };
        await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); d.close();
    }, { id, cursor });
    const expected = structuredClone(before);
    delete expected.islandPlans.find(plan => plan.id === id).slots[cursor].supportStage;
    assert.deepEqual(await readSupportStores(page), expected, 'Legacy compatibility fixture removes only the optional stage; never edits receipts, answers, reservations or progress');
    return { fixture: 'legacy optional supportStage omission after a genuine UI model receipt', planId: id, cursor, allOtherStoresAndFieldsUnchanged: true };
}

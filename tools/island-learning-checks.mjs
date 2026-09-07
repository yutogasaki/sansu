import assert from 'node:assert/strict';
import { activate, button, readNative } from './island-e2e-helpers.mjs';
import { expectedLearningAnswer } from './island-learning-fixtures.mjs';

export const LEARNING_CANDIDATE = 'mystic-island-learning-v2';
export const compact = value => String(value ?? '').replace(/\s+/g, '');
const numericKeys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0'];

// An independent teaching-color oracle: inspect the real SVG element and computed
// paint, rather than accepting its echoed data-island-glyph as proof of meaning.
const teachingShapes = {
    '●': ['circle', 'circle', 'rgb(53, 71, 57)'],
    '🔴': ['circle', 'circle', 'rgb(228, 67, 67)'], '🔵': ['circle', 'circle', 'rgb(38, 139, 218)'],
    '🟡': ['circle', 'circle', 'rgb(244, 206, 57)'], '🟢': ['circle', 'circle', 'rgb(54, 169, 96)'],
    '🟠': ['circle', 'circle', 'rgb(239, 145, 52)'], '🔺': ['triangle', 'path', 'rgb(228, 67, 67)'],
    '🟥': ['square', 'rect', 'rgb(228, 67, 67)'], '🟦': ['square', 'rect', 'rgb(38, 139, 218)'],
    '🟨': ['square', 'rect', 'rgb(244, 206, 57)'], '🟩': ['square', 'rect', 'rgb(54, 169, 96)'],
    '🟧': ['square', 'rect', 'rgb(239, 145, 52)'], '🟪': ['square', 'rect', 'rgb(148, 85, 184)'],
    '⬜': ['square', 'rect', 'rgb(255, 255, 255)'],
};

async function readChoicePresentation(page) {
    return page.locator('.park-answer').evaluate(root => {
        const glyphs = surface => [...(surface?.querySelectorAll('[data-island-glyph]') ?? [])].map(node => ({
            symbol: node.getAttribute('data-island-glyph'), renderer: node.getAttribute('data-glyph-renderer'),
            label: node.getAttribute('aria-label'),
            shapes: [...node.querySelectorAll('[data-glyph-shape]')].map(shape => ({
                name: shape.getAttribute('data-glyph-shape'), element: shape.tagName.toLowerCase(), fill: getComputedStyle(shape).fill,
            })),
        }));
        const visibleMeaning = node => node.nodeType === Node.TEXT_NODE ? node.textContent
            : node instanceof Element && node.hasAttribute('data-island-glyph') ? node.getAttribute('data-island-glyph')
                : [...node.childNodes].map(visibleMeaning).join('');
        return {
            promptGlyphs: glyphs(root.querySelector('.island-problem-prompt')),
            caption: root.querySelector('[data-visual-caption]')?.textContent,
            choices: [...root.querySelectorAll('.park-choices button')].map(node => ({
                value: node.getAttribute('data-choice-value'), label: visibleMeaning(node),
                accessibleLabel: node.getAttribute('aria-label'), glyphs: glyphs(node),
            })),
        };
    });
}

/** Exported for narrow mutation checks; expected content comes only from the frozen Problem. */
export function assertReferenceChoiceMeaning(problem, rendered) {
    const visual = problem.questionVisual;
    assert.equal(visual?.kind, 'reference-choice-grid');
    const reserved = problem.inputConfig?.choices ?? [];
    // The schema explicitly separates reference and alternatives. Transfer is safe
    // only when each answer has the corresponding picture/name in the same order.
    const transferable = problem.subject === 'math' && problem.inputType === 'choice' && reserved.length > 0
        && reserved.length === visual.grid.choices.length && reserved.every((choice, index) => {
            const item = visual.grid.choices[index];
            const text = String(choice.label).trim().split(/\s+/u).join(' ');
            return text === item.emoji || text === item.label || text === `${item.emoji} ${item.label}`;
        });
    const expectedPrompt = transferable ? [visual.grid.reference] : [visual.grid.reference, ...visual.grid.choices];
    assert.deepEqual(rendered.promptGlyphs.map(glyph => glyph.symbol), expectedPrompt.map(item => item.emoji),
        transferable ? 'Only the reference remains in the prompt; answer alternatives must not be duplicated'
            : 'An unmatched saved grid retains every reference and alternative in its original order');
    assert.equal(compact(rendered.caption), compact(visual.prompt || 'おなじ ものは？'), 'Reference task wording is preserved');
    const assertGlyph = (glyph, item, where) => {
        assert.equal(glyph.symbol, item.emoji, `${where}: exact reserved symbol`);
        assert.equal(glyph.renderer, 'vector', `${where}: visible vector artwork`);
        const expected = teachingShapes[item.emoji.replace(/\uFE0F/gu, '')];
        if (expected) assert.deepEqual(glyph.shapes, [{ name: expected[0], element: expected[1], fill: expected[2] }],
            `${where}: actual geometric shape and teaching color`);
    };
    expectedPrompt.forEach((item, index) => {
        assertGlyph(rendered.promptGlyphs[index], item, `Prompt ${index + 1}`);
        assert.equal(rendered.promptGlyphs[index].label, item.label, 'Reference/example accessible identity is preserved');
    });
    assert.equal(rendered.choices.length, reserved.length, 'No answer buttons are lost or added');
    for (const [index, choice] of reserved.entries()) {
        const actual = rendered.choices[index];
        assert.equal(actual.value, choice.value, `Choice ${index + 1}: frozen answer value/order`);
        assert.equal(actual.accessibleLabel, choice.label, `Choice ${index + 1}: original accessible label`);
        const item = visual.grid.choices[index];
        const label = transferable && !choice.label.includes(item.emoji) ? `${item.emoji} ${choice.label}` : choice.label;
        assert.equal(compact(actual.label), compact(label), `Choice ${index + 1}: visible picture and original label`);
        if (transferable) {
            assert.equal(actual.glyphs.length, 1, `Choice ${index + 1}: its picture appears exactly once`);
            assertGlyph(actual.glyphs[0], item, `Choice ${index + 1}`);
        }
    }
    return transferable;
}

export async function waitLearningReady(page, plan) {
    await page.locator(`.island-page[data-learning-candidate="${LEARNING_CANDIDATE}"]`).waitFor();
    await page.waitForFunction(({ id, revision }) => {
        const root = document.querySelector('[data-island-plan-id]');
        return root?.getAttribute('data-island-plan-id') === id
            && Number(root.getAttribute('data-island-plan-revision')) === revision
            && root.getAttribute('data-input-ready') === 'true';
    }, { id: plan.id, revision: plan.revision });
}

export async function sceneState(page) {
    return page.locator('[data-testid="island-stage"]').evaluate(root => ({
        renderer: root.dataset.renderer, reactionId: root.dataset.reactionId ?? '', kind: root.dataset.reactionKind ?? '',
        phase: root.dataset.reactionPhase, target: root.dataset.reactionTarget,
        startedAt: Number(root.dataset.reactionStartedAt), settledAt: Number(root.dataset.reactionSettledAt),
        reduced: root.dataset.reactionReduced, residentReaction: root.dataset.residentReaction,
        sectionId: root.dataset.sectionId, completed: Number(root.dataset.sectionCompleted), total: Number(root.dataset.sectionTotal),
        cameraFrame: root.dataset.cameraFrame,
        residentX: Number(root.dataset.residentX), residentY: Number(root.dataset.residentY), residentZ: Number(root.dataset.residentZ),
        drawCalls: Number(root.dataset.drawCalls), observedAt: performance.now(),
    }));
}

export async function assertReaction(page, receipt, kind, completed, { reduced = false } = {}) {
    await page.waitForFunction(({ id, kind, completed }) => {
        const root = document.querySelector('[data-testid="island-stage"]');
        return root?.getAttribute('data-reaction-id') === id
            && root.getAttribute('data-reaction-kind') === kind
            && Number(root.getAttribute('data-section-completed')) === completed;
    }, { id: receipt.id, kind, completed });
    const actual = await sceneState(page);
    assert.equal(actual.reduced, String(reduced));
    if (reduced) assert.notEqual(actual.phase, 'travel', 'Reduced motion must show cause without a flight');
    return actual;
}

/** Check real hit targets in every state, including choices and support. */
export async function assertControls(page, { allowScroll = false } = {}) {
    const choices = page.locator('.park-choices button');
    const isChoice = await choices.count() > 0;
    const controls = isChoice ? await choices.all() : [
        ...numericKeys, 'こたえを けす', 'ひとつ もどす', 'しょうすうてん', 'こたえる',
    ].map(name => page.locator('.park-keypad').getByRole('button', { name, exact: true }));
    if (!isChoice) {
        controls.push(...await page.locator('.park-keypad button[aria-label^="カーソルを"]').all());
        controls.push(...await page.locator('.park-input').all());
    }
    controls.push(...await page.locator('.island-learning-actions button, .island-learning-pause').all());
    const result = [];
    for (const control of controls) {
        await control.waitFor();
        if (allowScroll) await control.scrollIntoViewIfNeeded();
        const geometry = await control.evaluate(element => {
            const rect = element.getBoundingClientRect();
            const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
            return { name: element.getAttribute('aria-label') || element.textContent.trim(), x: rect.x, y: rect.y,
                width: rect.width, height: rect.height, inViewport: rect.x >= -.5 && rect.y >= -.5
                    && rect.right <= innerWidth + .5 && rect.bottom <= innerHeight + .5,
                hit: hit === element || element.contains(hit), disabled: element.disabled };
        });
        assert(geometry.width >= 43.5 && geometry.height >= 43.5, `Minimum touch size: ${JSON.stringify(geometry)}`);
        assert(geometry.inViewport, `Input must be reachable in the viewport: ${JSON.stringify(geometry)}`);
        if (geometry.disabled) assert.equal(geometry.name, 'こたえる', 'Only the empty-answer submit may be disabled in a ready state');
        else assert(geometry.hit, `A visual layer must not intercept the actual input: ${JSON.stringify(geometry)}`);
        result.push(geometry);
    }
    if (!isChoice && !allowScroll) {
        const at = name => result.find(control => control.name === name);
        for (const row of ['789', '456', '123']) {
            const cells = [...row].map(at);
            assert(cells.every(cell => Math.abs(cell.y - cells[0].y) <= 1), `Key row ${row} is aligned`);
            assert(cells[0].x < cells[1].x && cells[1].x < cells[2].x, `Key row ${row} stays in standard order`);
        }
        assert(at('7').y < at('4').y && at('4').y < at('1').y && at('1').y < at('0').y);
        assert(Math.abs(at('0').x - at('8').x) <= 1, '0 remains in the middle column');
    }
    if (allowScroll) await page.locator('.park-answer').scrollIntoViewIfNeeded();
    return result;
}

export function assertSameControlPositions(before, after) {
    for (const prior of before) {
        const current = after.find(item => item.name === prior.name);
        assert(current, `Control ${prior.name} remains present`);
        for (const key of ['x', 'y', 'width', 'height']) assert(Math.abs(prior[key] - current[key]) <= 1,
            `${prior.name} ${key} moved for feedback: ${prior[key]} → ${current[key]}`);
    }
}

/** Verify real rendered objects against the reserved semantic content, never an echoed JSON blob. */
export async function assertProblemMeaning(page, slot) {
    const problem = slot.problem;
    assert.equal(await page.locator('.park-answer').getAttribute('data-problem-id'), problem.id);
    const visual = problem.questionVisual;
    const prompt = page.locator('.island-problem-prompt');
    const choicePresentation = problem.inputType === 'choice' || visual?.kind === 'reference-choice-grid'
        ? await readChoicePresentation(page) : undefined;
    let transferredReferenceChoices = false;
    if (visual) {
        assert.equal(await prompt.getAttribute('data-problem-visual'), visual.kind);
        const takenAway = visual.kind === 'subtraction-items' ? visual.takenAwayCount ?? visual.group.crossedOutCount ?? 0 : 0;
        const groups = visual.kind === 'number-card' ? [visual.card.supportGroup]
            : visual.kind === 'subtraction-items' ? [{ ...visual.group, crossedOutCount: 0 }, ...(takenAway > 0 ? [{ ...visual.group, count: takenAway, crossedOutCount: 0 }] : [])]
                : visual.kind === 'single-items' ? [visual.group]
                : ['addition-items', 'comparison-items', 'item-order'].includes(visual.kind) ? visual.groups
                    : visual.kind === 'sharing-items' ? [visual.source, visual.recipients] : [];
        for (let index = 0; index < groups.length; index += 1) {
            const expected = groups[index];
            const rendered = prompt.locator('[data-visual-count]').nth(index);
            assert.equal(await rendered.getAttribute('data-visual-symbol'), expected.emoji);
            assert.equal(Number(await rendered.getAttribute('data-visual-count')), expected.count);
            const items = await rendered.locator('[data-count-item]').count();
            assert.equal(items || await rendered.locator('[data-count-slot="filled"]').count(), expected.count);
            const glyphs = await rendered.locator('[data-island-glyph]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-island-glyph')));
            assert.deepEqual(glyphs, Array(expected.count).fill(expected.emoji));
            assert.equal(await rendered.locator('[data-crossed-out="true"]').count(), expected.crossedOutCount ?? 0);
        }
        if (visual.kind === 'single-items' && visual.style === 'frame') {
            assert.equal(await prompt.locator('[data-count-slot="filled"]').count(), visual.group.count);
            assert.equal(await prompt.locator('[data-count-slot="empty"]').count(), Math.max(visual.frameSize ?? visual.group.count, visual.group.count) - visual.group.count);
            assert.equal(await prompt.locator('[data-count-slot="empty"] [data-island-glyph]').count(), 0);
        }
        if (visual.kind === 'reference-choice-grid') {
            transferredReferenceChoices = assertReferenceChoiceMeaning(problem, choicePresentation);
        }
        if (['comparison-base10', 'operation-base10'].includes(visual.kind)) {
            for (let index = 0; index < visual.groups.length; index += 1) {
                const value = visual.groups[index].value;
                const rendered = prompt.locator('[data-base10-value]').nth(index);
                assert.equal(Number(await rendered.getAttribute('data-base10-value')), value);
                assert.equal(await rendered.locator('[data-base10-unit="ten"]').count(), Math.floor(value / 10));
                assert.equal(await rendered.locator('[data-base10-unit="one"]').count(), value % 10);
            }
        }
        if (visual.kind === 'operation-base10') assert.equal(await prompt.locator('[data-visual-operator]').innerText(), visual.operator);
        if (visual.kind === 'addition-items') assert.equal(await prompt.locator('[data-visual-operator]').filter({ hasText: '+' }).count(), visual.groups.length - 1);
        if (visual.kind === 'subtraction-items' && takenAway > 0) assert.equal(await prompt.locator('[data-visual-operator]').innerText(), '−');
        if (visual.kind === 'number-line') {
            const values = await prompt.locator('[data-visual-value]').evaluateAll(nodes => nodes.map(node => ({
                value: Number(node.getAttribute('data-visual-value')), hidden: node.getAttribute('data-visual-hidden') === 'true', text: node.textContent.trim(),
            })));
            assert.deepEqual(values.map(item => item.value), Array.from({ length: visual.line.max - visual.line.min + 1 }, (_, i) => visual.line.min + i));
            for (const item of values) {
                const hidden = Boolean(visual.line.hiddenValues?.includes(item.value) || (item.value === visual.line.end && visual.line.hiddenTarget));
                assert.equal(item.hidden, hidden);
                assert.equal(item.text, hidden ? '?' : String(item.value));
            }
        }
        const meaningSurface = transferredReferenceChoices ? page.locator('.island-problem-prompt, .park-choices') : prompt;
        const literals = await meaningSurface.locator('[data-glyph-renderer="literal"]').allTextContents();
        assert.deepEqual(literals, [], 'Selected normal curriculum examples use explicit vector art, not platform emoji');
        const clipped = await meaningSurface.locator('[data-count-item], [data-count-slot], [data-base10-unit], [data-island-glyph]').evaluateAll(nodes => nodes.flatMap(node => {
            const rect = node.getBoundingClientRect();
            let visible = rect.width > 0 && rect.height > 0 && rect.left >= -.5 && rect.top >= -.5
                && rect.right <= innerWidth + .5 && rect.bottom <= innerHeight + .5;
            for (let ancestor = node.parentElement; visible && ancestor; ancestor = ancestor.parentElement) {
                const style = getComputedStyle(ancestor);
                const bounds = ancestor.getBoundingClientRect();
                if (['hidden', 'clip', 'scroll', 'auto'].includes(style.overflowX)) visible &&= rect.left >= bounds.left - .5 && rect.right <= bounds.right + .5;
                if (['hidden', 'clip', 'scroll', 'auto'].includes(style.overflowY)) visible &&= rect.top >= bounds.top - .5 && rect.bottom <= bounds.bottom + .5;
            }
            return visible ? [] : [{ symbol: node.getAttribute('data-island-glyph'), x: rect.x, y: rect.y, width: rect.width, height: rect.height }];
        }));
        assert.deepEqual(clipped, [], 'All counted objects and empty-frame positions remain visibly available');
    } else if ((await page.locator('.park-answer').getAttribute('data-input-type')) !== 'hissan') {
        const expected = compact(problem.questionText).replaceAll('/', '');
        assert(compact(await page.locator('.park-question').innerText()).replaceAll('/', '').includes(expected), 'Visible question retains operands, word and operator');
    }
    if (problem.inputType === 'choice') {
        const rendered = choicePresentation.choices;
        assert.deepEqual(rendered.map(choice => choice.value), problem.inputConfig.choices.map(choice => choice.value));
        for (let index = 0; index < rendered.length; index += 1) {
            const original = problem.inputConfig.choices[index].label;
            assert.equal(rendered[index].accessibleLabel, original, 'Answer accessibility retains the reserved label');
            const item = transferredReferenceChoices ? visual.grid.choices[index] : undefined;
            const expected = item && !original.includes(item.emoji) ? `${item.emoji} ${original}` : original;
            assert(compact(rendered[index].label) === compact(expected),
                `Choice ${index + 1} visibly retains the original meaning ${expected}`);
        }
    } else if (problem.inputType === 'multi-number') {
        assert.equal(await page.locator('.park-input').count(), problem.inputConfig.fields.length);
        for (const [index, field] of problem.inputConfig.fields.entries()) if (field.label) {
            assert.equal(await page.locator('.park-input').nth(index).getAttribute('aria-label'), field.label);
        }
    }
    return { problemId: problem.id, skill: problem.categoryId, visualKind: visual?.kind ?? 'text', inputType: problem.inputType };
}

export async function expectedAnswer(page, slot) {
    return expectedLearningAnswer(slot, await page.locator('.park-answer').getAttribute('data-input-type'));
}

async function prepareAnswer(page, slot, { wrong, touch }) {
    const expected = await expectedAnswer(page, slot);
    const type = await page.locator('.park-answer').getAttribute('data-input-type');
    if (type === 'choice') {
        const choice = slot.problem.inputConfig.choices.find(choice => wrong ? choice.value !== expected.values : choice.value === expected.values);
        assert(choice);
        return { expected, choice };
    }
    const values = Array.isArray(expected.values) ? expected.values : [expected.values];
    const entered = wrong ? values.map(value => String(value) === '9' ? '8' : '9') : values;
    for (let index = 0; index < entered.length; index += 1) {
        if (type !== 'hissan') await activate(page.locator('.park-input').nth(index), touch);
        for (const digit of String(entered[index])) {
            if (touch) await activate(page.locator('.park-keypad').getByRole('button', { name: digit === '.' ? 'しょうすうてん' : digit, exact: true }), true);
            else await page.keyboard.type(digit);
        }
        if (type !== 'hissan') assert.equal((await page.locator('.park-input span').nth(index).innerText()).trim(), String(entered[index]), 'Every intended digit must reach its active field before submit');
    }
    return { expected, control: page.locator('.park-answer .park-keypad [data-keypad-submit]') };
}

/** Timing starts in the real UI event and ends on the exact next saved, operable revision. */
export async function attempt(page, before, { wrong = false, touch = false, double = false, keyboardDouble = false, onOperable, onCorrectContact } = {}) {
    const plan = before.plan;
    const slot = plan.slots[plan.cursor];
    await waitLearningReady(page, plan);
    const prepared = await prepareAnswer(page, slot, { wrong, touch });
    const choiceIndex = prepared.choice ? slot.problem.inputConfig.choices.indexOf(prepared.choice) : -1;
    const submit = choiceIndex >= 0 ? page.locator('.park-choices button').nth(choiceIndex) : prepared.control;
    assert(!keyboardDouble || choiceIndex < 0, 'Physical Enter double-submit is exercised on numeric input');
    await page.evaluate(({ id, revision, keyboardDouble }) => {
        window.__islandFocusedTiming = undefined;
        const eventType = keyboardDouble ? 'keydown' : 'click';
        const onSubmit = event => {
            if (keyboardDouble && event.key !== 'Enter') return;
            document.removeEventListener(eventType, onSubmit, true);
            const started = performance.now();
            const tick = () => {
                const root = document.querySelector('[data-island-plan-id]');
                const terminal = document.querySelector('.island-page')?.getAttribute('data-mode') === 'reward';
                const ready = root?.getAttribute('data-island-plan-id') === id
                    && Number(root.getAttribute('data-island-plan-revision')) === revision + 1
                    && root.getAttribute('data-input-ready') === 'true';
                if (terminal || ready) window.__islandFocusedTiming = { ms: performance.now() - started, terminal, endedAt: performance.now() };
                else requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        };
        document.addEventListener(eventType, onSubmit, true);
    }, { id: plan.id, revision: plan.revision, keyboardDouble });
    const expectedReceipt = { id: JSON.stringify(['island-action-v1', plan.profileId, plan.id, plan.revision]) };
    const completed = !wrong && prepared.expected.final;
    let contactObservation;
    if (completed && onCorrectContact) {
        // Arm before the real gesture. These are actual renderer-written attributes,
        // sampled in the browser; later IndexedDB reads cannot miss a short phase.
        await page.evaluate(id => {
            window.__islandFocusedReactionFrames = [];
            const expiresAt = performance.now() + 15000;
            const tick = () => {
                const stage = document.querySelector('[data-testid="island-stage"]');
                if (stage?.getAttribute('data-reaction-id') === id) {
                    const frame = { id, kind: stage.dataset.reactionKind, phase: stage.dataset.reactionPhase,
                        residentReaction: stage.dataset.residentReaction, target: stage.dataset.reactionTarget,
                        completed: Number(stage.dataset.sectionCompleted), observedAt: performance.now() };
                    window.__islandFocusedReactionFrames.push(frame);
                    if (frame.phase === 'settled') return;
                }
                if (performance.now() < expiresAt) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        }, expectedReceipt.id);
        contactObservation = page.waitForFunction(id => {
            const stage = document.querySelector('[data-testid="island-stage"]');
            return stage?.getAttribute('data-reaction-id') === id && stage.dataset.reactionKind === 'correct'
                && stage.dataset.reactionPhase === 'contact' && stage.dataset.residentReaction === 'delight';
        }, expectedReceipt.id).then(async () => {
            const frame = await sceneState(page);
            assert.equal(frame.reactionId, expectedReceipt.id);
            assert.equal(frame.phase, 'contact');
            assert.equal(frame.residentReaction, 'delight');
            assert(frame.target, 'The actual contact frame names its world target');
            await onCorrectContact(expectedReceipt, frame);
            return frame;
        });
        // Observe early rejection while the independent real gesture is in progress.
        // The original rejection is still propagated by the await below.
        contactObservation.catch(() => {});
    }
    if (keyboardDouble) {
        await page.keyboard.down('Enter');
        await page.keyboard.down('Enter');
        await page.keyboard.up('Enter');
        await page.keyboard.press('Enter');
    } else if (double) await submit.dblclick({ delay: 0 });
    else await activate(submit, touch);
    await page.waitForFunction(() => Boolean(window.__islandFocusedTiming));
    const timing = await page.evaluate(() => window.__islandFocusedTiming);
    if (completed && onOperable) await onOperable(expectedReceipt);
    const contactFrame = contactObservation ? await contactObservation : undefined;
    const reactionFrames = contactObservation ? await page.evaluate(() => window.__islandFocusedReactionFrames) : undefined;
    if (contactFrame) assert(reactionFrames.some(frame => frame.id === expectedReceipt.id && frame.phase === 'contact'
        && frame.residentReaction === 'delight'), 'The prearmed observer saw an actual drawn contact/reply frame');
    const after = await readNative(page, plan.profileId);
    const saved = after.islandPlans.find(candidate => candidate.id === plan.id);
    assert.equal(saved.revision, plan.revision + 1, 'One submit gesture creates exactly one revision');
    assert.deepEqual(saved.slots.map(slot => slot.problem), plan.slots.map(slot => slot.problem), 'All reserved Problems remain byte-for-byte unchanged');
    const receipts = after.islandEvents.filter(event => !before.islandEvents.some(previous => previous.id === event.id) && event.type === 'answer');
    assert.equal(receipts.length, 1, 'Even a double submit persists one answer receipt');
    assert.equal(receipts[0].id, JSON.stringify(['island-action-v1', plan.profileId, plan.id, plan.revision]));
    assert.equal(saved.cursor, plan.cursor + Number(completed), 'Only a completed correct problem advances one slot');
    if (prepared.expected.step) {
        const savedSlot = saved.slots[plan.cursor];
        assert.equal(savedSlot.hissanStep ?? 0, (slot.hissanStep ?? 0) + Number(!wrong));
        if (wrong) assert.deepEqual(savedSlot.hissanValues, slot.hissanValues, 'A wrong row changes none of the solved Hissan cells');
        else for (const [index, column] of prepared.expected.step.columns.entries()) {
            assert.equal(savedSlot.hissanValues[`${prepared.expected.step.row}-${column}`], prepared.expected.values[index]);
        }
    }
    if (!timing.terminal && (await page.locator('.park-input span').count())) {
        assert((await page.locator('.park-input span').allTextContents()).every(value => ['', '□'].includes(value.trim())), 'No previous digits leak into the next revision');
    }
    return { after, saved, receipt: receipts[0], contactFrame, reactionFrames, sample: { ...timing, wrong, completed, double, keyboardDouble, inputType: slot.problem.inputType } };
}

export async function assertInputFidelity(page, before) {
    assert.equal(await page.locator('.park-answer').getAttribute('data-input-type'), 'number');
    await page.keyboard.down('1');
    await page.keyboard.down('1');
    await page.keyboard.up('1');
    assert.equal((await page.locator('.park-input span').innerText()).trim(), '1', 'Held key autorepeat does not type an extra digit');
    await button(page, 'こたえを けす').click();
    await page.keyboard.type('11');
    assert.equal((await page.locator('.park-input span').innerText()).trim(), '11', 'Two intentional identical digits remain valid input');
    await page.keyboard.press('Backspace');
    assert.equal((await page.locator('.park-input span').innerText()).trim(), '1');
    await button(page, 'こたえを けす').click();
    await page.locator('.park-keypad').getByRole('button', { name: '1', exact: true }).dblclick();
    assert.equal((await page.locator('.park-input span').innerText()).trim(), '11', 'Two intentional taps retain both digits');
    await button(page, 'こたえを けす').click();
    const after = await readNative(page, before.plan.profileId);
    assert.deepEqual(after.plan, before.plan, 'Typing/editing never writes an answer or advances the plan');
    assert.deepEqual(after.islandEvents, before.islandEvents);
}

export async function typeDuringCue(page, receipt) {
    await page.waitForFunction(id => {
        const scene = document.querySelector('[data-testid="island-stage"]');
        return scene?.getAttribute('data-reaction-id') === id && scene.getAttribute('data-reaction-kind') === 'correct'
            && scene.getAttribute('data-reaction-phase') !== 'settled'
            && document.querySelector('[data-island-plan-id]')?.getAttribute('data-input-ready') === 'true';
    }, receipt.id);
    const before = await sceneState(page);
    assert.equal(before.reactionId, receipt.id);
    assert.equal(before.kind, 'correct');
    assert.notEqual(before.phase, 'settled', 'The next input must be ready while the actual reaction is active');
    await page.keyboard.type('1');
    assert.equal((await page.locator('.park-input span').first().innerText()).trim(), '1', 'The first next-question digit is accepted during the cue');
    const after = await sceneState(page);
    await button(page, 'こたえを けす').click();
    return { before, after, accepted: true };
}

export async function assertFieldNavigation(page, before) {
    const fields = page.locator('.park-input');
    assert(await fields.count() > 1);
    await fields.first().click();
    await page.keyboard.type('1');
    await button(page, 'カーソルを みぎへ').click();
    await page.keyboard.type('2');
    const values = async () => (await page.locator('.park-input span').allTextContents()).map(value => value.trim());
    assert.deepEqual((await values()).slice(0, 2), ['1', '2'], 'Cursor navigation selects the intended field');
    await page.keyboard.press('Backspace');
    assert.deepEqual((await values()).slice(0, 2), ['1', '□'], 'Delete affects only the active field');
    await button(page, 'こたえを けす').click();
    assert((await values()).every(value => value === '□'), 'Clear resets every editable field');
    assert.equal(await fields.first().getAttribute('aria-pressed'), 'true', 'Island Clear returns to the first field');
    const after = await readNative(page, before.plan.profileId);
    assert.deepEqual(after.plan, before.plan);
    assert.deepEqual(after.islandEvents, before.islandEvents);
}

export async function assertHissanPartialInput(page, before) {
    const expected = await expectedAnswer(page, before.plan.slots[before.plan.cursor]);
    assert(expected.step && expected.values.length > 1, 'This real Hissan row has multiple editable digits');
    const sceneBefore = await sceneState(page);
    await page.keyboard.type(expected.values[0]);
    assert.equal(await button(page, 'こたえる').isEnabled(), false, 'Incomplete digits cannot submit a Hissan row');
    await page.keyboard.press('Enter');
    const after = await readNative(page, before.plan.profileId);
    assert.deepEqual(after.plan, before.plan, 'An incomplete row writes no result');
    assert.deepEqual(after.islandEvents, before.islandEvents);
    const sceneAfter = await sceneState(page);
    assert.equal(sceneAfter.reactionId, sceneBefore.reactionId);
    assert.equal(sceneAfter.completed, sceneBefore.completed);
    await button(page, 'こたえを けす').click();
    return { realGridSteps: expected.totalSteps, partialDigitsPersisted: false, partialDigitsEarnedLight: false,
        clearFollowedBy: 'The next attempt types the full row from its first digit, without a cursor-reset action.',
        scope: expected.totalSteps === 1 ? 'Current engine generates one result row. Incomplete-digit and final-row UI are exercised; hypothetical multi-row receipt classification is unit coverage only.' : 'Actual multi-row Hissan grid.' };
}

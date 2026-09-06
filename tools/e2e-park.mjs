import { chromium } from 'playwright';
import { promises as fs } from 'node:fs';
import assert from 'node:assert/strict';

const base = process.env.SANSU_PARK_BASE_URL || 'http://127.0.0.1:5187';
const out = process.env.SANSU_PARK_OUTPUT || 'output/playwright/park';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch(process.env.SANSU_PARK_BROWSER_GPU === 'metal' ? { headless: true, args: ['--use-angle=metal'] } : {});
const report = { target: base, flag: 'VITE_BUILD_PLAY_ENABLED=true', candidate: process.env.SANSU_PARK_CANDIDATE || 'park-resin-blender-v1', scenarios: [] };

async function seed(page, skill, subject = 'math') {
    return page.evaluate(async ({ skill, subject }) => {
        const { db } = await import('/src/db/index.ts');
        const { createInitialProfile } = await import('/src/domain/user/profile.ts');
        const { saveProfile, setActiveProfileId } = await import('/src/domain/user/repository.ts');
        const { getLevelForSkill } = await import('/src/domain/math/curriculum.ts');
        const profile = createInitialProfile('つむぎ', 2, Math.max(0, (getLevelForSkill(skill) || 1) - 1), 1, subject);
        profile.soundEnabled = false;
        await saveProfile(profile); await setActiveProfileId(profile.id);
        if (subject === 'math') await db.memoryMath.put({ profileId: profile.id, id: skill, strength: 2,
            nextReview: '2000-01-01', updatedAt: '2000-01-01', totalAnswers: 10, correctAnswers: 8, incorrectAnswers: 2, skippedAnswers: 0, status: 'active' });
        return profile.id;
    }, { skill, subject });
}
const read = (page, id) => page.evaluate(async id => {
    const { db } = await import('/src/db/index.ts');
    const park = await db.parks.get(id);
    const plan = park?.pendingPlanId ? await db.parkPlans.get(park.pendingPlanId) : undefined;
    return { park, plan, logs: await db.logs.where('profileId').equals(id).toArray(), events: await db.parkEvents.where('profileId').equals(id).toArray() };
}, id);
const capture = async (page, name) => {
    await page.screenshot({ path: `${out}/${name}.png`, animations: 'disabled' });
};
async function uiAnswer(page, plan, incorrect = false) {
    const slot = plan.slots[plan.cursor];
    const answer = await page.evaluate(async slot => {
        const { parkHissanGrid } = await import('/src/domain/park/learning.ts');
        const grid = parkHissanGrid(slot.problem);
        return grid ? grid.steps[slot.hissanStep || 0].correctValues : slot.problem.correctAnswer;
    }, slot);
    if (slot.problem.inputType === 'choice') {
        const choice = slot.problem.inputConfig.choices.find(c => incorrect ? c.value !== answer : c.value === answer);
        await page.locator('.park-choices').getByRole('button', { name: choice.label, exact: true }).click();
    } else if (await page.locator('[data-input-type="hissan"]').count()) {
        await page.keyboard.type((incorrect ? answer.map(() => '9') : answer).join(''), { delay: 40 });
        await page.getByRole('button', { name: 'こたえる', exact: true }).click();
    } else {
        const values = Array.isArray(answer) ? answer : [answer];
        for (let i = 0; i < values.length; i++) {
            await page.locator('.park-input').nth(i).click();
            await page.keyboard.type(incorrect ? '99999' : values[i], { delay: 40 });
        }
        await page.getByRole('button', { name: 'こたえる', exact: true }).click();
    }
    await page.waitForFunction(async ({ id, revision }) => {
        const { db } = await import('/src/db/index.ts');
        return (await db.parkPlans.get(id))?.revision > revision;
    }, { id: plan.id, revision: plan.revision });
}

try {
    for (const scenario of [
        { name: 'phone', width: 390, height: 844, skill: 'add_1d_1', full: true },
        { name: 'tablet-multi', width: 768, height: 1024, skill: 'frac_add_same' },
        { name: 'phone-choice', width: 390, height: 844, skill: 'compare_2d' },
        { name: 'phone-hissan', width: 390, height: 844, skill: 'add_2d1d_hissan_c' },
        { name: 'phone-vocab', width: 390, height: 844, skill: '', subject: 'vocab' },
        { name: 'tablet-reduced', width: 768, height: 1024, skill: 'add_1d_1', reduced: true },
    ]) {
        const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height }, reducedMotion: scenario.reduced ? 'reduce' : 'no-preference' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(e.stack));
        page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
        await page.goto(`${base}/#/park`);
        await page.waitForURL('**/#/onboarding');
        const id = await seed(page, scenario.skill, scenario.subject);
        await page.goto(`${base}/#/`);
        await page.locator('[data-game-id="build-play-v1"]').waitFor();
        assert.equal(await page.locator('[data-game-id]').getAttribute('data-visual-candidate-id'), report.candidate);
        await page.waitForFunction(() => [...document.querySelectorAll('svg image')].every(image => {
            const loaded = new Image(); loaded.src = image.getAttribute('href'); return loaded.complete && loaded.naturalWidth > 0;
        }));
        assert.equal(new URL(page.url()).hash, '#/park');
        await capture(page, `${scenario.name}-ready`);
        const revision = await page.locator('[data-game-id]').getAttribute('data-build-revision');
        if (scenario.full || scenario.reduced) {
            await page.getByRole('button', { name: '▷ あそばせる', exact: true }).click();
            await page.getByRole('button', { name: '▷ もういっかい', exact: true }).waitFor({ timeout: 15000 });
            assert.equal((await read(page, id)).logs.length, 0);
        }
        await page.getByRole('button', { name: 'つくる', exact: true }).click();
        await capture(page, `${scenario.name}-workshop`);
        await page.getByRole('button', { name: 'シャボンゲートを つくる', exact: true }).click();
        await page.locator('.park-answer').waitFor();
        await capture(page, `${scenario.name}-learning`);
        let state = await read(page, id);
        if (scenario.skill) assert.equal(state.plan.slots[0].problem.categoryId, scenario.skill);
        if (scenario.full) {
            const original = state.plan.slots.map(s => s.problem);
            await uiAnswer(page, state.plan, true);
            state = await read(page, id);
            assert.equal(state.plan.cursor, 0);
            assert.equal(state.logs[0].result, 'incorrect');
            await page.getByRole('button', { name: 'ひとやすみ', exact: true }).click();
            await page.reload();
            await page.getByRole('button', { name: 'つづきから', exact: true }).click();
            state = await read(page, id);
            assert.deepEqual(state.plan.slots.map(s => s.problem), original);
            await page.getByRole('button', { name: 'いっしょに みる', exact: true }).click();
            await page.locator('.park-support strong').waitFor();
            await page.reload();
            await page.getByRole('button', { name: 'つづきから', exact: true }).click();
            await page.locator('.park-support strong').waitFor();
            await capture(page, 'phone-support');
        }
        let attempts = 0;
        while ((state = await read(page, id)).plan) {
            if (++attempts > 40) throw new Error('Plan did not finish');
            await uiAnswer(page, state.plan);
        }
        assert.equal(state.park.parts.length, 3);
        assert.equal(state.events.filter(e => e.type === 'plan_completed').length, 1);
        await capture(page, `${scenario.name}-created`);
        if (scenario.full) {
            await page.locator('.park-inventory').getByRole('button').filter({ hasText: 'シャボンゲート' }).click();
            await page.getByRole('button', { name: 'ばしょ 3 あき', exact: true }).click();
            await page.getByRole('button', { name: '▷ あそばせる', exact: true }).click();
            await page.locator('[data-toy-action="jump"]').waitFor({ timeout: 12000 });
            await capture(page, 'phone-jump-over-gate');
            await page.getByRole('button', { name: '▷ もういっかい', exact: true }).waitFor({ timeout: 15000 });
            await page.getByRole('button', { name: 'ならべかえる', exact: true }).click();
            await page.getByRole('button', { name: 'ばしょ 3 シャボンゲート', exact: true }).click();
            await page.getByRole('button', { name: 'ばしょ 2 トランポリン', exact: true }).click();
            await page.getByRole('button', { name: '▷ あそばせる', exact: true }).click();
            await page.locator('[data-toy-action="jump"][data-bubble-popped="false"]').waitFor({ timeout: 14000 });
            const pop = page.locator('[data-toy-action="jump"][data-bubble-popped="true"]').waitFor();
            await page.waitForTimeout(300);
            await capture(page, 'phone-bubble-jump');
            await pop;
            await capture(page, 'phone-bubble-pop');
            await page.getByRole('button', { name: '▷ もういっかい', exact: true }).waitFor({ timeout: 15000 });
            const beforeReload = (await read(page, id)).park;
            await page.reload();
            await page.locator('[data-game-id]').waitFor();
            assert.deepEqual((await read(page, id)).park, beforeReload);
            const otherId = await seed(page, 'count_10');
            await page.reload();
            await page.locator('[data-game-id]').waitFor();
            const other = await read(page, otherId);
            assert.equal(other.park.parts.length, 2);
            assert.equal(other.logs.length, 0);
            assert.deepEqual((await read(page, id)).park, beforeReload);
            await page.evaluate(async id => {
                const { setActiveProfileId } = await import('/src/domain/user/repository.ts');
                await setActiveProfileId(id);
            }, id);
            await page.reload();
            await page.locator('[data-game-id]').waitFor();
            await page.locator('.park-courses').getByRole('button', { name: '＋', exact: true }).click();
            await page.locator('.park-inventory').getByRole('button').filter({ hasText: 'すべりだい' }).click();
            await page.getByRole('button', { name: 'ばしょ 1 あき', exact: true }).click();
            await page.getByRole('button', { name: 'ここへ うつす', exact: true }).waitFor();
            assert.equal((await read(page, id)).park.courses[0].slots[0], 'starter-slide');
            await page.getByRole('button', { name: 'ここへ うつす', exact: true }).click();
            await page.waitForFunction(async id => {
                const { db } = await import('/src/db/index.ts');
                return (await db.parks.get(id)).courses[1].slots[0] === 'starter-slide';
            }, id);
            assert.equal((await read(page, id)).park.courses[0].slots[0], null);
            for (let i = 0; i < 3; i++) {
                await page.getByRole('button', { name: '＋ ばしょを ふやす', exact: true }).click();
                await page.waitForFunction(count => document.querySelectorAll('.park-slot').length === count, i + 4);
            }
            await capture(page, 'phone-six-positions');
            await page.getByRole('button', { name: 'ならべおわり', exact: true }).click();
            await page.getByRole('button', { name: 'つくる', exact: true }).click();
            await page.getByRole('button', { name: 'ゆっくりマットを つくる', exact: true }).click();
            await page.locator('.park-answer').waitFor();
            const pending = (await read(page, id)).plan;
            await page.getByRole('button', { name: 'このもんだいは あとで', exact: true }).click();
            await page.getByRole('button', { name: 'つづきから', exact: true }).waitFor();
            await page.reload();
            await page.getByRole('button', { name: 'つづきから', exact: true }).click();
            assert.deepEqual((await read(page, id)).plan.slots.map(s => s.problem), pending.slots.map(s => s.problem));
        }
        assert.equal(await page.locator('vite-error-overlay').count(), 0);
        assert.deepEqual(errors, []);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        assert.equal(overflow, false);
        report.scenarios.push({ ...scenario, revision, passed: true, logs: state.logs.length });
        console.log(`PASS ${scenario.name}`);
        await context.close();
    }
    await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
} finally { await browser.close(); }

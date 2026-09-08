import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { seedLearningProfile } from './island-learning-fixtures.mjs';
import { answerUI, assertKeypad, readNative, runtimeMetadata } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_ISLAND_PRODUCTION_URL || 'http://127.0.0.1:5198';
const out = process.env.SANSU_SOUND_CONTROL_OUTPUT || 'output/playwright/island-sound-control';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--autoplay-policy=document-user-activation-required'] });
const report = { target: base, evidence: 'Disposable profile; real UI and digital audio. Suspended resume and aborted settings writes are explicit fault diagnostics. No physical-speaker claim.', runs: [], pass: false };

async function instrument(page) {
    await page.addInitScript(() => {
        const qa = window.__soundQA = { peak: 0, starts: [], resumeGestures: [], blockResume: false, abortSave: false, writes: 0, context: null };
        const connect = AudioNode.prototype.connect;
        AudioNode.prototype.connect = function (destination, ...args) {
            const result = connect.call(this, destination, ...args);
            if (destination === this.context.destination) {
                qa.context = this.context;
                const analyser = this.context.createAnalyser(), silent = this.context.createGain();
                silent.gain.value = 0;
                connect.call(this, analyser); connect.call(analyser, silent); connect.call(silent, destination);
                const samples = new Float32Array(analyser.fftSize);
                const sample = () => {
                    analyser.getFloatTimeDomainData(samples);
                    for (const value of samples) qa.peak = Math.max(qa.peak, Math.abs(value));
                    requestAnimationFrame(sample);
                };
                requestAnimationFrame(sample);
            }
            return result;
        };
        const resume = AudioContext.prototype.resume;
        qa.nativeResume = context => resume.call(context);
        AudioContext.prototype.resume = function () {
            qa.resumeGestures.push({ active: navigator.userActivation.isActive, blocked: qa.blockResume });
            return qa.blockResume ? new Promise(() => {}) : resume.call(this);
        };
        const start = AudioBufferSourceNode.prototype.start;
        AudioBufferSourceNode.prototype.start = function (...args) {
            if (this.buffer?.duration > .01) qa.starts.push(this.buffer.duration);
            return start.apply(this, args);
        };
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (...args) {
            if (this.name === 'appData') {
                qa.writes++;
                if (qa.abortSave) { qa.abortSave = false; this.transaction.abort(); }
            }
            return put.apply(this, args);
        };
    });
}
async function profile(page, id) {
    return page.evaluate(async id => {
        const open = indexedDB.open('SansuDatabase');
        const d = await new Promise(resolve => { open.onsuccess = () => resolve(open.result); });
        const read = name => new Promise(resolve => {
            const request = d.transaction(name).objectStore(name).get(name === 'appData' ? 'app' : id);
            request.onsuccess = () => resolve(request.result);
        });
        const app = await read('appData'), mirror = await read('profiles'); d.close();
        return { saved: app.profiles[id], mirror };
    }, id);
}
async function resetAudio(page) {
    await page.waitForTimeout(650);
    await page.evaluate(() => { window.__soundQA.peak = 0; window.__soundQA.starts = []; window.__soundQA.resumeGestures = []; });
}
async function audible(page, row, step) {
    try { await page.waitForFunction(() => window.__soundQA.peak > .005); }
    catch (error) {
        row.audio.push({ step, failed: true, ...await page.evaluate(() => ({ peak: window.__soundQA.peak, starts: window.__soundQA.starts,
            resumeGestures: window.__soundQA.resumeGestures, state: window.__soundQA.context?.state, visibility: document.visibilityState })) });
        throw error;
    }
    row.audio.push({ step, ...await page.evaluate(() => ({ peak: window.__soundQA.peak, starts: window.__soundQA.starts, resumeGestures: window.__soundQA.resumeGestures })) });
}
async function capture(page, row, state) {
    const file = `${row.name}-${state}.png`;
    await page.screenshot({ path: `${out}/${file}`, animations: 'disabled' });
    row.captures.push({ state, file, ...await runtimeMetadata(page) });
}

try {
    for (const viewport of [{ name: 'phone', width: 390, height: 844 }, { name: 'tablet', width: 768, height: 1024 }]) {
        const row = { name: viewport.name, audio: [], captures: [], checks: [], pass: false }; report.runs.push(row);
        const context = await browser.newContext({ viewport, hasTouch: true, serviceWorkers: 'block' });
        const page = await context.newPage(); page.setDefaultTimeout(15000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        try {
            await instrument(page);
            await page.goto(`${base}/#/island`);
            await page.getByRole('button', { name: 'まなぶ', exact: true }).waitFor();
            const id = await seedLearningProfile(page, { subject: 'math', skill: 'add_1d_1', type: 'number' });
            await page.reload();
            const control = page.locator('.island-sound-button');
            await control.getByText('おとを だす').waitFor();
            const bounds = await control.boundingBox(); assert(bounds.width >= 44 && bounds.height >= 44);
            await capture(page, row, 'home-off');
            await resetAudio(page); await control.tap();
            await page.locator('.island-sound-button[data-sound-state=ready]:enabled').waitFor();
            await audible(page, row, 'explicit-enable');
            assert.equal((await profile(page, id)).saved.soundEnabled, true);
            await page.locator('.island-start').tap(); await page.locator('[data-input-ready=true]').waitFor();
            await assertKeypad(page);
            await page.getByRole('button', { name: '9', exact: true }).tap();
            const draft = await page.locator('.park-inputs').innerText(), before = await readNative(page, id), original = await profile(page, id);
            await control.focus(); await page.keyboard.press('Enter');
            await page.locator('.island-sound-button[data-sound-state=off]:enabled').waitFor();
            const muted = await profile(page, id);
            assert.deepEqual(muted.saved, { ...original.saved, soundEnabled: false }); assert.deepEqual(muted.saved, muted.mirror);
            assert.deepEqual(await readNative(page, id), before); assert.equal(await page.locator('.park-inputs').innerText(), draft);
            await capture(page, row, 'learning-off');
            await resetAudio(page); await control.tap(); await audible(page, row, 'learning-enable');
            await page.locator('.island-sound-button[data-sound-state=ready]:enabled').waitFor();
            assert.deepEqual(await readNative(page, id), before); assert.equal(await page.locator('.park-inputs').innerText(), draft);
            row.checks.push('Touch enable and keyboard mute preserve all learning records, both profile mirrors and the draft');

            await resetAudio(page);
            await page.evaluate(async () => { window.__soundQA.blockResume = true; await window.__soundQA.context.suspend(); });
            await page.locator('.island-sound-button[data-sound-state=blocked]:enabled').waitFor();
            const writes = await page.evaluate(() => window.__soundQA.writes);
            await control.tap();
            await page.getByText('もういちど おしてね', { exact: true }).waitFor();
            await page.locator('.island-sound-button[data-sound-state=blocked]:enabled').waitFor();
            assert.equal(await page.evaluate(() => window.__soundQA.writes), writes, 'Resume alone never saves a profile');
            assert.equal(await page.evaluate(() => window.__soundQA.peak), 0);
            assert.equal((await profile(page, id)).saved.soundEnabled, true);
            await capture(page, row, 'resume-refused');
            await page.evaluate(() => { window.__soundQA.blockResume = false; });
            await resetAudio(page); await control.tap(); await audible(page, row, 'resume-retry');
            await page.locator('.island-sound-button[data-sound-state=ready]:enabled').waitFor();
            assert(await page.evaluate(() => window.__soundQA.resumeGestures.some(event => event.active && !event.blocked)));
            assert.deepEqual(await readNative(page, id), before);
            row.checks.push('Explicit unresolved-resume diagnostic times out, stays retryable and recovers on an active gesture');

            // A first gesture may auto-resume audio before its click is dispatched.
            await resetAudio(page); await page.evaluate(() => window.__soundQA.context.suspend());
            await page.locator('.island-sound-button[data-sound-state=blocked]').waitFor();
            const box = await control.boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
            await page.evaluate(() => window.__soundQA.nativeResume(window.__soundQA.context));
            await page.locator('.island-sound-button[data-sound-state=ready]').waitFor();
            await page.mouse.up(); await audible(page, row, 'gesture-state-race');
            await page.locator('.island-sound-button[data-sound-state=ready]:enabled').waitFor();
            assert.equal((await profile(page, id)).saved.soundEnabled, true);
            row.checks.push('The enable gesture cannot accidentally mute when auto-resume changes state before click');

            await control.tap(); await page.locator('.island-sound-button[data-sound-state=off]:enabled').waitFor();
            await page.evaluate(() => { window.__soundQA.abortSave = true; }); await control.tap();
            await page.getByText('せっていを のこせなかったよ。もういちど おしてね', { exact: true }).waitFor();
            await page.locator('.island-sound-button[data-sound-state=off]:enabled').waitFor();
            assert.equal((await profile(page, id)).saved.soundEnabled, false); assert.deepEqual(await readNative(page, id), before);
            assert.equal(await page.locator('.park-inputs').innerText(), draft);
            await control.tap(); await page.locator('.island-sound-button[data-sound-state=ready]:enabled').waitFor();
            row.checks.push('Injected settings transaction abort restores mute and preserves the draft; retry saves successfully');
            await page.getByRole('button', { name: 'こたえを けす', exact: true }).tap();
            await resetAudio(page); await answerUI(page, before.plan, { touch: true, dev: false });
            await audible(page, row, 'correct-answer'); await capture(page, row, 'correct'); await assertKeypad(page);
            const after = await readNative(page, id);
            await page.reload(); await page.locator('[data-input-ready=true]').waitFor();
            assert.deepEqual(await readNative(page, id), after); assert.equal((await profile(page, id)).saved.soundEnabled, true);
            await control.tap(); // If the new document is suspended this resumes it; if ready this mutes it.
            await control.locator('span').waitFor();
            row.checks.push('Reload preserves the sound preference and the same reserved learning question');
            assert.deepEqual(errors, []); row.pass = true; console.log(`PASS ${row.name}: ${row.checks.length} checks`);
        } catch (error) { row.error = error.stack; throw error; }
        finally { await context.close(); }
    }
    report.pass = true;
} finally { await browser.close(); await writeFile(`${out}/report.json`, `${JSON.stringify(report, null, 2)}\n`); }

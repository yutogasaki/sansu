import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { seedLearningProfile } from './island-learning-fixtures.mjs';
import { answerUI, readNative, runtimeMetadata } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_ISLAND_PRODUCTION_URL || 'http://127.0.0.1:5198';
const out = process.env.SANSU_FEEDBACK_OUTPUT || 'output/playwright/island-feedback';
await mkdir(out, { recursive: true });
const browser = await chromium.launch(process.env.SANSU_AUDIO_NATIVE_SPEECH === '1' ? { channel: 'chrome', headless: false } : {});
const report = { target: base, evidence: 'Disposable native profile fixtures; real answers, audio buffers/output and native speech events. Fault injection is labelled separately. No physical speaker or child observation claim.', runs: [], pass: false };

async function instrument(page, speechFault = false) {
    await page.addInitScript(({ speechFault }) => {
        window.__feedbackQA = { starts: [], peak: 0, speech: [], resets: 0 };
        const qa = window.__feedbackQA;
        const connect = AudioNode.prototype.connect;
        AudioNode.prototype.connect = function (destination, ...args) {
            const result = connect.call(this, destination, ...args);
            if (destination === this.context.destination) {
                // Parallel silent measuring branch: the original output path is unchanged.
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
        const start = AudioBufferSourceNode.prototype.start;
        AudioBufferSourceNode.prototype.start = function (...args) {
            if (this.buffer?.duration > .01) qa.starts.push({ duration: this.buffer.duration, at: performance.now() });
            return start.apply(this, args);
        };
        if (window.speechSynthesis) {
            const speak = speechSynthesis.speak.bind(speechSynthesis);
            speechSynthesis.speak = utterance => {
                const entry = { text: utterance.text, voice: utterance.voice?.name, lang: utterance.lang, events: [] };
                qa.speech.push(entry);
                for (const name of ['start', 'end', 'error']) utterance.addEventListener(name, event => entry.events.push({ name, error: event.error }));
                if (speechFault) queueMicrotask(() => utterance.onerror?.({ error: 'not-allowed' }));
                else speak(utterance);
            };
        }
    }, { speechFault });
}

async function setSettings(page, id, values) {
    await page.evaluate(async ({ id, values }) => {
        const open = indexedDB.open('SansuDatabase');
        const db = await new Promise(resolve => { open.onsuccess = () => resolve(open.result); });
        const tx = db.transaction(['profiles', 'appData'], 'readwrite');
        const read = tx.objectStore('appData').get('app');
        read.onsuccess = () => {
            const app = read.result, profile = { ...app.profiles[id], ...values };
            tx.objectStore('profiles').put(profile);
            tx.objectStore('appData').put({ ...app, profiles: { ...app.profiles, [id]: profile } });
        };
        await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); });
        db.close();
    }, { id, values });
}

async function resetAudio(page) {
    await page.bringToFront();
    assert.equal(await page.evaluate(() => document.visibilityState), 'visible');
    await page.waitForTimeout(650);
    await page.evaluate(() => { window.__feedbackQA.starts = []; window.__feedbackQA.peak = 0; window.__feedbackQA.resets++; });
}
async function resultAudio(page, name, enabled, row) {
    await page.waitForTimeout(400);
    const actual = await page.evaluate(() => ({ starts: window.__feedbackQA.starts, peak: window.__feedbackQA.peak, visibility: document.visibilityState }));
    row.audio.push({ name, enabled, ...actual });
    if (enabled) {
        assert(actual.peak > .005, `${name} must produce nonzero digital output`);
        assert(actual.starts.some(play => Math.abs(play.duration - row.decoded[name].duration) < .02), `${name} must play its decoded buffer`);
    } else { assert.equal(actual.starts.length, 0); assert.equal(actual.peak, 0); }
}
async function capture(page, row, state) {
    const file = `${row.name}-${state}.png`;
    await page.screenshot({ path: `${out}/${file}`, animations: 'disabled' });
    row.captures.push({ file, state, ...await runtimeMetadata(page) });
}
async function decode(page) {
    return page.evaluate(async () => {
        const context = new OfflineAudioContext(1, 1, 44100), assets = {};
        for (const name of ['tap', 'step', 'correct', 'incorrect', 'clear', 'start', 'level_up']) {
            const response = await fetch(`/sounds/${name}.mp3`);
            if (!response.ok) throw new Error(`${name} not served`);
            const bytes = await response.arrayBuffer();
            const byteLength = bytes.byteLength;
            const buffer = await context.decodeAudioData(bytes);
            let peak = 0, energy = 0;
            for (const value of buffer.getChannelData(0)) { peak = Math.max(peak, Math.abs(value)); energy += value * value; }
            assets[name] = { bytes: byteLength, duration: buffer.duration, peak, rms: Math.sqrt(energy / buffer.length) };
        }
        return assets;
    });
}

try {
    for (const viewport of [{ name: 'phone', width: 390, height: 844 }, { name: 'tablet', width: 768, height: 1024 }]) {
        for (const mode of ['math', 'muted-reduced', 'english', 'speech-refused']) {
            const english = mode.startsWith('english') || mode === 'speech-refused', muted = mode === 'muted-reduced';
            const row = { name: `${viewport.name}-${mode}`, viewport, faultInjection: mode === 'speech-refused', captures: [], audio: [], pass: false };
            report.runs.push(row);
            const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: muted ? 'reduce' : 'no-preference', serviceWorkers: 'block' });
            const page = await context.newPage(); page.setDefaultTimeout(15000);
            const errors = []; page.on('pageerror', error => errors.push(error.message));
            try {
                await instrument(page, mode === 'speech-refused');
                await page.goto(`${base}/#/island`);
                await page.getByRole('button', { name: 'まなぶ', exact: true }).waitFor();
                const id = await seedLearningProfile(page, { subject: english ? 'vocab' : 'math', skill: 'add_1d_1', type: english ? 'choice' : 'number' });
                await setSettings(page, id, { soundEnabled: !muted && !english, englishAutoRead: false });
                await page.reload();
                await page.locator('[data-renderer=three] canvas').waitFor();
                await capture(page, row, 'home');
                await page.locator('.island-start').tap();
                await page.locator('[data-input-ready=true]').waitFor();
                await capture(page, row, 'ready');
                row.runtime = await runtimeMetadata(page);
                if (!english) {
                    row.decoded = await decode(page);
                    for (const asset of Object.values(row.decoded)) assert(asset.bytes > 128 && asset.rms > .01 && asset.peak < 1);
                    await resetAudio(page);
                    await page.getByRole('button', { name: '9', exact: true }).tap();
                    await resultAudio(page, 'tap', !muted, row);
                    await page.getByRole('button', { name: 'こたえを けす', exact: true }).tap();
                    await resetAudio(page);
                    let before = await readNative(page, id);
                    await answerUI(page, before.plan, { incorrect: true, touch: true, dev: false });
                    await page.locator('[data-result=retry]').waitFor();
                    assert.equal(await page.locator('[data-result=retry]').innerText(), 'もういちど');
                    assert.equal((await readNative(page, id)).plan.cursor, before.plan.cursor);
                    await capture(page, row, 'retry');
                    await resultAudio(page, 'incorrect', !muted, row);
                    await resetAudio(page);
                    before = await readNative(page, id);
                    await answerUI(page, before.plan, { touch: true, dev: false });
                    await page.locator('[data-result=correct]').waitFor();
                    await capture(page, row, 'correct');
                    if (muted) assert.equal(await page.locator('.island-answer-result__symbol').evaluate(el => getComputedStyle(el).animationName), 'none');
                    await resultAudio(page, 'correct', !muted, row);
                    await page.getByRole('button', { name: '1', exact: true }).tap();
                    assert.equal(await page.locator('.island-answer-result').count(), 0, 'The previous result clears on new input');
                    await page.getByRole('button', { name: 'こたえを けす', exact: true }).tap();
                    while ((await readNative(page, id)).island.completedSets === 0) {
                        const current = await readNative(page, id);
                        await resetAudio(page);
                        await answerUI(page, current.plan, { touch: true, dev: false });
                    }
                    await capture(page, row, 'section-complete');
                    await resultAudio(page, 'clear', !muted, row);
                } else {
                    const control = page.getByRole('button', { name: 'えいごを きく', exact: true });
                    const bounds = await control.boundingBox(); assert(bounds.width >= 44 && bounds.height >= 44);
                    await page.waitForTimeout(750);
                    assert.equal(await page.evaluate(() => window.__feedbackQA.speech.length), 0, 'Auto-read off stays quiet');
                    const before = await readNative(page, id), word = before.plan.slots[before.plan.cursor].problem.questionText;
                    await control.tap();
                    if (row.faultInjection) {
                        await page.locator('[data-speech-status=blocked]').waitFor();
                        assert.match(await page.locator('.island-speech-message').innerText(), /きく/);
                        await capture(page, row, 'refused');
                    } else {
                        await page.waitForFunction(() => window.__feedbackQA.speech.some(call => call.events.some(event => event.name === 'start')));
                        await capture(page, row, 'speaking');
                        await page.waitForFunction(() => window.__feedbackQA.speech.some(call => call.events.some(event => event.name === 'end')));
                        assert.equal(await page.evaluate(() => window.__feedbackQA.speech[0].text), word);
                        assert.deepEqual(await readNative(page, id), before, 'Listening never records an answer');
                        // Rapid replay must replace, never queue the previous word.
                        await control.tap(); await control.tap();
                        await answerUI(page, before.plan, { touch: true, dev: false });
                        await page.waitForTimeout(1000);
                        assert.equal(await page.evaluate(() => speechSynthesis.pending || speechSynthesis.speaking), false, 'An answer cancels the old word');
                        row.manualSpeech = await page.evaluate(() => window.__feedbackQA.speech);
                        await setSettings(page, id, { englishAutoRead: true });
                        await page.reload();
                        await page.locator('[data-input-ready=true]').waitFor();
                        await page.waitForFunction(() => window.__feedbackQA.speech.some(call => call.events.some(event => event.name === 'start')));
                        await page.waitForFunction(() => window.__feedbackQA.speech.some(call => call.events.some(event => event.name === 'end')));
                        assert.equal(await page.evaluate(() => window.__feedbackQA.speech.length), 1, 'One automatic read for the new slot');
                        await capture(page, row, 'auto-read');
                        await page.getByRole('button', { name: 'ヒントを みる', exact: true }).tap();
                        await page.locator('[data-input-ready=true]').waitFor();
                        await page.waitForTimeout(750);
                        assert.equal(await page.evaluate(() => window.__feedbackQA.speech.length), 1, 'Opening help does not reread');
                        row.autoSpeech = await page.evaluate(() => window.__feedbackQA.speech);
                    }
                }
                await page.getByRole('button', { name: 'しまへ', exact: true }).tap();
                await page.locator('.island-start').waitFor();
                if (english) {
                    await page.waitForTimeout(700);
                    assert.equal(await page.evaluate(() => speechSynthesis.pending || speechSynthesis.speaking), false);
                }
                await capture(page, row, 'return');
                assert.deepEqual(errors, []);
                row.pass = true;
                console.log(`PASS ${row.name}`);
            } catch (error) { row.error = error.stack; throw error; }
            finally { await context.close(); }
        }
    }
    report.pass = true;
} finally {
    await browser.close();
    await writeFile(`${out}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
}

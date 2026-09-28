import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { seedLearningProfile } from './island-learning-fixtures.mjs';
import { answerUI, readNative, runtimeMetadata } from './island-e2e-helpers.mjs';

const base = process.env.SANSU_LEARNING_MUSIC_URL || 'http://127.0.0.1:5198';
const out = process.env.SANSU_LEARNING_MUSIC_OUTPUT || `output/playwright/pokomoko-live-audio/${Date.now()}`;
await mkdir(out, { recursive: true });
const sourceFiles = ['learningMusic.ts', 'learningMusicScore.ts', 'learningMusicGesture.ts', 'useLearningMusic.ts', 'IslandSoundControl.tsx', 'IslandLearningPanel.tsx', 'IslandAnswerForm.tsx', 'usePokomokoFeedback.ts', 'learningShow.ts'];
const sourceHash = async () => {
    const hash = createHash('sha256');
    for (const file of sourceFiles) hash.update(file).update(await readFile(`src/components/island/${file}`));
    hash.update(await readFile('src/pages/Island.tsx')); return hash.digest('hex');
};
const report = { target: base, revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceStart: await sourceHash(), qaHash: createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'),
    evidence: 'Disposable browser/profile fixture. Real UI answers and sound control; digital output measured by parallel silent analyser branches. No physical speaker, listening-quality, child, or PWA-release claim.', runs: [], pass: false };

async function instrument(page) {
    await page.addInitScript(() => {
        const qa = window.__learningMusicQA = { contexts: [], starts: [], meters: [], gestures: [], loopGains: [], filters: [] };
        const ids = new WeakMap(), connections = new WeakMap(), decoded = new WeakSet();
        const id = context => {
            if (!ids.has(context)) { ids.set(context, qa.contexts.length); qa.contexts.push({ context, at: performance.now() }); }
            return ids.get(context);
        };
        for (const type of ['pointerdown', 'keydown']) document.addEventListener(type, event => qa.gestures.push({ type, trusted: event.isTrusted, at: performance.now() }), true);
        const connect = AudioNode.prototype.connect;
        AudioNode.prototype.connect = function (destination, ...args) {
            connections.set(this, destination);
            const result = connect.call(this, destination, ...args);
            if (destination === this.context.destination) {
                // The measuring branch cannot alter the audible graph or its gain.
                const analyser = this.context.createAnalyser(), silent = this.context.createGain(); silent.gain.value = 0;
                connect.call(this, analyser); connect.call(analyser, silent); connect.call(silent, destination);
                const meter = { context: id(this.context), peak: 0, energy: 0, samples: 0 }; qa.meters.push(meter);
                const data = new Float32Array(analyser.fftSize);
                const sample = () => {
                    // Closed/suspended contexts do not render; their analysers
                    // retain the last block, which is not continuing output.
                    if (analyser.context.state === 'running') {
                        analyser.getFloatTimeDomainData(data);
                        for (const value of data) { meter.peak = Math.max(meter.peak, Math.abs(value)); meter.energy += value * value; meter.samples++; }
                    }
                    requestAnimationFrame(sample);
                };
                requestAnimationFrame(sample);
            }
            return result;
        };
        const decode = BaseAudioContext.prototype.decodeAudioData;
        BaseAudioContext.prototype.decodeAudioData = function (bytes, success, failure) {
            const promise = decode.call(this, bytes, buffer => { decoded.add(buffer); success?.(buffer); }, failure);
            return promise.then(buffer => { decoded.add(buffer); return buffer; });
        };
        const start = AudioBufferSourceNode.prototype.start, stop = AudioBufferSourceNode.prototype.stop;
        AudioBufferSourceNode.prototype.start = function (...args) {
            const row = { context: id(this.context), duration: this.buffer?.duration ?? 0, loop: this.loop, decoded: Boolean(this.buffer && decoded.has(this.buffer)),
                at: performance.now(), activation: navigator.userActivation?.isActive, stopped: false };
            qa.starts.push(row); this.__qaRow = row;
            if (this.loop && Math.abs(row.duration - 16) < .01) {
                const gain = connections.get(this); qa.loopGains.push({ context: row.context, gain, row });
                const filter = connections.get(gain); if (filter instanceof BiquadFilterNode && !qa.filters.includes(filter)) qa.filters.push(filter);
            }
            return start.apply(this, args);
        };
        AudioBufferSourceNode.prototype.stop = function (...args) { if (this.__qaRow) this.__qaRow.stopped = true; return stop.apply(this, args); };
    });
}
async function setInitialSound(page, id, enabled) {
    await page.evaluate(async ({ id, enabled }) => {
        const open = indexedDB.open('SansuDatabase');
        const db = await new Promise((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
        const tx = db.transaction(['profiles', 'appData'], 'readwrite'), read = tx.objectStore('appData').get('app');
        read.onsuccess = () => {
            const app = read.result, profile = { ...app.profiles[id], soundEnabled: enabled };
            tx.objectStore('profiles').put(profile); tx.objectStore('appData').put({ ...app, profiles: { ...app.profiles, [id]: profile } });
        };
        await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); }); db.close();
    }, { id, enabled });
}
async function snapshot(page, label, silence = false) {
    // Let previously triggered finite feedback finish, then measure backing alone.
    await page.waitForTimeout(900);
    await page.evaluate(() => { for (const meter of window.__learningMusicQA.meters) { meter.peak = 0; meter.energy = 0; meter.samples = 0; } });
    await page.waitForTimeout(550);
    const value = await page.evaluate(() => {
        const qa = window.__learningMusicQA;
        return { completed: Number(document.querySelector('.island-workbench')?.dataset.showCompleted ?? 0),
            level: Number(document.querySelector('.island-workbench')?.dataset.showLevel ?? 0),
            contexts: qa.contexts.map(({ context, at }, index) => ({ id: index, state: context.state, at })),
            starts: qa.starts, stems: qa.loopGains.map(({ context, gain, row }) => ({ context, gain: gain.gain.value, stopped: row.stopped })),
            filters: qa.filters.map(filter => ({ context: qa.contexts.findIndex(value => value.context === filter.context), cutoff: filter.frequency.value })),
            meters: qa.meters.map(meter => ({ context: meter.context, peak: meter.peak, rms: Math.sqrt(meter.energy / Math.max(1, meter.samples)) })),
            gestures: qa.gestures };
    });
    if (silence) assert(value.meters.every(meter => meter.peak === 0), `${label} must be digitally silent: ${JSON.stringify(value.meters)}`);
    return { label, ...value };
}
const browser = await chromium.launch();
let page;
try {
    for (const muted of [false, true]) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
        page = await context.newPage(); page.setDefaultTimeout(20000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        const row = { mode: muted ? 'silent-profile' : 'enabled', snapshots: [], answers: [], pass: false }; report.runs.push(row);
        try {
            await instrument(page);
            await page.goto(`${base}/#/island`);
            await page.getByRole('button', { name: 'まなぶ', exact: true }).waitFor();
            const id = await seedLearningProfile(page, { skill: 'add_1d_1', type: 'number' });
            await setInitialSound(page, id, !muted); await page.reload();
            await page.getByRole('button', { name: 'まなぶ', exact: true }).click();
            await page.locator('[data-input-ready=true]').waitFor(); row.runtime = await runtimeMetadata(page);
            const ready = await snapshot(page, 'before-first-learning-gesture', true); row.snapshots.push(ready);
            assert.equal(ready.starts.filter(source => source.loop && source.duration === 16).length, 0, 'Entering learning alone cannot start its music');
            for (let answered = 1; answered <= (muted ? 2 : 6); answered++) {
                const before = await readNative(page, id);
                const result = await answerUI(page, before.plan, { touch: true }); row.answers.push({ count: answered, ms: result.ms });
                await page.waitForFunction(value => Number(document.querySelector('.island-workbench')?.dataset.showCompleted) === value, answered);
                if ([1, 3, 4, 5, 6].includes(answered)) {
                    const state = await snapshot(page, `after-${answered}`, muted); row.snapshots.push(state);
                    if (!muted) {
                        const stems = state.stems.filter(stem => !stem.stopped);
                        assert.equal(stems.length, 4); assert.equal(new Set(stems.map(stem => stem.context)).size, 1);
                        const musicId = stems[0].context;
                        assert(state.meters.some(meter => meter.context === musicId && meter.peak > .003), 'Backing music must produce nonzero output after all finite feedback has ended');
                        assert(state.starts.filter(source => source.duration > .01).every(source => !source.decoded), 'Math must not duplicate the old decoded MP3 tap/success sounds');
                        assert(state.starts.filter(source => source.loop).every(source => source.activation), 'Music starts inside the trusted learning interaction');
                        if (answered === 1) assert(stems[0].gain > .99 && stems.slice(1).every(stem => stem.gain < .001));
                        if (answered === 3) assert(stems[1].gain > .99 && stems[2].gain > .12 && stems[3].gain < .001);
                        if (answered === 4) assert(state.filters.find(filter => filter.context === musicId).cutoff < 700, 'Reach narrows the backing');
                        if (answered === 5) assert(state.filters.find(filter => filter.context === musicId).cutoff > 8900, 'Peak opens the backing');
                        if (answered === 6) assert(stems[2].gain > .99 && stems[3].gain > .3, 'Question progress adds percussion and chords after six');
                    } else assert.equal(state.stems.length, 0, 'A silent profile must never create music stems');
                }
            }
            if (!muted) {
                await page.getByRole('button', { name: 'おとを けす', exact: true }).click();
                await page.getByRole('button', { name: 'おとを だす', exact: true }).waitFor();
                const silent = await snapshot(page, 'after-user-mute', true); row.snapshots.push(silent);
                assert(silent.stems.every(stem => stem.stopped));
                assert(silent.contexts.filter(item => silent.stems.some(stem => stem.context === item.id)).every(item => item.state === 'closed'));
                const before = await readNative(page, id); await answerUI(page, before.plan, { touch: true });
                row.snapshots.push(await snapshot(page, 'answer-while-muted', true));
                await page.getByRole('button', { name: 'おとを だす', exact: true }).click();
                await page.getByRole('button', { name: 'おとを けす', exact: true }).waitFor();
                // The header is outside the learning panel. Its click itself must
                // start the backing, without a subsequent answer/key interaction.
                const resumed = await snapshot(page, 'immediately-after-header-unmute'); row.snapshots.push(resumed);
                assert.equal(resumed.stems.filter(stem => !stem.stopped).length, 4);
                const musicId = resumed.stems.find(stem => !stem.stopped).context;
                assert(resumed.meters.some(meter => meter.context === musicId && meter.peak > .003), 'Sound-on must start audible backing before the next answer');
                await page.getByRole('button', { name: 'とじる', exact: true }).click();
                await page.getByRole('button', { name: /まなぶ|つづきから とく/, exact: true }).waitFor();
                const left = await snapshot(page, 'after-leaving-learning', true); row.snapshots.push(left);
                assert(left.stems.every(stem => stem.stopped));
                assert(left.contexts.filter(item => left.stems.some(stem => stem.context === item.id)).every(item => item.state === 'closed'));
            } else {
                // Reject only this attempted sound preference write. A context
                // unlocked on the click must not survive a failed profile save.
                await page.evaluate(profileId => {
                    const put = IDBObjectStore.prototype.put;
                    window.__restoreLearningSoundWrite = () => { IDBObjectStore.prototype.put = put; };
                    IDBObjectStore.prototype.put = function (value, ...args) {
                        if (this.name === 'appData' && value?.profiles?.[profileId]?.soundEnabled) {
                            throw new DOMException('Injected sound preference write failure', 'QuotaExceededError');
                        }
                        return put.call(this, value, ...args);
                    };
                }, id);
                try {
                    await page.getByRole('button', { name: 'おとを だす', exact: true }).click();
                    await page.getByText('せっていを のこせなかったよ。もういちど おしてね', { exact: true }).waitFor();
                    const failed = await snapshot(page, 'failed-sound-preference-save', true); row.snapshots.push(failed);
                    assert(failed.stems.every(stem => stem.stopped), 'Failed sound save must cancel its newly unlocked learning graph');
                    assert(failed.contexts.filter(item => failed.stems.some(stem => stem.context === item.id)).every(item => item.state === 'closed'));
                } finally { await page.evaluate(() => window.__restoreLearningSoundWrite()); }
                await page.getByRole('button', { name: 'おとを だす', exact: true }).click();
                await page.getByRole('button', { name: 'おとを けす', exact: true }).waitFor();
                const enabled = await snapshot(page, 'silent-profile-header-enable'); row.snapshots.push(enabled);
                assert.equal(enabled.stems.filter(stem => !stem.stopped).length, 4);
                const musicId = enabled.stems.find(stem => !stem.stopped).context;
                assert(enabled.meters.some(meter => meter.context === musicId && meter.peak > .003), 'A previously silent profile starts backing on the sound button itself');
            }
            await page.screenshot({ path: `${out}/${row.mode}.png` });
            assert.deepEqual(errors, []); row.errors = errors; row.pass = true; console.log(`PASS ${row.mode}`);
        } catch (error) { row.error = error.stack; await page.screenshot({ path: `${out}/${row.mode}-failure.png` }); throw error; }
        finally { await context.close(); }
    }
    report.sourceEnd = await sourceHash(); assert.equal(report.sourceEnd, report.sourceStart, 'Audio integration sources must stay fixed during this journey');
    report.pass = true;
} finally {
    await browser.close(); await writeFile(`${out}/report.json`, `${JSON.stringify(report, null, 2)}\n`); console.log(`${out}/report.json`);
}

import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePCM, floatWav, statistics, assertShellPCM, assertFreePCM, assertNoStack, assertHiddenRetirement, assertNoPreviewResume, assertOutletIsolation, assertMeasuredWindow, joinOutput, assertDeliveredShell, assertSoundDelta, sha256 } from './audio-analysis.mjs';

const shell = 'shell-three-notes';
const panel = page => page.locator('section[aria-label="みじたくと コレクション"]');
const experience = page => page.getByTestId('island-experience');
const islandFor = (data, owner) => data.islands.find(value => value.profileId === owner);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const fileNames = ['audio-analysis.mjs', 'audio-probe.mjs', 'expression-audio-phase.mjs'];
const localHashes = () => Promise.all(fileNames.map(async file => ({ file,
    sha256: sha256(await fs.readFile(fileURLToPath(new URL(file, import.meta.url)))) })));

/** Unvalidated evidence is persisted before assertions. A bad waveform, DB
 * delta, timestamp gap, probe overflow or locator must not erase the cause.
 * Collection failures are separate fields; disk failures remain loud errors. */
export async function persistAudioEvidence({ output, name, report, readProbe, readTables, label = 'latest' }) {
    const gathered = await Promise.allSettled([Promise.resolve().then(readProbe), Promise.resolve().then(readTables)]);
    const evidence = { label, collectedAt: new Date().toISOString(),
        probe: gathered[0].status === 'fulfilled' ? gathered[0].value : null,
        tables: gathered[1].status === 'fulfilled' ? gathered[1].value : null,
        collectionErrors: gathered.flatMap((value, i) => value.status === 'rejected' ? [{ source: i === 0 ? 'probe' : 'tables', error: String(value.reason) }] : []) };
    const file = `${name}-${label}-raw-evidence.json`;
    // Raw base64 is retained even when a WAV cannot be decoded or assembled.
    // Never replace the last usable evidence if the document has disappeared.
    await fs.writeFile(path.join(output, file), JSON.stringify(evidence, null, 2));
    report.evidence ??= []; report.evidence.push({ file, label, collectionErrors: evidence.collectionErrors });
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    return evidence;
}
export async function withAudioFailureEvidence(operation, options) {
    try { return await operation(); }
    catch (error) {
        options.report.status = 'failed'; options.report.failure = error.stack ?? String(error);
        try { await persistAudioEvidence({ ...options, label: `failure-${(options.report.evidence?.length ?? 0) + 1}` }); }
        catch (saveError) { throw new AggregateError([error, saveError], 'Audio QA failed and its evidence could not be written'); }
        throw error;
    }
}

/** No browser/server is created. Qualified caller supplies its existing page,
 * native all-table reader (including Blob hashes) and frozen-build evidence. */
export async function createExpressionAudioPhase({ page, owner, name, touch, output, provenance, tables }) {
    await fs.mkdir(path.dirname(output), { recursive: true }); await fs.mkdir(output);
    const report = { status: 'initializing', browserStartedByModule: false, applicationDataInjected: false, qualificationProvenByModule: false,
        humanN: 0, timingEvidenceEligible: false, physicalSpeaker: 'UNVERIFIED', provenance, name, owner,
        checks: [], captures: [], sourceAudio: [], outputAudio: [], db: [], boundaries: {},
        unverified: ['Unowned preview qualification path is the caller’s responsibility', 'Native suspended-resume fault, profile race and blocked learning write not executed by this module', 'Physical loudness/timbre and child comprehension need separate human listening'] };
    const evidenceOptions = { output, name: /^(phone|tablet)$/u.test(name) ? name : 'entry', report,
        readProbe: async () => page.evaluate(() => window.__expressionAudioProbe.snapshot(true)), readTables: async () => tables(page) };
    return withAudioFailureEvidence(async () => createPhase({ page, owner, name, touch, output, provenance, tables, report, evidenceOptions }), evidenceOptions);
}
async function createPhase({ page, owner, name, touch, output, provenance, tables: nativeTables, report, evidenceOptions }) {
    // Persist the previous/current read pair even if a locator fails before its
    // explicit delta check. This never writes anything back to the application.
    let previousTables = null, currentTables = null;
    const tables = async target => { const value = await nativeTables(target); previousTables = currentTables; currentTables = value; return value; };
    evidenceOptions.readTables = async () => ({ previousRead: previousTables, currentRead: currentTables, nativeNow: await nativeTables(page) });
    const checkpoint = async label => persistAudioEvidence({ ...evidenceOptions, label,
        readTables: async () => ({ previousRead: previousTables, currentRead: currentTables, nativeNow: await nativeTables(page) }) });
    assert(page && typeof tables === 'function' && owner && /^(phone|tablet)$/u.test(name));
    assert(provenance?.revision && provenance.sourceHash && provenance.qaClosureHash, 'Caller must hash the immutable app and the entire QA bundle');
    assert.equal(await page.locator('.island-page').getAttribute('data-build-revision'), provenance.revision);
    const probeVersion = await page.evaluate(() => window.__expressionAudioProbe?.version);
    assert.equal(probeVersion, 'expression-audio-probe-worklet-v5', 'Install probe before the qualified page navigation');
    const initial = await tables(page), island = islandFor(initial, owner);
    assert(island?.workshop?.creations.some(value => value.partId === 'bell'), 'Requires actual saved bell observation from qualified caller');
    assert(island.expression?.ownedItemIds.includes(shell), 'Requires the preceding explicit zero-star acquisition');
    assert(island.pendingPlanId && initial.islandPlans.some(plan => plan.id === island.pendingPlanId && plan.status === 'active'), 'Reserve the normal question through real learning before this phase');
    assert.equal(await page.locator('.island-page').getAttribute('data-mode'), 'expression');
    report.status = 'running'; report.hashes = await localHashes();
    const entryEvidence = await checkpoint('entry');
    report.entryProbe = { limits: entryEvidence.probe?.limits, sources: entryEvidence.probe?.sources.length, outputs: entryEvidence.probe?.outputs.length,
        events: entryEvidence.probe?.events.length, errors: entryEvidence.probe?.errors };
    assert.deepEqual(entryEvidence.probe?.errors, [], 'Pre-phase diagnostics already exceeded a bound or failed; do not reset them to obtain PASS');
    const snap = (raw = false) => page.evaluate(raw => window.__expressionAudioProbe.snapshot(raw), raw);
    const press = async locator => { await idle(); if (touch) await locator.tap(); else await locator.click(); };
    const idle = () => page.waitForFunction(() => document.querySelector('.island-page')?.getAttribute('data-busy') === 'false');
    const mode = () => page.locator('.island-page').getAttribute('data-mode');
    const waitMode = expected => page.waitForFunction(expected => document.querySelector('.island-page')?.getAttribute('data-mode') === expected, expected);
    const capture = async label => { const file = `${name}-${label}.png`, bytes = await page.screenshot({ path: path.join(output, file), fullPage: true });
        report.captures.push({ label, file, sha256: sha256(bytes), mode: await mode() }); };
    const recordDB = async (label, before, action) => {
        await idle(); const after = await tables(page);
        const file = `${name}-db-${String(report.db.length + 1).padStart(2, '0')}-${label}.json`;
        await fs.writeFile(path.join(output, file), JSON.stringify({ before, after, action: action ?? null }, null, 2));
        const entry = { label, file, exact: false }; report.db.push(entry);
        assertSoundDelta(before, after, owner, action); entry.exact = true; return after;
    };
    const currentSources = value => value.sources.filter(source => source.ambienceCandidate);
    const alive = (value, source) => !source.stopAt && !source.disconnectAt && !source.endedAt && !value.contexts.find(context => context.id === source.contextId)?.closedAt;
    const stopped = async ids => {
        await page.waitForFunction(ids => {
            const probe = window.__expressionAudioProbe.snapshot();
            return ids.every(id => { const source = probe.sources.find(value => value.id === id), context = probe.contexts.find(value => value.id === source?.contextId);
                return source?.stopAt !== null && source?.disconnectAt !== null && context?.state === 'closed' && context.closedAt !== null; });
        }, ids, { timeout: 4000 });
    };
    const muted = async () => {
        await page.waitForFunction(() => {
            const data = window.__expressionAudioProbe.snapshot(); return data.sources.filter(source => source.ambienceCandidate)
                .every(source => source.stopAt !== null || source.disconnectAt !== null || source.endedAt !== null);
        }, undefined, { timeout: 4000 });
        const data = await snap(); await stopped(currentSources(data).map(source => source.id));
    };
    const write = async (label, action, locator) => {
        const before = await tables(page), prior = islandFor(before, owner);
        report.pendingDBCheck = { label, before, action }; await press(locator);
        const end = Date.now() + 15000;
        while (Date.now() < end) { const next = await tables(page); if (islandFor(next, owner).revision > prior.revision) break; await delay(40); }
        const result = await recordDB(label, before, action); delete report.pendingDBCheck; return result;
    };
    const enterExperience = async () => {
        if (await mode() === 'expression') await press(panel(page).getByRole('button', { name: 'みじたくを とじる', exact: true }));
        await waitMode('experience'); await press(experience(page).getByRole('button', { name: 'しま', exact: true }));
    };
    const selectShell = async () => {
        if (await mode() === 'experience') await press(page.locator('[data-experience-action="expression"]'));
        await waitMode('expression'); await press(panel(page).getByRole('button', { name: 'けしきと おと', exact: true }));
        await press(panel(page).locator('[data-expression-choice="shell-three-notes"]'));
    };
    const free = async kind => {
        await enterExperience();
        const after = await write(`free-${kind}`, { type: 'ambience', ambience: kind }, experience(page).locator(`[data-ambience="${kind}"]`));
        await page.waitForFunction(kind => document.querySelector(`[data-ambience="${kind}"]`)?.getAttribute('aria-pressed') === 'true', kind);
        assert.equal(islandFor(after, owner).expression.selection.soundscape, null); return after;
    };
    const equip = async () => {
        await selectShell(); const before = await tables(page);
        if (islandFor(before, owner).expression.selection.soundscape === shell) {
            await write('remove-for-new-loop', { type: 'equip-soundscape', itemId: null }, panel(page).locator('[data-expression-action="remove"]'));
        }
        return write('equip-shell', { type: 'equip-soundscape', itemId: shell }, panel(page).locator('[data-expression-action="equip"]'));
    };
    const header = async enabled => {
        const control = page.locator('.island-sound-button');
        let before = await tables(page), saved = before.profiles.find(profile => profile.id === owner).soundEnabled;
        // A blocked enabled button offers resume, not mute. Honor that actual UI.
        if (saved && await control.getAttribute('data-sound-state') !== 'ready') {
            await press(control); await page.locator('.island-sound-button[data-sound-state="ready"]:enabled').waitFor();
            await recordDB('header-resume', before); before = await tables(page);
        }
        if (saved === enabled) return;
        await press(control);
        const end = Date.now() + 15000;
        while (Date.now() < end) { saved = (await tables(page)).profiles.find(profile => profile.id === owner).soundEnabled; if (saved === enabled) break; await delay(40); }
        await recordDB(`header-${enabled ? 'on' : 'off'}`, before, { type: 'profile-sound', enabled });
        await page.locator(`.island-sound-button[data-sound-state="${enabled ? 'ready' : 'off'}"]:enabled`).waitFor();
    };
    const beginWindow = label => page.evaluate(label => window.__expressionAudioProbe.begin(label), label);
    const endWindow = () => page.evaluate(() => window.__expressionAudioProbe.end());
    const freshSource = async (marker, seconds, loop) => {
        await page.waitForFunction(({ marker, seconds, loop }) => window.__expressionAudioProbe.snapshot().sources.slice(marker.sourceCount)
            .some(source => source.ambienceCandidate && source.duration === seconds && source.loop === loop), { marker, seconds, loop });
        const value = await snap(), found = value.sources.slice(marker.sourceCount).filter(source => source.ambienceCandidate && source.duration === seconds && source.loop === loop).at(-1);
        assert(found?.outlets.length === 1, 'Native source must reach exactly one measured app destination outlet'); return found;
    };
    const waitOutput = async (source, label, seconds) => {
        await page.waitForFunction(({ source, label, seconds }) => {
            const data = window.__expressionAudioProbe.snapshot(), output = data.outputs.find(output => source.outlets.includes(output.id) && output.contextId === source.contextId);
            const blocks = output?.blocks.filter(block => block.window === label) ?? [];
            return blocks.length > 1 && blocks.at(-1).playbackTime - blocks[0].playbackTime >= seconds;
        }, { source, label, seconds }, { timeout: 20000 });
    };
    const exportWindow = async (label, source, kind, repeated = false) => {
        const evidence = await checkpoint(`${label}-before-analysis`), data = evidence.probe;
        assert(data, 'Native audio snapshot could not be collected');
        const pcm = data.pcm.find(value => value.id === source.pcmId); assert(pcm && pcm.channels === 1);
        const raw = decodePCM(pcm.base64);
        const file = `${name}-${label}-source.wav`, bytes = floatWav(raw, pcm.sampleRate); await fs.writeFile(path.join(output, file), bytes);
        const sourceEvidence = { label, file, sha256: sha256(bytes), sourceId: source.id, contextId: source.contextId, kind, loop: source.loop };
        report.sourceAudio.push(sourceEvidence);
        const outlet = data.outputs.find(value => value.contextId === source.contextId && source.outlets.includes(value.id)); assert(outlet);
        const measurementBoundary = assertMeasuredWindow(outlet, label, source);
        const blocks = outlet.blocks.filter(block => block.window === label), samples = joinOutput(blocks, pcm.sampleRate);
        const outputFile = `${name}-${label}-gain-output.wav`, outputBytes = floatWav(samples, pcm.sampleRate);
        await fs.writeFile(path.join(output, outputFile), outputBytes);
        const outputEvidence = { label, file: outputFile, sha256: sha256(outputBytes), sourceId: source.id, contextId: source.contextId, outletId: outlet.id,
            firstPlaybackTime: blocks[0].playbackTime, lastPlaybackTime: blocks.at(-1).playbackTime,
            firstRenderFrame: blocks[0].renderFrame, lastRenderFrame: blocks.at(-1).renderFrame,
            tapReadyAudioTime: outlet.readyAudioTime, sourceStartAudioTime: source.scheduledStartAudioTime, measurementBoundary,
            unmeasuredOnsetSeconds: Math.max(0, blocks[0].playbackTime - source.scheduledStartAudioTime),
            measurement: 'Native app gain -> passive AudioWorklet input/currentFrame; original audible connection unchanged. Samples before the first recorded render frame are unmeasured.' };
        report.outputAudio.push(outputEvidence);
        assert.deepEqual(data.errors, []);
        assertOutletIsolation(data.sources.find(value => value.id === source.id), outlet, blocks);
        sourceEvidence.analysis = kind === shell ? assertShellPCM(raw, pcm.sampleRate, source.duration) : assertFreePCM(raw, pcm.sampleRate, kind);
        outputEvidence.delivered = kind === shell ? assertDeliveredShell(samples, pcm.sampleRate, repeated, raw, {
            firstRenderFrame: blocks[0].renderFrame, sourceStartAudioTime: source.scheduledStartAudioTime, sourceSampleRate: source.sampleRate,
        }) : statistics(samples, pcm.sampleRate);
        assert(outputEvidence.delivered.rms > 1e-6, 'The exact source context/gain must produce a nonzero digital output');
        assertNoStack(currentSources(data).map(source => ({ ...source, contextClosedAt: data.contexts.find(context => context.id === source.contextId)?.closedAt })));
        await capture(label); return source;
    };
    const loopCapture = async label => {
        await free('off'); await muted(); await selectShell(); const marker = await beginWindow(label); await equip();
        const source = await freshSource(marker, 14, true); await waitOutput(source, label, 16); await endWindow();
        await exportWindow(label, source, shell, true); return source;
    };
    const save = async () => {
        const evidence = await checkpoint(`checkpoint-${(report.evidence?.length ?? 0) + 1}`), data = evidence.probe;
        report.finalHashes = await localHashes(); assert.deepEqual(report.finalHashes, report.hashes, 'Draft module source changed during execution');
        assert(data, 'Native audio snapshot could not be collected'); assert.deepEqual(data.errors, []);
        assertNoStack(currentSources(data).map(source => ({ ...source, contextClosedAt: data.contexts.find(context => context.id === source.contextId)?.closedAt })));
        await fs.writeFile(path.join(output, `${name}-native-audio-events.json`), JSON.stringify(data, null, 2));
        await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    };

    const api = {
        report,
        /** Ends in expression with shell equipped, sound enabled, one loop. */
        async runMain() {
            try {
                await free('off'); await header(false); await muted(); await selectShell();
                const quietBefore = await tables(page), quiet = (await snap()).sources.length;
                await press(panel(page).locator('[data-expression-action="preview"]'));
                assert.equal(await panel(page).getByRole('button', { name: 'おとを きく', exact: true }).isDisabled(), true);
                await delay(160); assert.equal((await snap()).sources.length, quiet); await recordDB('muted-preview', quietBefore);
                await header(true);
                for (const repeat of [false, true]) {
                    const label = repeat ? 'preview-replace' : 'preview-once', before = await tables(page);
                    let marker = await beginWindow(label);
                    await press(panel(page).getByRole('button', { name: 'おとを きく', exact: true }));
                    if (repeat) { const first = await freshSource(marker, 2, false), live = await snap();
                        assert(alive(live, live.sources.find(source => source.id === first.id)), 'Replacement must interrupt a still-active phrase');
                        marker = { sourceCount: live.sources.length };
                        await press(panel(page).getByRole('button', { name: 'おとを きく', exact: true })); }
                    const source = await freshSource(marker, 2, false); await stopped([source.id]); await endWindow();
                    await exportWindow(label, source, shell); await recordDB(label, before);
                    await page.locator('[data-expression-sound="ready"]').waitFor();
                }
                const settledCount = (await snap()).sources.length; await delay(250);
                assert.equal((await snap()).sources.length, settledCount, 'Natural preview completion does not schedule another phrase');
                await press(panel(page).getByRole('button', { name: 'いまに もどす', exact: true }));
                const loop = await loopCapture('shell-loop-two-phrases');
                const equipped = islandFor(await tables(page), owner).expression; await header(false); await stopped([loop.id]);
                assert.deepEqual(islandFor(await tables(page), owner).expression, equipped, 'Global mute retains ownership and equipped sound');
                const reenable = { sourceCount: (await snap()).sources.length }; await header(true); await freshSource(reenable, 14, true);
                const sameOff = await tables(page); assert.equal(islandFor(sameOff, owner).experience.ambience, 'off');
                await free('off'); await muted(); report.checks.push('Same saved free off explicitly removes the collected override; global off did not');
                for (const kind of ['breeze', 'brook', 'evening']) {
                    const marker = { sourceCount: (await snap()).sources.length }; await equip(); const old = await freshSource(marker, 14, true);
                    const label = `shell-to-${kind}`, outputMarker = await beginWindow(label); await free(kind);
                    const source = await freshSource(outputMarker, 6, true); await stopped([old.id]); await waitOutput(source, label, 1.7); await endWindow();
                    await exportWindow(label, source, kind);
                }
                const marker = { sourceCount: (await snap()).sources.length }; await equip(); const shellSource = await freshSource(marker, 14, true);
                const removal = await beginWindow('remove-restores-evening');
                await write('remove-shell', { type: 'equip-soundscape', itemId: null }, panel(page).locator('[data-expression-action="remove"]'));
                const freeSource = await freshSource(removal, 6, true); await stopped([shellSource.id]); await waitOutput(freeSource, 'remove-restores-evening', 1.7); await endWindow();
                await exportWindow('remove-restores-evening', freeSource, 'evening');
                await free('off'); const finalMarker = { sourceCount: (await snap()).sources.length }; await equip(); await freshSource(finalMarker, 14, true);
                report.checks.push('Three actual free source/output waveforms replace shell, and removing shell restores the stored free ambience');
                report.status = 'main-digital-audio-passed; boundaries-and-human-listening-separate'; await save();
            } catch (error) { await endWindow().catch(() => {}); throw error; }
            return report;
        },
        /** Caller supplies real tab/window transitions. Never synthesize hidden. */
        async runHidden({ hide, restore, headed }) {
            assert(headed === true && typeof hide === 'function' && typeof restore === 'function');
            await free('off'); await selectShell(); const before = await tables(page), marker = { sourceCount: (await snap()).sources.length };
            await press(panel(page).locator('[data-expression-action="preview"]')); await press(panel(page).getByRole('button', { name: 'おとを きく', exact: true }));
            const once = await freshSource(marker, 2, false); await hide();
            const visibility = await page.evaluate(() => ({ hidden: document.hidden, state: document.visibilityState, focused: document.hasFocus() }));
            assert(visibility.hidden && visibility.state === 'hidden', 'No native hidden: this gate is UNVERIFIED, not PASS'); await stopped([once.id]);
            const hiddenPreview = await snap(); assertHiddenRetirement(hiddenPreview.sources.find(source => source.id === once.id),
                hiddenPreview.events.find(event => event.type === 'visibility' && event.hidden && event.at >= once.startedAt));
            // The baseline is taken while still hidden. A one-shot that starts
            // and even ends *inside* restore() is still an illegal new source.
            await restore(); await page.waitForFunction(() => !document.hidden);
            await delay(800); assertNoPreviewResume(hiddenPreview, await snap());
            await recordDB('hidden-preview', before); await capture('hidden-preview-return');
            // Equip after the old preview is cancelled by the actual hook/UI.
            if (await panel(page).getByRole('button', { name: 'いまに もどす', exact: true }).count()) await press(panel(page).getByRole('button', { name: 'いまに もどす', exact: true }));
            const loopMarker = { sourceCount: (await snap()).sources.length }; await equip(); const loop = await freshSource(loopMarker, 14, true);
            const loopBefore = await tables(page); await hide(); assert(await page.evaluate(() => document.hidden)); await stopped([loop.id]);
            const hiddenLoop = await snap(); assertHiddenRetirement(hiddenLoop.sources.find(source => source.id === loop.id),
                hiddenLoop.events.find(event => event.type === 'visibility' && event.hidden && event.at >= loop.startedAt));
            const count = (await snap()).sources.length; await restore(); await page.waitForFunction(() => !document.hidden);
            await freshSource({ sourceCount: count }, 14, true); await recordDB('hidden-equipped-loop', loopBefore);
            report.boundaries.hidden = { passed: true, visibility, oneShotNotReplayed: true, equippedLoopResumesCurrentSelection: true }; await save();
        },
        /** A caller-owned real UI navigation leaves the island. No page.goto or
         * app reset is performed here; this phase intentionally leaves it exited. */
        async runExit({ leave }) {
            assert.equal(typeof leave, 'function'); const before = await tables(page), value = await snap(), active = currentSources(value).filter(source => alive(value, source));
            assert(active.length === 1 && active[0].duration === 14); await leave();
            assert.equal(await page.locator('.island-page').count(), 0, 'Exit must unmount the island, not merely return to its active home');
            await stopped(active.map(source => source.id)); const count = (await snap()).sources.length; await delay(300);
            assert.equal((await snap()).sources.length, count);
            // The island is unmounted, so do not wait for its idle attribute.
            const after = await tables(page), file = `${name}-db-exit.json`;
            await fs.writeFile(path.join(output, file), JSON.stringify({ before, after, action: null }, null, 2));
            const entry = { label: 'exit', file, exact: false }; report.db.push(entry);
            assertSoundDelta(before, after, owner); entry.exact = true;
            report.boundaries.exit = { passed: true, sourceIds: active.map(source => source.id) }; await save();
        },
        /** Ends at the same normal learning input; caller can answer/reload using
         * its existing real-learning helper. No answer or reservation is injected. */
        async runLearning() {
            await selectShell(); const before = await tables(page), saved = islandFor(before, owner), plan = before.islandPlans.find(plan => plan.id === saved.pendingPlanId);
            assert(plan?.status === 'active');
            await page.waitForFunction(() => window.__expressionAudioProbe.snapshot().sources.some(source => source.ambienceCandidate && source.duration === 14
                && source.stopAt === null && source.disconnectAt === null && source.endedAt === null));
            const data = await snap(), active = currentSources(data).filter(source => alive(data, source)); assert.equal(active.length, 1);
            await press(panel(page).locator('[data-expression-action="learn"]'));
            await page.waitForFunction(plan => {
                const input = document.querySelector('[data-island-plan-id][data-input-ready="true"]');
                return document.querySelector('.island-page')?.getAttribute('data-mode') === 'learning'
                    && input?.getAttribute('data-island-plan-id') === plan.id && Number(input.getAttribute('data-island-plan-revision')) === plan.revision;
            }, plan);
            await stopped(active.map(source => source.id)); await recordDB('same-learning-reservation', before); await capture('same-learning-stops-island-audio');
            report.boundaries.learning = { passed: true, sourceIds: active.map(source => source.id), planId: plan.id, planRevision: plan.revision,
                blockedSaveBeforeInput: 'UNVERIFIED', actualAnswerSound: 'caller-must-check-separate-learning-context' }; await save(); return plan;
        },
        save,
    };
    for (const [method, label] of [['runMain', 'main'], ['runHidden', 'hidden'], ['runExit', 'exit'], ['runLearning', 'learning'], ['save', 'save']]) {
        const run = api[method];
        api[method] = async options => {
            report.boundaries[label] = { status: 'running' };
            return withAudioFailureEvidence(async () => {
                try {
                    const result = await run(options); if (report.boundaries[label].status === 'running') report.boundaries[label] = { status: 'passed' };
                    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); return result;
                }
                catch (error) { report.boundaries[label] = { status: 'failed-or-unverified', error: error.stack }; throw error; }
            }, evidenceOptions);
        };
    }
    return api;
}

if (process.argv.includes('--plan')) console.log(JSON.stringify({ preparedOnly: true, browserStarted: false, serverStarted: false,
    entry: 'Qualified real bell observation + explicit shell acquisition, existing page in expression with active normal plan',
    exports: ['installExpressionAudioProbe(context)', 'createExpressionAudioPhase(options) -> runMain/runHidden/runExit/runLearning/save'],
    source: 'All three local modules must enter immutable QA closure; parent verifies fixed app/helper hash before and after',
    passLimit: 'Raw native PCM + same-context gain output/lifecycle are digital evidence only; this draft has never run in a browser' }, null, 2));

import assert from 'node:assert/strict';
import { test } from 'vitest';
import vm from 'node:vm';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertShellPCM, assertFreePCM, assertDeliveredShell, floatWav, decodePCM, joinOutput, assertNoStack, assertHiddenRetirement, assertNoPreviewResume, assertOutletIsolation, assertMeasuredWindow, assertSoundDelta } from './audio-analysis.mjs';
import { installProbeInDocument } from './audio-probe.mjs';
import { createExpressionAudioPhase, persistAudioEvidence, withAudioFailureEvidence } from './expression-audio-phase.mjs';
// Test-only positive control: the independent QA must accept the unchanged
// native source generator. Browser qualification never imports this function.
import { createIslandAmbienceSamples } from '../../src/components/island/islandAmbienceAudio';

// Synthetic isolated test signal only. It is deliberately simpler than the
// product's three-harmonic sound and cannot be filed as app/browser evidence.
function syntheticShell(rate, seconds = 2) {
    return Float32Array.from({ length: rate * seconds }, (_, index) => {
        const t = index / rate; let value = 0;
        for (const [note, start] of [0, .36, .72].entries()) {
            const age = t - start;
            if (age >= 0 && age < .58) value += Math.sin(2 * Math.PI * [540, 675, 810][note] * age) * Math.min(age / .004, 1) * Math.exp(-12 * age) * .06;
        }
        return value;
    });
}
const encoded = values => {
    const buffer = Buffer.alloc(values.length * 4); values.forEach((value, i) => buffer.writeFloatLE(value, i * 4)); return buffer.toString('base64');
};
const nativeTiming = (rate, firstRenderFrame = 0, sourceStartAudioTime = 0) => ({ firstRenderFrame, sourceStartAudioTime, sourceSampleRate: rate });
test('WAV preserves the original floating point samples and rate without regenerating audio', () => {
    const samples = new Float32Array([0, -.0004, .002, -.1, .05]), wav = floatWav(samples, 48000);
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF'); assert.equal(wav.readUInt16LE(20), 3); assert.equal(wav.readUInt32LE(24), 48000);
    assert.deepEqual(decodePCM(wav.subarray(44).toString('base64')), samples);
});
test('source analysis requires all three pitches and a truly silent long gap', () => {
    const samples = syntheticShell(12000, 14); assertShellPCM(samples, 12000, 14);
    const missing = samples.slice(); missing.fill(0, .72 * 12000, 1.3 * 12000);
    assert.throws(() => assertShellPCM(missing, 12000, 14), /strike 3/);
    const hiddenNoise = samples.slice(); hiddenNoise[12000 * 8] = .0001;
    assert.throws(() => assertShellPCM(hiddenNoise, 12000, 14), /silent/);
    const wrong = Float32Array.from(samples, (value, i) => i / 12000 > .72 ? Math.sin(2 * Math.PI * 2700 * i / 12000) * value : value);
    assert.throws(() => assertShellPCM(wrong, 12000, 14), /strike/);
});
test('a free buffer accepts both exact signed zeros but rejects any nonzero endpoint', () => {
    const rate = 12000, samples = Float32Array.from({ length: rate * 6 }, (_, i) => .025 * Math.sin(i * 2 * Math.PI * 1500 / rate));
    samples[0] = 0; samples[samples.length - 1] = -0;
    assertFreePCM(samples, rate, 'brook'); assert(Object.is(samples.at(-1), -0));
    samples[0] = -0; samples[samples.length - 1] = 0; assertFreePCM(samples, rate, 'brook');
    for (const endpoint of [0, samples.length - 1]) {
        const nonzero = samples.slice(); nonzero[endpoint] = 1e-12;
        assert.throws(() => assertFreePCM(nonzero, rate, 'brook'));
    }
});
function syntheticInsectScene(rate, { period = 2, frequency = 2700, missingCycle = -1, continuous = false, insect = true, broadband = false } = {}) {
    let seed = 52917;
    const samples = Float32Array.from({ length: rate * 6 }, (_, i) => {
        const t = i / rate, age = t % period, cycle = Math.floor(t / period);
        // Independent trapezoidal calls, with a low sinusoidal background; this
        // deliberately does not reproduce the app's sin²/FM/chirping formula.
        const pulse = continuous ? 1 : Math.max(0, Math.min((age - .02) / .02, (.62 - age) / .02, 1));
        seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
        const carrier = broadband ? seed / 0xffffffff * 2 - 1 : Math.sin(2 * Math.PI * frequency * t);
        return .002 * Math.sin(2 * Math.PI * 140 * t) + (insect && cycle !== missingCycle ? carrier * pulse * .007 : 0);
    });
    samples[0] = 0; samples[samples.length - 1] = 0; return samples;
}
test('evening acceptance measures its insect band and all three 2-second calls at native sample rates', () => {
    for (const rate of [8000, 12000, 44100, 48000]) {
        const actual = createIslandAmbienceSamples('evening', rate), before = actual.slice();
        const result = assertFreePCM(actual, rate, 'evening');
        assert.deepEqual(actual, before); assert.equal(result.insectEnvelope.periodSeconds, 2);
        assert.deepEqual(result.insectEnvelope.cycles.map(x => x.onset), [0, 2, 4]);
        for (const cycle of result.insectEnvelope.cycles) {
            assert(cycle.callRms > cycle.quietRms * 4);
            assert(cycle.callRms > Math.max(...Object.values(cycle.adjacentRms)) * 2);
        }
    }
    assertFreePCM(syntheticInsectScene(12000), 12000, 'evening');
});
test('insect-band classification rejects absent insects and actual wind or water even when made quiet', () => {
    assert.throws(() => assertFreePCM(syntheticInsectScene(12000, { insect: false }), 12000, 'evening'), /insect band/);
    for (const kind of ['breeze', 'brook']) {
        const actual = createIslandAmbienceSamples(kind, 48000);
        for (const gain of [1, .2]) assert.throws(() => assertFreePCM(Float32Array.from(actual, x => x * gain), 48000, 'evening'));
    }
});
test('an uninterrupted high tone, wrong cadence or missing call cannot impersonate evening insects', () => {
    assert.throws(() => assertFreePCM(syntheticInsectScene(12000, { continuous: true }), 12000, 'evening'), /become quiet/);
    for (const period of [1, 1.5, 2.4, 3, 4]) assert.throws(() => assertFreePCM(syntheticInsectScene(12000, { period }), 12000, 'evening'), /2-second/);
    for (const missingCycle of [0, 1, 2]) assert.throws(() => assertFreePCM(syntheticInsectScene(12000, { missingCycle }), 12000, 'evening'), /every 2-second cycle/);
});
test('periodic broadband noise or adjacent high tones fail even with the expected call windows', () => {
    assert.throws(() => assertFreePCM(syntheticInsectScene(12000, { broadband: true }), 12000, 'evening'), /insect band/);
    for (const frequency of [1900, 3500]) assert.throws(() => assertFreePCM(syntheticInsectScene(12000, { frequency }), 12000, 'evening'), /insect band/);
});
test('delivered-output test rejects silence, missing repeated phrase and an audible phrase gap', () => {
    const rate = 12000, result = new Float32Array(rate * 16), phrase = syntheticShell(rate);
    for (const at of [0, 14]) phrase.forEach((value, i) => { if (at * rate + i < result.length) result[at * rate + i] = value * .35 * Math.min(i / rate / .16, 1); });
    assertDeliveredShell(result, rate, true, phrase, nativeTiming(rate));
    assert.throws(() => assertDeliveredShell(new Float32Array(result.length), rate, true, phrase, nativeTiming(rate)), /silent/);
    const missing = result.slice(); missing.fill(0, 14 * rate); assert.throws(() => assertDeliveredShell(missing, rate, true, phrase, nativeTiming(rate)), /strokes/);
    const gap = result.slice(); gap[7 * rate] = .002; assert.throws(() => assertDeliveredShell(gap, rate, true, phrase, nativeTiming(rate)), /gap/);
});
test('DC pulses cannot impersonate the delivered shell, and a different waveform with the right pitches is rejected', () => {
    const rate = 12000, source = syntheticShell(rate), dc = new Float32Array(rate * 16);
    dc.fill(.003, 0, 1.3 * rate); dc.fill(.003, 14 * rate, 15.3 * rate);
    assert.throws(() => assertDeliveredShell(dc, rate, true, source, nativeTiming(rate)), /actual pitch/);
    const wrongSource = Float32Array.from(source, (value, i) => value + (i < rate * 1.3 ? Math.sin(i * 2 * Math.PI * 1733 / rate) * .008 : 0));
    const delivered = Float32Array.from(wrongSource, (value, i) => value * .35 * Math.min(i / rate / .16, 1));
    assert.throws(() => assertDeliveredShell(delivered, rate, false, source, nativeTiming(rate)), /exact native source/);
    // Leading callback silence changes alignment, not correspondence.
    const delayed = new Float32Array(rate * 3);
    delayed.set(Float32Array.from(source, (value, i) => value * .35 * Math.min(i / rate / .16, 1)), 317);
    assertDeliveredShell(delayed, rate, false, source, nativeTiming(rate, 0, 317 / rate));
});
test('output assembly fails on missing capture blocks instead of calling missing data silent', () => {
    const samples = new Float32Array(1024).fill(.01), blocks = [0, 1, 2].map(i => ({ playbackTime: i * 1024 / 48000, renderFrame: i * 1024, sequence: i, pcm: encoded(samples) }));
    assert.equal(joinOutput(blocks, 48000).length, 3072);
    assert.throws(() => joinOutput([blocks[0], blocks[2]], 48000), /capture gap/);
    assert.throws(() => joinOutput([blocks[0], { ...blocks[1], sequence: 7 }], 48000), /message gap/);
    assert.throws(() => joinOutput(blocks.map(({ renderFrame: _frame, ...block }) => block), 48000), /frame provenance/);
});
test('voice stacking is rejected independently of quiet waveform amplitude', () => {
    assert.equal(assertNoStack([{ startedAt: 1, stopAt: 4 }, { startedAt: 4, disconnectAt: 7 }]), 1);
    assert.throws(() => assertNoStack([{ startedAt: 1, stopAt: 5 }, { startedAt: 4, stopAt: 7 }]), /stacked 2/);
    assert.equal(assertNoStack([{ startedAt: 1, contextClosedAt: 3 }, { startedAt: 4 }]), 1);
});
function boundaryFixture() {
    const rate = 48000, source = { contextId: 'shell-context', outlets: ['shell-outlet'], sampleRate: rate, scheduledStartAudioTime: 512 / rate };
    const firstValidBlock = { messageOrder: 2, at: 20, window: 'preview', renderFrame: 1920, sequence: 0, frameCount: 1024, sampleRate: rate };
    const gap = { contextId: source.contextId, outletId: source.outlets[0], window: null, messageOrder: 1, expectedFrame: 1152, actualFrame: 1920 };
    const blocks = [0, 1].map(sequence => ({ window: 'preview', messageOrder: 2 + sequence, sequence, renderFrame: 1920 + sequence * 1024,
        playbackTime: (1920 + sequence * 1024) / rate, pcm: encoded(new Float32Array(1024).fill(.01)) }));
    return { source, outlet: { id: 'shell-outlet', contextId: source.contextId, portMessageCount: 3, firstValidBlock, discontinuities: [gap], blocks } };
}
test('every discontinuity is retained, and only ordered startup before actual sequence zero can be unmeasured', () => {
    const { source, outlet } = boundaryFixture(), before = structuredClone(outlet);
    const result = assertMeasuredWindow(outlet, 'preview', source); assert.deepEqual(outlet, before);
    assert.deepEqual(result.startupGaps, outlet.discontinuities); assert.equal(result.unmeasuredOnset.frames, 1408);
    assert.equal(result.unmeasuredOnset.seconds, 1408 / 48000); assert.equal(result.measured.firstSequence, 0);
    assert.equal(joinOutput(outlet.blocks, 48000).length, 2048);
    assert.throws(() => assertMeasuredWindow({ ...outlet, contextId: 'learning-context' }, 'preview', source), /context/);
    assert.throws(() => assertMeasuredWindow({ ...outlet, discontinuities: [{ ...outlet.discontinuities[0], outletId: 'another' }] }, 'preview', source), /provenance/);
    assert.throws(() => assertMeasuredWindow({ ...outlet, discontinuities: undefined }, 'preview', source), /history/);
});
test('old evidence without port ordering cannot be reclassified as a successful prefix', () => {
    const { source, outlet } = boundaryFixture();
    for (const mutate of [value => { delete value.portMessageCount; }, value => { delete value.firstValidBlock; },
        value => { delete value.discontinuities[0].messageOrder; }, value => { delete value.blocks[0].messageOrder; }]) {
        const old = structuredClone(outlet); mutate(old); assert.throws(() => assertMeasuredWindow(old, 'preview', source));
    }
});
test('late window delivery cannot disguise post-first gaps, including a jump back before the captured range', () => {
    for (const window of [null, 'earlier', 'preview']) for (const frames of [[2944, 3200], [1152, 1920], [2944, 1024]]) {
        const { source, outlet } = boundaryFixture(); outlet.portMessageCount++;
        outlet.discontinuities.push({ ...outlet.discontinuities[0], window, messageOrder: 4, expectedFrame: frames[0], actualFrame: frames[1] });
        assert.throws(() => assertMeasuredWindow(outlet, 'preview', source), /after the first block|port order/);
    }
});
test('backward, overlapping, unordered and range-crossing pre-first gaps remain failures', () => {
    for (const patch of [{ expectedFrame: 1920, actualFrame: 1152 }, { expectedFrame: 1152, actualFrame: 2048 },
        { messageOrder: 0 }, { messageOrder: 2 }, { expectedFrame: 1152.5 }, { actualFrame: NaN }]) {
        const { source, outlet } = boundaryFixture(); Object.assign(outlet.discontinuities[0], patch);
        assert.throws(() => assertMeasuredWindow(outlet, 'preview', source));
    }
    const { source, outlet } = boundaryFixture(); outlet.firstValidBlock.messageOrder++;
    outlet.blocks.forEach(block => block.messageOrder++); outlet.portMessageCount++;
    outlet.discontinuities.push({ ...outlet.discontinuities[0], messageOrder: 2, expectedFrame: 1500, actualFrame: 1800 });
    assert.throws(() => assertMeasuredWindow(outlet, 'preview', source), /forward unmeasured startup/);
});
test('first-sequence loss or trimming an unmeasured first valid block cannot create a valid capture', () => {
    for (const mutate of [value => { value.firstValidBlock.sequence = 1; }, value => { value.blocks[0].sequence = 1; },
        value => { value.blocks[0].renderFrame += 128; }, value => { value.blocks = [value.blocks[1], { ...value.blocks[1], sequence: 2, messageOrder: 4, renderFrame: 3968 }]; value.portMessageCount = 4; }]) {
        const { source, outlet } = boundaryFixture(); mutate(outlet); assert.throws(() => assertMeasuredWindow(outlet, 'preview', source), /first sequence|first captured block/);
    }
});
test('frame and sequence gaps inside recorded PCM remain strict after accepting a startup prefix', () => {
    for (const patch of [{ renderFrame: 3072, playbackTime: 3072 / 48000 }, { sequence: 2 }]) {
        const { source, outlet } = boundaryFixture(); Object.assign(outlet.blocks[1], patch);
        assertMeasuredWindow(outlet, 'preview', source); assert.throws(() => joinOutput(outlet.blocks, 48000), /capture gap|message gap/);
    }
    const { source, outlet } = boundaryFixture(); outlet.blocks[1].messageOrder++; outlet.portMessageCount++;
    assert.throws(() => assertMeasuredWindow(outlet, 'preview', source), /native port message gap/);
});
test('an absent first strike is not replaced by later valid pitches even when recording otherwise matches its source', () => {
    const rate = 12000, source = syntheticShell(rate), delivered = Float32Array.from(source, (value, i) => value * .35 * Math.min(i / rate / .16, 1));
    delivered.fill(0, 0, Math.floor(.36 * rate));
    assert.throws(() => assertDeliveredShell(delivered, rate, false, source, nativeTiming(rate)), /pitch|strokes/);
});
function timedLoopFixture(offset = 2176) {
    const rate = 48000, source = syntheticShell(rate, 14), sourceStartFrame = 512, firstRenderFrame = sourceStartFrame + offset;
    // Isolated synthetic gain output, not old qualified07 evidence. The prefix
    // never enters this recorded array; no zero filling or PCM repair occurs.
    const recorded = Float32Array.from({ length: 16 * rate }, (_, index) => {
        const sourceFrame = offset + index;
        return source[sourceFrame % source.length] * .35 * Math.min(sourceFrame / rate / .16, 1);
    });
    return { rate, source, recorded, timing: nativeTiming(rate, firstRenderFrame, sourceStartFrame / rate), offset };
}
test('every retained pitch, correspondence, silence and end window uses the same native source clock', () => {
    const { rate, source, recorded, timing, offset } = timedLoopFixture(), before = recorded.slice();
    const result = assertDeliveredShell(recorded, rate, true, source, timing);
    assert.equal(result.timing.sourceOffsetFrames, offset); assert.equal(result.timing.unmeasuredOnsetFrames, offset);
    assert.equal(result.correspondence.length, 2); assert.equal(result.pitches.length, 6);
    for (const [cycle, entry] of result.correspondence.entries()) {
        assert.deepEqual(entry.sourceRange, [Math.floor(.385 * rate), Math.floor(1.12 * rate)]);
        assert.deepEqual(entry.outputRange, [cycle * 14 * rate + Math.floor(.385 * rate) - offset, cycle * 14 * rate + Math.floor(1.12 * rate) - offset]);
        assert(entry.similarity > .999999 && entry.residual < 1e-5); assert(Math.abs(entry.gain - .35) < 1e-6);
    }
    for (const [index, entry] of result.pitches.entries()) {
        const cycle = Math.floor(index / 3), begin = [.05, .41, .77][index % 3];
        assert.deepEqual(entry.sourceRange, [Math.floor(begin * rate), Math.floor((begin + .1) * rate)]);
        assert.deepEqual(entry.outputRange, entry.sourceRange.map(frame => cycle * 14 * rate + frame - offset));
    }
    assert.deepEqual(result.silence.sourceRange, [Math.floor(1.4 * rate), Math.floor(13.9 * rate)]);
    assert.deepEqual(result.silence.outputRange, result.silence.sourceRange.map(frame => frame - offset));
    assert.equal(result.silence.peak, 0);
    assert.equal(result.timing.requiredOutputEndFrame, Math.floor(15.35 * rate) - offset);
    assert.deepEqual(recorded, before); assert.match(result.timing.claim, /unrecorded first attack/);
});
test('raw02 loop prefix positions are missing first-pitch evidence, not proof of an overlapping loop', () => {
    // Timing facts from audio-focused-02: phone 3968-768=3200 frames,
    // tablet 5760-768=4992 frames. PCM here stays explicitly synthetic.
    for (const offset of [3200, 4992]) {
        const { rate, source, recorded, timing } = timedLoopFixture(offset), before = recorded.slice();
        assert.throws(() => assertDeliveredShell(recorded, rate, true, source, timing), /Native pitch\/silence window is outside retained PCM/);
        assert(recorded.slice(Math.floor(1.4 * rate) - offset, Math.floor(13.9 * rate) - offset).every(value => value === 0));
        assert.deepEqual(recorded, before);
    }
});
test('one missing first-pitch sample or final required sample fails without shortening either window', () => {
    const atFirstPitch = timedLoopFixture(Math.floor(.05 * 48000));
    assertDeliveredShell(atFirstPitch.recorded, atFirstPitch.rate, true, atFirstPitch.source, atFirstPitch.timing);
    const missingStart = timedLoopFixture(Math.floor(.05 * 48000) + 1);
    assert.throws(() => assertDeliveredShell(missingStart.recorded, missingStart.rate, true, missingStart.source, missingStart.timing), /outside retained PCM/);
    const { rate, source, recorded, timing, offset } = timedLoopFixture(), end = Math.floor(15.35 * rate) - offset;
    assertDeliveredShell(recorded.slice(0, end), rate, true, source, timing);
    assert.throws(() => assertDeliveredShell(recorded.slice(0, end - 1), rate, true, source, timing), /Native phrase\/gap end is outside retained PCM/);
});
test('the complete native silence window rejects contamination in its first sample that a shifted range misses', () => {
    const { rate, source, recorded, timing, offset } = timedLoopFixture();
    recorded[Math.floor(1.4 * rate) - offset] = .002;
    assert.throws(() => assertDeliveredShell(recorded, rate, true, source, timing), /hidden overlapping loop/);
});
test('one-sample and wrong-sign native offsets fail instead of choosing a better waveform lag', () => {
    const { rate, source, recorded, timing, offset } = timedLoopFixture();
    for (const difference of [-1, 1]) {
        assert.throws(() => assertDeliveredShell(recorded, rate, true, source, { ...timing, firstRenderFrame: timing.firstRenderFrame + difference }), /exact native source/);
    }
    const reversed = nativeTiming(rate, 512, (512 + offset) / rate);
    assert.throws(() => assertDeliveredShell(recorded, rate, true, source, reversed), /exact native source/);
});
test('whole-loop aliases cannot substitute another cycle for either of the two native source windows', () => {
    const { rate, source, recorded, timing } = timedLoopFixture();
    // The signal is genuinely periodic. Only absolute frame provenance and
    // complete measured coverage of both cycles can distinguish these aliases.
    for (const wrong of [
        { ...timing, firstRenderFrame: timing.firstRenderFrame + 14 * rate },
        { ...timing, sourceStartAudioTime: timing.sourceStartAudioTime + 14 },
    ]) assert.throws(() => assertDeliveredShell(recorded, rate, true, source, wrong), /outside retained PCM/);
});
test('unknown, nonfinite, fractional and mismatched native metadata fail rather than falling back to signal alignment', () => {
    const { rate, source, recorded, timing } = timedLoopFixture();
    for (const invalid of [undefined, null, {}, { ...timing, sourceSampleRate: 44100 }, { ...timing, firstRenderFrame: NaN },
        { ...timing, firstRenderFrame: -1 }, { ...timing, firstRenderFrame: 1.5 }, { ...timing, sourceStartAudioTime: Infinity },
        { ...timing, sourceStartAudioTime: -1 }, { ...timing, sourceStartAudioTime: (512 + .25) / rate },
        { ...timing, sourceStartAudioTime: Number.MAX_SAFE_INTEGER }, { ...timing, arbitraryLag: -4480 }]) {
        assert.throws(() => assertDeliveredShell(recorded, rate, true, source, invalid), /native|Native/);
    }
    const tinyConversionNoise = { ...timing, sourceStartAudioTime: (512 + 1e-8) / rate };
    assert.equal(assertDeliveredShell(recorded, rate, true, source, tinyConversionNoise).timing.sourceStartFrame, 512);
});
test('a missing source correspondence interval cannot be borrowed from another measured interval or padded', () => {
    const { rate, source, recorded, timing } = timedLoopFixture();
    const truncated = recorded.slice(0, Math.floor(14.5 * rate));
    assert.throws(() => assertDeliveredShell(truncated, rate, true, source, timing), /outside retained PCM/);
    const afterCorrespondenceBegins = { ...timing, firstRenderFrame: 512 + Math.floor(.385 * rate) + 1 };
    assert.throws(() => assertDeliveredShell(recorded, rate, true, source, afterCorrespondenceBegins), /outside retained PCM/);
});
test('native hidden must interrupt a live phrase, not receive credit for its earlier natural end', () => {
    const hidden = { type: 'visibility', at: 1500, hidden: true, state: 'hidden' };
    const source = { startedAt: 1000, duration: 2, loop: false, stopAt: 1501, disconnectAt: 1502 };
    assertHiddenRetirement(source, hidden);
    assert.throws(() => assertHiddenRetirement({ ...source, stopAt: 1400 }, hidden), /after native hidden/);
    assert.throws(() => assertHiddenRetirement({ ...source, stopAt: 4001, disconnectAt: 4002 }, { ...hidden, at: 4000 }), /ended before/);
    assert.throws(() => assertHiddenRetirement(source, { ...hidden, hidden: false }));
});
test('a one-shot started and ended inside restore is detected using the still-hidden baseline', () => {
    const hidden = { sources: [{ id: 'old', endedAt: 20 }] };
    assertNoPreviewResume(hidden, structuredClone(hidden));
    const afterRestore = { sources: [...hidden.sources, { id: 'illegal-resume', startedAt: 21, endedAt: 22 }] };
    assert.throws(() => assertNoPreviewResume(hidden, afterRestore), /during restore/);
});
function tables() {
    const expression = { version: 1, ownedItemIds: ['shell-three-notes'], selection: { soundscape: 'shell-three-notes', other: ['keep'] } };
    return { profiles: [{ id: 'a', soundEnabled: true }, { id: 'b', soundEnabled: false }], appData: [{ id: 'app', activeProfileId: 'a', profiles: {
        a: { id: 'a', soundEnabled: true }, b: { id: 'b', soundEnabled: false } } }],
        islands: [{ profileId: 'a', revision: 8, updatedAt: 1, expression, items: [{ id: 'keep' }], pendingPlanId: 'plan',
            customization: { points: 71 }, growth: { discoveries: ['bell-is-not-a-discovery-fixture'] } }], islandEvents: [],
        islandPlans: [{ id: 'plan', status: 'active', revision: 3 }], islandPhotoBlobs: [{ id: 'photo', bytes: 180, sha256: 'unchanged-fixture' }] };
}
test('global mute retains the collected selection; same free off clears it with exactly one experience receipt', () => {
    const before = tables(), muted = structuredClone(before); muted.profiles[0].soundEnabled = false; muted.appData[0].profiles.a.soundEnabled = false;
    assertSoundDelta(before, muted, 'a', { type: 'profile-sound', enabled: false });
    const bad = structuredClone(muted); bad.islands[0].expression.selection.soundscape = null;
    assert.throws(() => assertSoundDelta(before, bad, 'a', { type: 'profile-sound', enabled: false }));
    const after = structuredClone(before), item = after.islands[0]; item.revision++; item.updatedAt = 2;
    item.expression.selection.soundscape = null; item.experience = { version: 1, islandName: 'わたしの しま', emblem: 'leaf', ambience: 'off',
        residents: { otter: { name: 'カワウソ', look: 'original' }, rabbit: { name: 'ウサギ', look: 'original' }, fox: { name: 'キツネ', look: 'original' } }, layouts: [] };
    const action = { type: 'ambience', ambience: 'off' };
    after.islandEvents.push({ id: '["island-experience-v1","a",8]', profileId: 'a', type: 'experience_changed', timestamp: 2, action });
    assertSoundDelta(before, after, 'a', action);
    for (const mutate of [data => data.islandPhotoBlobs[0].sha256 = 'corrupt', data => data.islandPlans[0].revision++, data => data.islands[0].customization.points--,
        data => data.profiles[1].soundEnabled = true, data => data.islandEvents.push({ id: 'unexpected' })]) {
        const corrupt = structuredClone(after); mutate(corrupt); assert.throws(() => assertSoundDelta(before, corrupt, 'a', action));
    }
});

// This fake implements native graph overloads and exceptions independently of
// the probe. It does not emulate browser rendering or provide acoustic proof.
const nativeFixture = `
  let clock = 1; const performance = { now: () => clock++ };
  class Target {
    constructor() { this.handlers = new Map(); }
    addEventListener(type, fn) { const set = this.handlers.get(type) ?? new Set(); set.add(fn); this.handlers.set(type, set); }
    removeEventListener(type, fn) { this.handlers.get(type)?.delete(fn); }
    emit(type, data = {}) { for (const fn of [...(this.handlers.get(type) ?? [])]) fn({type, ...data}); }
  }
  const nativeFailure = new Error('native failure'), stopReturn = {}, disconnectReturn = {};
  class AudioNode extends Target {
    constructor(context) { super(); this.context = context; this.edges = []; this.disconnectCalls = []; }
    connect(destination, output = 0, input = 0) {
      if (this.failConnect) throw nativeFailure;
      if (!this.edges.some(e => e.destination === destination && e.output === output && e.input === input)) this.edges.push({destination, output, input});
      return destination;
    }
    disconnect(...args) {
      this.disconnectCalls.push(args); if (this.failDisconnect) throw nativeFailure;
      this.edges = this.edges.filter(e => {
        if (!args.length) return false;
        if (typeof args[0] === 'number') return e.output !== args[0];
        return !(e.destination === args[0] && (args.length < 2 || args[1] === e.output) && (args.length < 3 || args[2] === e.input));
      }); return disconnectReturn;
    }
  }
  class AudioBufferSourceNode extends AudioNode {
    start(...args) { if (this.failStart) throw nativeFailure; this.startArgs = args; return this; }
    stop(...args) { this.stopCalls = (this.stopCalls ?? 0) + 1; if (this.failStop) throw nativeFailure; this.stopArgs = args; return stopReturn; }
  }
  class AudioWorkletNode extends AudioNode {
    constructor(context) { super(context); context.processors.push(this); this.port = {onmessage:null,closed:false,close(){this.closed=true;}}; }
  }
  const moduleSources = [], revoked = [];
  class Blob { constructor(parts) { this.source = parts.join(''); } }
  const URL = {createObjectURL(blob){moduleSources.push(blob.source);return 'blob:' + moduleSources.length;},revokeObjectURL(url){revoked.push(url);}};
  class AudioContext extends Target {
    constructor() { super(); this.sampleRate = 12000; this.currentTime = 0; this.state = 'running'; this.destination = new AudioNode(this); this.processors = [];
      this.audioWorklet = {addModule: () => ({then: success => { if(this.deferModule) this.resolveModule = success; else success(); }})}; }
    createGain() { const node = new AudioNode(this); node.gain = { value: 1 }; return node; }
    createScriptProcessor() { const node = new AudioNode(this); this.processors.push(node); return node; }
    close(...args) {
      this.closeCalls = (this.closeCalls ?? 0) + 1; if (this.failClose) throw nativeFailure;
      this.closeArgs = args; this.state = 'closed'; this.emit('statechange'); this.closePromise = Promise.resolve(); return this.closePromise;
    }
  }
  const window = new Target(), document = new Target(); Object.assign(document, {hidden: false, visibilityState: 'visible', hasFocus: () => true});
  const encodedLengths = [];
  const navigator = { userActivation: { isActive: true } }, btoa = value => { encodedLengths.push(value.length); return Buffer.from(value, 'binary').toString('base64'); };
  (${installProbeInDocument.toString()})();
  const probe = window.__expressionAudioProbe;
  function makeSource(context, seconds = 2) { const source = new AudioBufferSourceNode(context); source.loop = false;
    const values = seconds === 2 ? signal : new Float32Array(Math.round(seconds * 12000));
    source.buffer = { getChannelData: () => values, sampleRate: 12000, length: values.length, numberOfChannels: 1, duration: seconds }; return source; }
  function block(processor, at, input = signal.slice(0, 1024)) {
    processor.port.onmessage?.({data:{type:'block',frame:Math.round(at*12000),sequence:processor.sequence??0,sampleRate:12000,samples:new Float32Array(input)}});
    processor.sequence=(processor.sequence??0)+1; return new Float32Array(input.length);
  }
`;
const runNative = async source => {
    const sandbox = { Buffer, signal: syntheticShell(12000) };
    const result = await vm.runInNewContext(`${nativeFixture}\n(async () => { ${source} })()`, sandbox);
    return JSON.parse(JSON.stringify(result));
};
test('passive tap retains original connections/arguments/buffer and copies the same-context input', async () => {
    const result = await runNative(`
      const context = new AudioContext(), source = makeSource(context), gain = context.createGain();
      const connectResult = source.connect(gain); gain.connect(context.destination);
      const processor = context.processors[0], silent = processor.edges[0].destination;
      const original = source.edges[0].destination === gain && gain.edges.some(e => e.destination === context.destination);
      probe.begin('passive'); const startResult = source.start(.1);
      const rendered = block(processor, .1); const sameBuffer = source.buffer.getChannelData(0) === signal;
      const stopResult = source.stop(), disconnectResult = source.disconnect(); gain.disconnect(); const close = context.close(); await close;
      const data = probe.snapshot(true); probe.dispose();
      return {data, original, sameBuffer, startArgs: source.startArgs, returns: connectResult === gain && startResult === source && stopResult === stopReturn && disconnectResult === disconnectReturn && close === context.closePromise,
        silentGain: silent.gain.value, outputSilence: [...rendered].every(x => x === 0), disposed: probe.snapshot().live};
    `);
    assert.deepEqual(result.data.errors, []); assert(result.original && result.sameBuffer && result.returns && result.outputSilence);
    assert.equal(result.silentGain, 0); assert.deepEqual(result.startArgs, [.1]);
    const source = result.data.sources[0], output = result.data.outputs[0]; assert(source.ambienceCandidate);
    assert.equal(source.contextId, output.contextId); assert.deepEqual(source.outlets, [output.id]);
    assert(source.stopAt && source.disconnectAt); assert.equal(result.data.contexts[0].state, 'closed');
    assert.deepEqual(decodePCM(output.blocks[0].pcm), syntheticShell(12000).slice(0, 1024));
    assertOutletIsolation(source, output, output.blocks);
    assert.deepEqual(result.disposed, { taps: 0, edges: 0, contexts: 0, sourceListeners: 0, disposed: true });
});
test('event overflow never prevents native stop/disconnect/close or changes their returns and exceptions', async () => {
    const result = await runNative(`
      const context = new AudioContext(), source = makeSource(context), gain = context.createGain(); source.connect(gain); gain.connect(context.destination); source.start();
      for (let i = 0; i < 20020; i++) window.emit('pointerdown', {isTrusted: true});
      const goodStop = source.stop() === stopReturn, goodDisconnect = source.disconnect() === disconnectReturn;
      source.failStop = true; let stopException; try { source.stop(); } catch (e) { stopException = e === nativeFailure; }
      gain.failDisconnect = true; let disconnectException; try { gain.disconnect(); } catch (e) { disconnectException = e === nativeFailure; }
      gain.failDisconnect = false; gain.disconnect();
      source.emit('ended'); document.hidden = true; document.visibilityState = 'hidden'; document.emit('visibilitychange');
      const promise = context.close(), promisePreserved = promise === context.closePromise; await promise;
      context.failClose = true; let closeException; try { context.close(); } catch (e) { closeException = e === nativeFailure; }
      const data = probe.snapshot(); probe.dispose();
      return {data, goodStop, goodDisconnect, stopException, disconnectException, closeException, promisePreserved, stopCalls: source.stopCalls, closeCalls: context.closeCalls};
    `);
    for (const key of ['goodStop', 'goodDisconnect', 'stopException', 'disconnectException', 'closeException', 'promisePreserved']) assert.equal(result[key], true, key);
    assert.equal(result.stopCalls, 2); assert.equal(result.closeCalls, 2);
    assert.equal(result.data.events.length, 20000); assert.deepEqual(result.data.errors, ['Audio probe event bound exceeded']);
    assert(result.data.sources[0].stopAt && result.data.sources[0].disconnectAt && result.data.sources[0].endedAt);
    assert(result.data.contexts[0].closedAt && result.data.contexts[0].closeCalledAt); assert.equal(result.data.live.taps, 0);
});
test('real-answer cue history can exceed 256 sources, while the finite source cap still cannot block native playback or close', async () => {
    const result = await runNative(`
      const context = new AudioContext();
      for (let i = 0; i < 153 * 4; i++) { const source = makeSource(context, .001); source.start(); source.emit('ended'); }
      const qualified = probe.snapshot(); let nativeStarts = qualified.sources.length;
      for (let i = nativeStarts; i <= qualified.limits.sources; i++) { const source = makeSource(context, .001); if (source.start() === source) nativeStarts++; source.emit('ended'); }
      await context.close(); const final = probe.snapshot(); probe.dispose(); return {qualifiedCount: qualified.sources.length, qualifiedErrors: qualified.errors, nativeStarts, final};
    `);
    assert.equal(result.qualifiedCount, 612); assert.deepEqual(result.qualifiedErrors, []);
    assert.equal(result.nativeStarts, 2049); assert.equal(result.final.sources.length, 2048);
    assert.deepEqual(result.final.errors, ['Error: Audio probe source bound exceeded']);
    assert.equal(result.final.contexts[0].state, 'closed'); assert.equal(result.final.live.sourceListeners, 0);
});
test('targeted detach and gain reconnection create a fresh tap, close old routes and release every owned node', async () => {
    const result = await runNative(`
      const context = new AudioContext(), source = makeSource(context), gain = context.createGain(); source.connect(gain); gain.connect(context.destination); source.start(); probe.begin('routes');
      block(context.processors[0], .02); context.currentTime = .2; gain.disconnect(context.destination);
      const detached = probe.snapshot(), oldReleased = context.processors[0].port.onmessage === null && context.processors[0].edges.length === 0;
      gain.connect(context.destination); const reconnected = probe.snapshot(); block(context.processors[1], .22);
      context.currentTime = .4; source.disconnect(gain); block(context.processors[1], .8); const sourceDetached = probe.snapshot();
      source.connect(gain); context.currentTime = .9; gain.disconnect(0); const outputDetached = probe.snapshot();
      gain.connect(context.destination); await context.close(); const closed = probe.snapshot(); probe.dispose();
      return {detached, reconnected, sourceDetached, outputDetached, closed, oldReleased, processorsReleased: context.processors.every(p => p.port.onmessage === null && p.edges.length === 0)};
    `);
    assert.deepEqual(result.closed.errors, []); assert(result.oldReleased && result.processorsReleased);
    assert.equal(result.detached.live.taps, 0); assert.equal(result.detached.live.edges, 1);
    assert.equal(result.reconnected.live.taps, 1); assert.equal(result.reconnected.outputs.length, 2);
    assert.notEqual(result.reconnected.outputs[0].id, result.reconnected.outputs[1].id);
    assert(result.reconnected.outputs[0].releasedAt); assert.equal(result.reconnected.outputs[1].releasedAt, null);
    assert.equal(result.sourceDetached.sources[0].routes.at(-1).endAudioTime, .4);
    assert.deepEqual(result.sourceDetached.outputs[1].blocks.at(-1).sourceIds, []);
    assert.equal(result.outputDetached.live.taps, 0); assert.equal(result.closed.live.edges, 0); assert.equal(result.closed.live.contexts, 0);
});
test('disconnect output/input overloads remove only the actual matching route and native failures leave it intact', async () => {
    const result = await runNative(`
      const context = new AudioContext(), source = makeSource(context), gain = context.createGain(); source.connect(gain, 0, 0); source.connect(gain, 1, 0); gain.connect(context.destination); source.start();
      source.failDisconnect = true; try { source.disconnect(gain); } catch {} const failed = probe.snapshot(); source.failDisconnect = false;
      source.disconnect(gain, 0, 0); const one = probe.snapshot(); source.disconnect(1); const none = probe.snapshot();
      gain.disconnect(1); const wrongOutput = probe.snapshot(); gain.disconnect(context.destination, 0, 0); const final = probe.snapshot(); probe.dispose();
      return {failed, one, none, wrongOutput, final};
    `);
    assert.deepEqual(result.final.errors, []); assert.equal(result.failed.live.edges, 3); assert.equal(result.one.live.edges, 2);
    assert.equal(result.one.sources[0].routes[0].endAudioTime, null); assert.notEqual(result.none.sources[0].routes[0].endAudioTime, null);
    assert.equal(result.wrongOutput.live.taps, 1); assert.equal(result.final.live.taps, 0); assert.equal(result.final.live.edges, 0);
});
test('same-outlet unclassified source is detected even when it disconnects before the output callback', async () => {
    const result = await runNative(`
      const context = new AudioContext(), expected = makeSource(context), shortCue = makeSource(context, .1), gain = context.createGain();
      expected.connect(gain); gain.connect(context.destination); expected.start(); probe.begin('mixed');
      context.currentTime = .02; shortCue.connect(gain); shortCue.start(); context.currentTime = .08; shortCue.disconnect(gain);
      block(context.processors[0], .04); const data = probe.snapshot(true); probe.dispose(); return data;
    `);
    assert.deepEqual(result.errors, []); assert.equal(result.sources[1].ambienceCandidate, false);
    const output = result.outputs[0]; assert.deepEqual(output.blocks[0].sourceIds, result.sources.map(source => source.id));
    assert.throws(() => assertOutletIsolation(result.sources[0], output, output.blocks), /Another native source/);
});
test('repeated connect/disconnect does not retain released processors or live graph paths', async () => {
    const result = await runNative(`
      const context = new AudioContext(), gain = context.createGain();
      for (let i = 0; i < 40; i++) { gain.connect(context.destination); gain.disconnect(context.destination); }
      const data = probe.snapshot(), nativeEdges = gain.edges.length; probe.dispose();
      return {data, nativeEdges, released: context.processors.every(p => p.port.onmessage === null && p.edges.length === 0)};
    `);
    assert.deepEqual(result.data.errors, []); assert.equal(result.data.live.taps, 0); assert.equal(result.data.live.edges, 0);
    assert.equal(result.nativeEdges, 0); assert(result.released); assert.equal(result.data.outputs.length, 40);
    assert(result.data.outputs.every(output => output.releasedAt));
});

test('late worklet loading never delays native playback or reconnects a released destination', async () => {
    const result = await runNative(`
      const context = new AudioContext(); context.deferModule = true;
      const source = makeSource(context), gain = context.createGain(); source.connect(gain);
      const nativeResult = gain.connect(context.destination); const played = source.start() === source;
      const before = {processors:context.processors.length, direct:gain.edges.some(e=>e.destination===context.destination),data:probe.snapshot()};
      gain.disconnect(); await context.close(); context.resolveModule();
      const after = probe.snapshot(); probe.dispose(); return {before,after,played,nativeResult:nativeResult===context.destination,processors:context.processors.length,revoked};
    `);
    assert(result.played && result.nativeResult && result.before.direct);
    assert.equal(result.before.processors, 0); assert.equal(result.processors, 0);
    assert.equal(result.after.live.taps, 0); assert.deepEqual(result.after.errors, []); assert.equal(result.revoked.length, 1);
});
test('asynchronous worklet readiness attaches only the passive branch without touching the existing source', async () => {
    const result = await runNative(`
      const context = new AudioContext(); context.deferModule = true;
      const source = makeSource(context), gain = context.createGain(); source.connect(gain); gain.connect(context.destination); source.start(); probe.begin('late');
      context.currentTime=.04; context.resolveModule(); block(context.processors[0],.04);
      const data = probe.snapshot(true), sourceEdges=source.edges.length, direct=gain.edges.filter(e=>e.destination===context.destination).length;
      probe.dispose(); return {data,sourceEdges,direct,startArgs:source.startArgs,revoked};
    `);
    assert.deepEqual(result.data.errors, []); assert.equal(result.sourceEdges,1); assert.equal(result.direct,1);
    assert.deepEqual(result.startArgs, []); assert.equal(result.data.outputs[0].readyAudioTime,.04);
    assert.equal(result.data.outputs[0].blocks[0].renderFrame,480); assert.equal(result.revoked.length,1);
});
test('source start copies original bits but defers long PCM encoding until the first real render block', async () => {
    const result = await runNative(`
      const context = new AudioContext(); context.deferModule = true;
      const source = makeSource(context,14), values = source.buffer.getChannelData(0), gain = context.createGain(); values.set(signal);
      source.connect(gain); gain.connect(context.destination); probe.begin('capture');
      const returned = source.start(.125) === source;
      const before = {data:probe.snapshot(),encoded:[...encodedLengths]};
      values.fill(0); const polled = {data:probe.snapshot(),encoded:[...encodedLengths]};
      context.resolveModule(); const readyEncoded = [...encodedLengths];
      block(context.processors[0],.125);
      const after = probe.snapshot(true); source.stop(); gain.disconnect(); await context.close(); probe.dispose();
      return {before,polled,readyEncoded,after,returned,args:source.startArgs,encodedLengths};
    `);
    assert(result.returned); assert.deepEqual(result.args, [.125]);
    assert.deepEqual(result.before.encoded, []); assert.deepEqual(result.polled.encoded, []); assert.deepEqual(result.readyEncoded, []);
    assert.equal(result.before.data.pcm.length, 0); assert.equal(result.polled.data.pcm.length, 0);
    assert.equal(result.before.data.sources[0].pcmCapture.state, 'pending');
    assert.deepEqual(result.after.errors, []); assert.equal(result.after.sources[0].pcmCapture.finalizedBy, 'first-render-block');
    assert(result.after.sources[0].ambienceCandidate);
    const expected = new Float32Array(14 * 12000); expected.set(syntheticShell(12000));
    assert.deepEqual(decodePCM(result.after.pcm[0].base64), expected, 'later app buffer mutation cannot change the once-copied source');
    assert.deepEqual(result.encodedLengths, [1024 * 4, 14 * 12000 * 4]);
    assert(result.after.sources[0].pcmCapture.finalizedAt > result.after.outputs[0].firstValidBlock.at);
});
test('a source retired before sampler readiness retains its copied PCM for explicit raw evidence without resurrecting audio', async () => {
    const result = await runNative(`
      const context = new AudioContext(); context.deferModule = true;
      const source = makeSource(context), gain=context.createGain(); source.connect(gain);gain.connect(context.destination);source.start();
      signal.fill(0); source.stop();gain.disconnect();await context.close();context.resolveModule();
      const before={data:probe.snapshot(),encoded:[...encodedLengths],processors:context.processors.length};
      const raw=probe.snapshot(true);probe.dispose();return {before,raw,processors:context.processors.length};
    `);
    assert.deepEqual(result.before.encoded, []); assert.equal(result.before.data.sources[0].pcmCapture.state, 'pending');
    assert.equal(result.processors, 0); assert.deepEqual(result.raw.errors, []);
    assert.equal(result.raw.sources[0].pcmCapture.finalizedBy, 'raw-snapshot');
    assert.deepEqual(decodePCM(result.raw.pcm[0].base64), syntheticShell(12000));
    assert(result.raw.sources[0].stopAt); assert.equal(result.raw.contexts[0].state, 'closed');
});
test('deferred exact deduplication still preserves source identities and never borrows a later mutated buffer', async () => {
    const result = await runNative(`
      const context = new AudioContext(), source = makeSource(context), gain=context.createGain();source.connect(gain);gain.connect(context.destination);source.start();source.stop();
      const next=makeSource(context);next.connect(gain);next.start();signal.fill(0);
      const before=probe.snapshot();block(context.processors[0],0);const after=probe.snapshot(true);next.stop();gain.disconnect();await context.close();probe.dispose();return {before,after};
    `);
    assert.equal(result.before.pcm.length, 0); assert.equal(result.before.sources.length, 2);
    assert.equal(result.after.pcm.length, 1); assert.equal(result.after.sources[0].pcmId, result.after.sources[1].pcmId);
    assert.notEqual(result.after.sources[0].id, result.after.sources[1].id);
    assert.deepEqual(decodePCM(result.after.pcm[0].base64), syntheticShell(12000));
});
test('the pending PCM budget is reserved before copying and cannot prevent native playback or retirement', async () => {
    const result = await runNative(`
      const context=new AudioContext(),source=makeSource(context,14);let bufferRead=false;
      source.buffer.getChannelData=()=>({byteLength:128*1024*1024+4,get buffer(){bufferRead=true;throw Error('must not allocate');}});
      const returned=source.start()===source;const stopped=source.stop()===stopReturn;await context.close();const data=probe.snapshot(true);probe.dispose();return {returned,stopped,bufferRead,data};
    `);
    assert(result.returned && result.stopped); assert.equal(result.bufferRead, false);
    assert.deepEqual(result.data.errors, ['Error: Audio probe PCM bound exceeded']);
    assert.equal(result.data.pcm.length, 0); assert.equal(result.data.contexts[0].state, 'closed');
});
test('the probe keeps unmeasured gaps through later windows and snapshots without suppressing measured gaps', async () => {
    const result = await runNative(`
      const context=new AudioContext(),gain=context.createGain();gain.connect(context.destination);
      const processor=context.processors[0],gap=()=>processor.port.onmessage({data:{type:'gap',expectedFrame:128,actualFrame:0}});
      gap(); const first=probe.snapshot(); probe.begin('preview'); gap(); probe.end();
      const later=probe.snapshot(); processor.port.onmessage({data:{type:'gap',expectedFrame:NaN,actualFrame:0}});
      const malformed=probe.snapshot(); probe.dispose(); return {first,later,malformed};
    `);
    assert.deepEqual(result.first.errors,[]); assert.deepEqual(result.later.errors,[]);
    assert.deepEqual(result.first.outputs[0].discontinuities.map(g=>g.window),[null]);
    assert.deepEqual(result.later.outputs[0].discontinuities.map(g=>g.window),[null,'preview']);
    assert.equal(result.later.events.filter(e=>e.type==='render-gap').length,2);
    assert.deepEqual(result.malformed.errors,['Error: Malformed render discontinuity']);
});
test('malformed blocks outside a measurement remain fatal through later valid windows without changing native operations', async () => {
    for (const invalid of ['frame:NaN', 'frame:-1', 'sequence:NaN', 'sequence:-1', 'sampleRate:48000',
        'samples:new Float32Array(1023)', 'samples:Array(1024).fill(0)']) {
        const result = await runNative(`
          const context=new AudioContext(),source=makeSource(context),gain=context.createGain();
          source.connect(gain);gain.connect(context.destination);const sameStart=source.start(.02)===source;
          const processor=context.processors[0];block(processor,0);
          processor.port.onmessage({data:{type:'block',frame:0,sequence:0,sampleRate:12000,samples:new Float32Array(1024),${invalid}}});
          const first=probe.snapshot();probe.begin('after-malformed');block(processor,.1);probe.end();const later=probe.snapshot();
          const sameStop=source.stop(.2)===stopReturn,sameDisconnect=gain.disconnect(context.destination)===disconnectReturn;
          const closing=context.close();await closing;const final=probe.snapshot();probe.dispose();
          return {first,later,final,sameStart,sameStop,sameDisconnect,sameClose:closing===context.closePromise,
            startArgs:source.startArgs,stopArgs:source.stopArgs,closeCalls:context.closeCalls};
        `);
        assert.deepEqual(result.first.errors, ['Error: Malformed render block'], invalid);
        assert.deepEqual(result.later.errors, result.first.errors, invalid); assert.deepEqual(result.final.errors, result.first.errors, invalid);
        assert.equal(result.first.outputs[0].blocks.length, 0, invalid); assert.deepEqual(result.first.windows, [], invalid);
        assert.equal(result.later.outputs[0].blocks.length, 1, invalid);
        assert.equal(result.later.outputs[0].blocks[0].window, 'after-malformed', invalid);
        assert.equal(result.later.outputs[0].blocks[0].renderFrame, 1200, invalid);
        assert(result.sameStart && result.sameStop && result.sameDisconnect && result.sameClose, invalid);
        assert.deepEqual(result.startArgs, [.02], invalid); assert.deepEqual(result.stopArgs, [.2], invalid); assert.equal(result.closeCalls, 1, invalid);
    }
});
test('unknown or missing worklet message types are global errors both outside and inside a measurement', async () => {
    for (const active of [false, true]) for (const [message, expected] of [
        ["{type:'unexpected'}", 'Error: Unknown render message type: unexpected'],
        ['{}', 'Error: Unknown render message type: undefined'],
        ['null', 'Error: Malformed render message'],
    ]) {
        const result = await runNative(`
          const context=new AudioContext(),gain=context.createGain();gain.connect(context.destination);
          if(${active})probe.begin('active');const processor=context.processors[0];
          processor.port.onmessage({data:${message}});const first=probe.snapshot();
          if(${active})probe.end();probe.begin('later');block(processor,.1);probe.end();const later=probe.snapshot();
          await context.close();probe.dispose();return {first,later};
        `);
        assert.deepEqual(result.first.errors, [expected]); assert.deepEqual(result.later.errors, [expected]);
        assert.equal(result.first.outputs[0].blocks.length, 0); assert.equal(result.later.outputs[0].blocks[0].window, 'later');
    }
});
test('serialized render processor retains each sample and frame independently of main-thread delivery timing', async () => {
    const source = await runNative(`const context=new AudioContext();context.createGain().connect(context.destination);const source=moduleSources[0];probe.dispose();return source;`);
    let Processor;
    const sent = [], realm = {currentFrame:128, sampleRate:48000, Float32Array,
        AudioWorkletProcessor:class {constructor(){this.port={postMessage:value=>sent.push(structuredClone(value))};}},
        registerProcessor:(_name,value)=>{Processor=value;}};
    vm.runInNewContext(source, realm); const processor=new Processor();
    const input = Float32Array.from({length:2048},(_,i)=>Math.sin(i/9)*.03), observed=[];
    for(let i=0;i<input.length;i+=128){realm.currentFrame=128+i; const output=new Float32Array(128).fill(1);
        assert.equal(processor.process([[input.slice(i,i+128)]],[[output]]),true); observed.push(...output);}
    assert(observed.every(value=>value===0)); assert.equal(sent.length,2);
    const blocks=sent.map((block,index)=>({renderFrame:block.frame,sequence:block.sequence,playbackTime:block.frame/48000,
        at:index?5000:10,pcm:encoded(block.samples)}));
    assert.deepEqual(joinOutput(blocks,48000),input);
    realm.currentFrame+=256; processor.process([[new Float32Array(128)]],[[new Float32Array(128)]]);
    assert.equal(sent.at(-1).type,'gap'); assert.equal(sent.at(-1).actualFrame-sent.at(-1).expectedFrame,128);
});

test('every analysis failure retains raw PCM/events/DB and a failed report before rethrowing the original cause', async () => {
    const output = await fs.mkdtemp(path.join(os.tmpdir(), 'expression-audio-evidence-'));
    try {
        const raw = { sources: [{ id: 'real-source' }], pcm: [{ base64: encoded(new Float32Array([.003, .003])) }],
            outputs: [{ blocks: [{ playbackTime: 0, pcm: encoded(new Float32Array([.003])) }] }], events: [{ type: 'stop', at: 3 }], errors: ['overflow'] };
        const savedDB = tables(), report = { status: 'running' }, error = new Error('pitch failed');
        await assert.rejects(withAudioFailureEvidence(async () => { throw error; }, { output, name: 'phone', report, readProbe: async () => raw, readTables: async () => savedDB }), value => value === error);
        const diskReport = JSON.parse(await fs.readFile(path.join(output, 'report.json'))), evidence = JSON.parse(await fs.readFile(path.join(output, diskReport.evidence[0].file)));
        assert.equal(diskReport.status, 'failed'); assert.match(diskReport.failure, /pitch failed/);
        assert.deepEqual(evidence.probe, raw); assert.deepEqual(evidence.tables, savedDB);
        // A closed/lost document cannot yield new PCM; prior checkpoint survives,
        // the failure report explicitly records both unavailable collectors.
        await assert.rejects(withAudioFailureEvidence(async () => { throw new Error('page vanished'); }, {
            output, name: 'phone', report, readProbe: () => { throw new Error('closed page'); }, readTables: async () => { throw new Error('closed DB'); } }), /page vanished/);
        const later = JSON.parse(await fs.readFile(path.join(output, 'report.json'))), missing = JSON.parse(await fs.readFile(path.join(output, later.evidence.at(-1).file)));
        assert.equal(missing.collectionErrors.length, 2); assert.deepEqual(JSON.parse(await fs.readFile(path.join(output, later.evidence[0].file))).probe, raw);
    } finally { await fs.rm(output, { recursive: true, force: true }); }
});
test('failed entry prerequisites and validator failures after a checkpoint also produce reviewable evidence', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'expression-audio-entry-')), output = path.join(directory, 'phone');
    try {
        const raw = { version: 'wrong-probe', sources: [], pcm: [], outputs: [], events: [], errors: [] };
        const page = { locator: () => ({ getAttribute: async () => 'fixed' }), evaluate: async fn => String(fn).includes('?.version') ? 'wrong-probe' : raw };
        await assert.rejects(createExpressionAudioPhase({ page, owner: 'a', name: 'phone', output, provenance: { revision: 'fixed', sourceHash: 'hash', qaClosureHash: 'qa' }, tables: async () => tables() }), /Install probe/);
        const entry = JSON.parse(await fs.readFile(path.join(output, 'report.json'))); assert.equal(entry.status, 'failed'); assert.equal(entry.evidence.length, 1);
        const corrupt = tables(); corrupt.islandPlans[0].revision++;
        const report = { status: 'running' }, options = { output, name: 'tablet', report, readProbe: async () => raw, readTables: async () => corrupt };
        await assert.rejects(withAudioFailureEvidence(async () => {
            await persistAudioEvidence({ ...options, label: 'before-analysis' });
            assertSoundDelta(tables(), corrupt, 'a');
        }, options), /cannot change/);
        const failed = JSON.parse(await fs.readFile(path.join(output, 'report.json'))); assert.equal(failed.status, 'failed'); assert.equal(failed.evidence.length, 2);
        const evidence = JSON.parse(await fs.readFile(path.join(output, 'tablet-before-analysis-raw-evidence.json')));
        assert.deepEqual(evidence.tables, corrupt);
    } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
test('public save persists a diagnostic FAIL and may collect again without erasing the failure or earlier raw evidence', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'expression-audio-save-')), output = path.join(directory, 'phone');
    try {
        const raw = { version: 'expression-audio-probe-worklet-v5', sources: [], pcm: [], outputs: [], events: [], errors: [] };
        const db = tables(); db.islands[0].workshop = { creations: [{ partId: 'bell' }] };
        const page = { locator: () => ({ getAttribute: async attribute => attribute === 'data-mode' ? 'expression' : 'fixed' }),
            evaluate: async fn => String(fn).includes('?.version') ? raw.version : structuredClone(raw) };
        const phase = await createExpressionAudioPhase({ page, owner: 'a', name: 'phone', output,
            provenance: { revision: 'fixed', sourceHash: 'hash', qaClosureHash: 'qa' }, tables: async () => structuredClone(db) });
        raw.errors.push('PCM budget exceeded'); raw.pcm.push({ base64: 'broken-but-retained' });
        await assert.rejects(phase.save(), /PCM budget exceeded/);
        const first = JSON.parse(await fs.readFile(path.join(output, 'report.json'))); assert.equal(first.status, 'failed');
        const failure = first.evidence.at(-1), preserved = await fs.readFile(path.join(output, failure.file));
        await assert.rejects(phase.save(), /PCM budget exceeded/);
        const second = JSON.parse(await fs.readFile(path.join(output, 'report.json')));
        assert.equal(second.status, 'failed'); assert(second.evidence.length > first.evidence.length);
        assert.deepEqual(await fs.readFile(path.join(output, failure.file)), preserved);
        assert.equal(JSON.parse(preserved).probe.pcm[0].base64, 'broken-but-retained');
    } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('native port ordinals and first valid metadata survive unmeasured delivery and later snapshot copies', async () => {
    const result = await runNative(`
      const context=new AudioContext(),source=makeSource(context),gain=context.createGain();source.connect(gain);gain.connect(context.destination);source.start();
      const processor=context.processors[0];processor.port.onmessage({data:{type:'gap',expectedFrame:128,actualFrame:256}});
      const before=probe.snapshot();block(processor,256/12000);const unmeasured=probe.snapshot();
      unmeasured.outputs[0].firstValidBlock.renderFrame=-99;
      probe.begin('later');block(processor,1280/12000);block(processor,2304/12000);const measured=probe.snapshot(true);probe.end();
      const sameStop=source.stop()===stopReturn,sameDisconnect=gain.disconnect(context.destination)===disconnectReturn;
      const promise=context.close();await promise;probe.dispose();
      return {before,unmeasured,measured,sameStop,sameDisconnect,sameClose:promise===context.closePromise};
    `);
    assert.deepEqual(result.measured.errors, []); assert(result.sameStop && result.sameDisconnect && result.sameClose);
    assert.equal(result.before.outputs[0].firstValidBlock, null); assert.equal(result.before.outputs[0].portMessageCount, 1);
    const outlet = result.measured.outputs[0];
    assert.deepEqual(outlet.firstValidBlock, { messageOrder: 2, at: outlet.firstValidBlock.at, window: null,
        renderFrame: 256, sequence: 0, frameCount: 1024, sampleRate: 12000 });
    assert.equal(outlet.portMessageCount, 4); assert.equal(result.measured.receivedPortMessages, 4);
    assert.deepEqual(outlet.blocks.map(block => block.messageOrder), [3, 4]);
    assert.equal(outlet.discontinuities[0].messageOrder, 1);
    assert.throws(() => assertMeasuredWindow(outlet, 'later', result.measured.sources[0]), /first captured block/);
});
test('an unmeasured ordered startup gap followed by captured sequence zero retains native PCM and full onset range', async () => {
    const result = await runNative(`
      const context=new AudioContext(),source=makeSource(context),gain=context.createGain();source.connect(gain);gain.connect(context.destination);source.start();
      const processor=context.processors[0];processor.port.onmessage({data:{type:'gap',expectedFrame:128,actualFrame:256}});
      probe.begin('captured');block(processor,256/12000);block(processor,1280/12000);
      const data=probe.snapshot(true);probe.dispose();return data;
    `);
    const validation = assertMeasuredWindow(result.outputs[0], 'captured', result.sources[0]);
    assert.equal(validation.startupGaps[0].window, null); assert.equal(validation.unmeasuredOnset.frames, 256);
    const expected = new Float32Array(2048); expected.set(syntheticShell(12000).slice(0, 1024)); expected.set(expected.slice(0, 1024), 1024);
    assert.deepEqual(joinOutput(result.outputs[0].blocks, 12000), expected);
});
test('finite port-message budget includes nonmeasurement traffic and cannot prevent native retirement', async () => {
    const result = await runNative(`
      const context=new AudioContext(),source=makeSource(context),gain=context.createGain();source.connect(gain);gain.connect(context.destination);source.start();
      const processor=context.processors[0], message={data:{type:'block',frame:0,sequence:0,sampleRate:12000,samples:new Float32Array(1024)}};
      const limit=probe.snapshot().limits.portMessages;
      for(let i=0;i<=limit;i++){message.data.sequence=i;message.data.frame=i*1024;processor.port.onmessage(message);}
      const data=probe.snapshot();const sameStop=source.stop()===stopReturn,sameDisconnect=gain.disconnect(context.destination)===disconnectReturn;
      const promise=context.close();await promise;const closed=probe.snapshot();probe.dispose();
      return {data,closed,sameStop,sameDisconnect,sameClose:promise===context.closePromise};
    `);
    assert.equal(result.data.receivedPortMessages, 200000); assert.equal(result.data.outputs[0].portMessageCount, 200000);
    assert.equal(result.data.outputs[0].blocks.length, 0); assert.equal(result.data.outputs[0].firstValidBlock.sequence, 0);
    assert.deepEqual(result.data.errors, ['Error: Audio probe port-message bound exceeded']);
    assert(result.sameStop && result.sameDisconnect && result.sameClose); assert.equal(result.closed.live.taps, 0);
});
test('serialized render startup discards no completed block and preserves every sample from actual sequence zero', async () => {
    const source = await runNative(`const context=new AudioContext();context.createGain().connect(context.destination);const source=moduleSources[0];probe.dispose();return source;`);
    let Processor; const sent = [], realm = { currentFrame: 1024, sampleRate: 48000, Float32Array,
        AudioWorkletProcessor: class { constructor() { this.port = { postMessage: value => sent.push(structuredClone(value)) }; } },
        registerProcessor: (_name, value) => { Processor = value; } };
    vm.runInNewContext(source, realm); const processor = new Processor();
    processor.process([[new Float32Array(128).fill(.2)]], [[new Float32Array(128)]]);
    const recorded = Float32Array.from({ length: 2048 }, (_, i) => Math.sin(i / 9) * .03);
    for (let offset = 0; offset < recorded.length; offset += 128) {
        realm.currentFrame = 1920 + offset; processor.process([[recorded.slice(offset, offset + 128)]], [[new Float32Array(128)]]);
    }
    assert.equal(sent.length, 3); assert.deepEqual(sent[0], { type: 'gap', expectedFrame: 1152, actualFrame: 1920 });
    assert.deepEqual(sent.slice(1).map(x => [x.sequence, x.frame]), [[0, 1920], [1, 2944]]);
    const blocks = sent.slice(1).map(x => ({ renderFrame: x.frame, sequence: x.sequence, playbackTime: x.frame / 48000, pcm: encoded(x.samples) }));
    assert.deepEqual(joinOutput(blocks, 48000), recorded);
});

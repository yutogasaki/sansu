import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function decodePCM(base64) {
    const bytes = Buffer.from(base64, 'base64'); assert.equal(bytes.length % 4, 0);
    const values = new Float32Array(bytes.length / 4);
    for (let i = 0; i < values.length; i++) values[i] = bytes.readFloatLE(i * 4);
    assert(values.every(Number.isFinite), 'Nonfinite captured PCM'); return values;
}
export function floatWav(samples, sampleRate) {
    assert(Number.isInteger(sampleRate) && sampleRate >= 8000 && sampleRate <= 192000);
    assert(samples.length && samples.every(Number.isFinite));
    const result = Buffer.alloc(44 + samples.length * 4);
    result.write('RIFF'); result.writeUInt32LE(result.length - 8, 4); result.write('WAVEfmt ', 8);
    result.writeUInt32LE(16, 16); result.writeUInt16LE(3, 20); result.writeUInt16LE(1, 22);
    result.writeUInt32LE(sampleRate, 24); result.writeUInt32LE(sampleRate * 4, 28);
    result.writeUInt16LE(4, 32); result.writeUInt16LE(32, 34); result.write('data', 36); result.writeUInt32LE(samples.length * 4, 40);
    samples.forEach((sample, i) => result.writeFloatLE(sample, 44 + i * 4)); return result;
}
export function statistics(samples, rate) {
    let peak = 0, energy = 0, crossings = 0;
    for (let i = 0; i < samples.length; i++) {
        assert(Number.isFinite(samples[i])); peak = Math.max(peak, Math.abs(samples[i])); energy += samples[i] ** 2;
        if (i && samples[i] * samples[i - 1] < 0) crossings++;
    }
    return { seconds: samples.length / rate, peak, rms: Math.sqrt(energy / Math.max(1, samples.length)), crossings };
}
function range(samples, rate, begin, end) { return samples.slice(Math.floor(begin * rate), Math.floor(end * rate)); }
function tone(samples, rate, frequency) {
    let real = 0, imaginary = 0;
    for (let i = 0; i < samples.length; i++) {
        const taper = Math.sin(Math.PI * i / samples.length) ** 2, angle = 2 * Math.PI * frequency * i / rate;
        real += samples[i] * taper * Math.cos(angle); imaginary += samples[i] * taper * Math.sin(angle);
    }
    return Math.hypot(real, imaginary) / Math.max(1, samples.length);
}

/** Independent waveform properties; no app generator imported or re-synthesized. */
export function assertShellPCM(samples, rate, seconds) {
    const summary = statistics(samples, rate); assert.equal(summary.seconds, seconds);
    assert(summary.peak > .01 && summary.peak <= .121);
    const strikes = [0, .36, .72].map((time, index) => {
        const part = range(samples, rate, time + .025, time + .15), frequency = [540, 675, 810][index];
        const amplitude = tone(part, rate, frequency), neighbours = [frequency - 90, frequency + 90].map(hz => tone(part, rate, hz));
        assert(amplitude > .001 && amplitude > Math.max(...neighbours) * 4, `Shell strike ${index + 1} has its actual pitch`);
        return { time, frequency, amplitude };
    });
    assert(range(samples, rate, 1.3, seconds).every(value => value === 0), 'Actual shell buffer has a silent long gap');
    return { ...summary, strikes };
}
export function assertFreePCM(samples, rate, kind) {
    assert(['breeze', 'brook', 'evening'].includes(kind));
    const summary = statistics(samples, rate); assert.equal(summary.seconds, 6);
    assert(summary.rms > .001 && summary.rms < .06 && summary.peak <= .121);
    // IEEE signed zero has zero physical amplitude in either representation.
    assert(samples[0] === 0); assert(samples.at(-1) === 0);
    // Stable broad signatures, independently separating the three current sounds.
    const crossingsPerSecond = summary.crossings / summary.seconds;
    if (kind === 'breeze') assert(summary.rms > .01 && summary.crossings / samples.length < .09, 'Wind must remain predominantly low frequency');
    if (kind === 'brook') assert(summary.rms > .008 && summary.crossings / samples.length > .1, 'Brook must contain its brighter ripple');
    if (kind === 'evening') {
        assert(summary.rms < .008, 'Evening has its quiet background');
        const call = statistics(range(samples, rate, .08, .5), rate).rms;
        const gap = statistics(range(samples, rate, .9, 1.6), rate).rms;
        assert(call > gap * 2, 'Evening has an insect-call envelope');
    }
    return { ...summary, crossingsPerSecond };
}

/** Source scheduling and context release are separate from signal loudness. */
export function assertNoStack(sources) {
    const events = sources.flatMap(source => {
        const end = Math.min(...[source.stopAt, source.disconnectAt, source.endedAt, source.contextClosedAt].filter(Number.isFinite));
        return [{ at: source.startedAt, delta: 1 }, { at: end, delta: -1 }];
    }).sort((a, b) => a.at - b.at || a.delta - b.delta);
    let active = 0, peak = 0;
    for (const event of events) { active += event.delta; peak = Math.max(peak, active); }
    assert(peak <= 1, `Island ambience stacked ${peak} native sources`); return peak;
}
export function assertHiddenRetirement(source, visibility) {
    assert(visibility?.type === 'visibility' && visibility.hidden === true && visibility.state === 'hidden');
    assert(visibility.at >= source.startedAt, 'Hidden event must belong to this actual playback');
    if (!source.loop) assert(visibility.at < source.startedAt + source.duration * 1000, 'One-shot ended before native hidden; this did not test interruption');
    assert(Number.isFinite(source.stopAt) && source.stopAt >= visibility.at, 'Source must stop after native hidden, not have ended earlier');
    assert(Number.isFinite(source.disconnectAt) && source.disconnectAt >= visibility.at, 'Hidden must retire the actual source connection');
}
/** Validate the exact retained interval without repairing, slicing or resetting
 * evidence. Only an ordered forward gap before a new outlet's sequence zero
 * is unmeasured startup. Window labels describe delivery, not render ordering. */
export function assertMeasuredWindow(outlet, label, source) {
    assert.equal(outlet.contextId, source.contextId, 'Measurement context must belong to the actual source');
    assert(source.outlets.includes(outlet.id), 'Measurement outlet must belong to the actual source');
    assert(Array.isArray(outlet.discontinuities), 'Render discontinuity history is required');
    assert(outlet.discontinuities.every(gap => gap.contextId === outlet.contextId && gap.outletId === outlet.id), 'Discontinuity provenance changed');
    const integer = value => Number.isSafeInteger(value) && value >= 0;
    assert(integer(outlet.portMessageCount) && outlet.portMessageCount > 0, 'Missing native port message ordering');
    const first = outlet.firstValidBlock;
    assert(first && integer(first.messageOrder) && first.messageOrder > 0 && first.messageOrder <= outlet.portMessageCount
        && integer(first.renderFrame) && integer(first.sequence) && first.frameCount === 1024 && first.sampleRate === source.sampleRate,
        'Missing first valid block provenance');
    assert.equal(first.sequence, 0, 'The new outlet lost its first sequence');
    const blocks = outlet.blocks.filter(block => block.window === label);
    assert(blocks.length > 1, 'No continuous gain-after-output recording');
    assert(blocks[0].messageOrder === first.messageOrder && blocks[0].sequence === 0 && blocks[0].renderFrame === first.renderFrame,
        'The first captured block must be the actual outlet sequence zero; do not trim missing prefixes');
    let priorOrder = 0, priorActual = 0;
    const startupGaps = [];
    // Inspect the full selected outlet history, including delivery outside the
    // current window. A later backward jump must never impersonate startup.
    for (const gap of outlet.discontinuities) {
        assert(integer(gap.messageOrder) && gap.messageOrder > priorOrder && gap.messageOrder < first.messageOrder,
            'Render discontinuity after the first block or unknown port order');
        assert(integer(gap.expectedFrame) && integer(gap.actualFrame) && gap.expectedFrame < gap.actualFrame
            && gap.expectedFrame >= priorActual && gap.actualFrame <= first.renderFrame,
            'Only a forward unmeasured startup gap may precede sequence zero');
        startupGaps.push({ ...gap }); priorOrder = gap.messageOrder; priorActual = gap.actualFrame;
    }
    assert.equal(first.messageOrder, startupGaps.length + 1, 'Missing pre-first native port message history');
    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        assert(integer(block.messageOrder) && block.messageOrder <= outlet.portMessageCount
            && (i === 0 || block.messageOrder === blocks[i - 1].messageOrder + 1), 'Captured native port message gap or reordering');
    }
    assert(Number.isFinite(source.scheduledStartAudioTime) && source.scheduledStartAudioTime >= 0,
        'Missing actual source start clock');
    const sourceStartFrame = source.scheduledStartAudioTime * first.sampleRate;
    return { firstValidBlock: { ...first }, startupGaps,
        measured: { firstRenderFrame: first.renderFrame, lastRenderFrameExclusive: blocks.at(-1).renderFrame + 1024,
            firstSequence: 0, lastSequence: blocks.at(-1).sequence, blocks: blocks.length },
        unmeasuredOnset: { sourceStartFrame, firstRecordedFrame: first.renderFrame,
            frames: Math.max(0, first.renderFrame - sourceStartFrame),
            seconds: Math.max(0, first.renderFrame - sourceStartFrame) / first.sampleRate,
            claim: 'No audible continuity or silence is claimed before the first recorded PCM frame.' } };
}
export function joinOutput(blocks, rate) {
    assert(blocks.length > 1, 'No continuous gain-after-output recording');
    const values = blocks.map(block => decodePCM(block.pcm));
    for (const block of blocks) {
        assert(Number.isSafeInteger(block.renderFrame) && Number.isSafeInteger(block.sequence), 'Missing render-thread frame provenance');
        assert(Math.abs(block.playbackTime * rate - block.renderFrame) < 1e-6, 'Render time must identify the actual input frame');
    }
    for (let i = 1; i < blocks.length; i++) {
        assert.equal(blocks[i].renderFrame, blocks[i - 1].renderFrame + values[i - 1].length, 'Render capture gap: cannot claim missing audio was silence');
        assert.equal(blocks[i].sequence, blocks[i - 1].sequence + 1, 'Render message gap or reordering');
    }
    const result = new Float32Array(values.reduce((n, part) => n + part.length, 0));
    let offset = 0; for (const part of values) { result.set(part, offset); offset += part.length; } return result;
}
export function assertNoPreviewResume(hiddenSnapshot, restoredSnapshot) {
    assert.deepEqual(restoredSnapshot.sources.map(source => source.id), hiddenSnapshot.sources.map(source => source.id),
        'Foreground must not replay the old one-shot preview, including a restart during restore');
}
/** Every native source is considered, including short/unclassified sources.
 * The probe records source routes over audio time, so a source disconnected
 * before a delayed callback cannot disappear from that callback's lineage. */
export function assertOutletIsolation(source, outlet, blocks) {
    assert.equal(source.contextId, outlet.contextId);
    assert(source.outlets.includes(outlet.id)); assert(blocks.length > 0);
    let found = false;
    for (const block of blocks) {
        assert(Array.isArray(block.sourceIds), 'Missing actual outlet source lineage');
        assert(block.sourceIds.every(id => id === source.id), 'Another native source reached the same measured outlet');
        found ||= block.sourceIds.includes(source.id);
    }
    assert(found, 'The measured outlet never carried the expected native source');
}
export function assertDeliveredShell(samples, rate, repeated = false, sourcePCM, timing) {
    assert(sourcePCM instanceof Float32Array && sourcePCM.length >= rate * 2, 'Actual source PCM is required for output correspondence');
    assert(timing && typeof timing === 'object' && !Array.isArray(timing)
        && Object.keys(timing).length === 3 && ['firstRenderFrame', 'sourceStartAudioTime', 'sourceSampleRate'].every(key => Object.hasOwn(timing, key)),
    'Explicit native frame/source timing is required');
    assert(Number.isSafeInteger(rate) && rate >= 8000 && rate <= 192000 && timing.sourceSampleRate === rate,
        'Native source and measured output sample rates must match');
    assert(Number.isSafeInteger(timing.firstRenderFrame) && timing.firstRenderFrame >= 0
        && Number.isFinite(timing.sourceStartAudioTime) && timing.sourceStartAudioTime >= 0, 'Invalid native audio frame/clock');
    const rawStartFrame = timing.sourceStartAudioTime * rate, sourceStartFrame = Math.round(rawStartFrame);
    // Decimal seconds can produce e.g. 96512.00000000001 for an integral frame.
    // This permits only binary floating-point conversion error (<1e-6 frame),
    // not sample selection, temporal tolerance or a waveform alignment search.
    assert(Number.isSafeInteger(sourceStartFrame) && Math.abs(rawStartFrame - sourceStartFrame) < 1e-6,
        'Native source start must resolve to an integral frame');
    const sourceOffsetFrames = timing.firstRenderFrame - sourceStartFrame;
    const begin = Math.floor(.385 * rate), end = Math.floor(1.12 * rate);
    const correspondenceRanges = (repeated ? [0, 14] : [0]).map(onset => {
        const origin = sourceStartFrame + Math.round(onset * rate) - timing.firstRenderFrame;
        assert(Number.isSafeInteger(origin) && origin + begin >= 0 && origin + end <= samples.length,
            'Native frame correspondence window is outside retained PCM; missing samples cannot be inferred');
        return { onset, origin, outputBegin: origin + begin, outputEnd: origin + end };
    });
    assert(samples.some(value => Math.abs(value) > 1e-6), 'Source existed but its actual gain output was silent');
    const required = repeated ? 15.35 : 1.35, requiredEndFrame = Math.floor(required * rate) - sourceOffsetFrames;
    assert(Number.isSafeInteger(requiredEndFrame) && requiredEndFrame >= 0 && requiredEndFrame <= samples.length,
        'Native phrase/gap end is outside retained PCM; output capture ended before the whole phrase/gap');
    const retainedRange = (origin, beginSeconds, endSeconds) => {
        const sourceBegin = Math.floor(beginSeconds * rate), sourceEnd = Math.floor(endSeconds * rate);
        const outputBegin = origin + sourceBegin, outputEnd = origin + sourceEnd;
        assert(Number.isSafeInteger(outputBegin) && Number.isSafeInteger(outputEnd)
            && outputBegin >= 0 && outputEnd > outputBegin && outputEnd <= samples.length,
        'Native pitch/silence window is outside retained PCM; missing samples cannot be inferred');
        return { samples: samples.slice(outputBegin, outputEnd), sourceRange: [sourceBegin, sourceEnd], outputRange: [outputBegin, outputEnd] };
    };
    const result = { ...statistics(samples, rate), phraseEnergy: [], pitches: [], correspondence: [],
        timing: { ...timing, sourceStartFrame, sourceOffsetFrames,
            unmeasuredOnsetFrames: Math.max(0, sourceOffsetFrames), requiredSourceEndSeconds: required, requiredOutputEndFrame: requiredEndFrame,
            claim: 'Only retained PCM is compared; the unrecorded first attack and audible continuity are not established.' } };
    for (const { onset, origin, outputBegin, outputEnd } of correspondenceRanges) {
        for (const [index, offset] of [.05, .41, .77].entries()) {
            const measured = retainedRange(origin, offset, offset + .1), slice = measured.samples, rms = statistics(slice, rate).rms;
            assert(rms > 1e-5, 'Each of the three strokes must reach the real gain output'); result.phraseEnergy.push(rms);
            const frequency = [540, 675, 810][index], amplitude = tone(slice, rate, frequency);
            assert(amplitude > 1e-5 && amplitude > Math.max(tone(slice, rate, frequency - 90), tone(slice, rate, frequency + 90)) * 4,
                `Delivered shell strike ${index + 1} must retain its actual pitch`);
            result.pitches.push({ frequency, amplitude, sourceOnsetSeconds: onset, sourceRange: measured.sourceRange, outputRange: measured.outputRange });
        }
        // Native clocks select the only correspondence. A periodic 14 s buffer
        // cannot disambiguate its own loop using waveform similarity. Every
        // sample in the existing source-time window is compared at its native
        // output index, after the app's initial 160 ms gain ramp. No repair,
        // best-match search, missing-sample fallback or prefix removal occurs.
        let xx = 0, xy = 0, yy = 0;
        for (let i = begin; i < end; i++) {
            const x = sourcePCM[i], y = samples[origin + i];
            xx += x * x; xy += x * y; yy += y * y;
        }
        const correspondence = { sourceOnsetSeconds: onset, sourceOffsetFrames, sourceRange: [begin, end], outputRange: [outputBegin, outputEnd],
            gain: xy / xx, similarity: xy / Math.sqrt(xx * yy), residual: Math.sqrt(Math.max(0, yy - xy * xy / xx) / Math.max(yy, 1e-30)) };
        assert(correspondence.similarity > .995 && correspondence.residual < .08 && correspondence.gain > .2 && correspondence.gain < .5,
            'Delivered waveform must match the exact native source through its app gain, without mixed audio');
        result.correspondence.push(correspondence);
    }
    if (repeated) {
        const measured = retainedRange(-sourceOffsetFrames, 1.4, 13.9), silence = statistics(measured.samples, rate);
        assert(silence.peak < 1e-6, 'The phrase gap must not contain a hidden overlapping loop');
        result.silence = { ...silence, sourceRange: measured.sourceRange, outputRange: measured.outputRange };
    }
    return result;
}

const islandFor = (tables, owner) => tables.islands.find(island => island.profileId === owner);
export function assertSoundDelta(before, after, owner, action) {
    const expected = structuredClone(before), old = islandFor(before, owner), next = islandFor(after, owner), island = islandFor(expected, owner);
    assert(old && next && old.expression?.ownedItemIds.includes('shell-three-notes'));
    if (!action) { assert.deepEqual(after, before, 'Audio preview/listen/stop cannot change any saved table or photo hash'); return; }
    if (action.type === 'profile-sound') {
        const profile = expected.profiles.find(profile => profile.id === owner); assert(profile); profile.soundEnabled = action.enabled;
        const mirrors = expected.appData.filter(app => app.profiles?.[owner]); assert.equal(mirrors.length, 1);
        mirrors[0].profiles[owner].soundEnabled = action.enabled;
    } else {
        assert.equal(next.revision, old.revision + 1); assert(Number.isSafeInteger(next.updatedAt) && next.updatedAt >= old.updatedAt);
        island.revision++; island.updatedAt = next.updatedAt;
        if (action.type === 'equip-soundscape') {
            assert([null, 'shell-three-notes'].includes(action.itemId)); island.expression.selection.soundscape = action.itemId;
        } else {
            assert.equal(action.type, 'ambience'); assert(['off', 'breeze', 'brook', 'evening'].includes(action.ambience));
            island.experience ??= { version: 1, islandName: 'わたしの しま', emblem: 'leaf', ambience: 'off', residents: {
                otter: { name: 'カワウソ', look: 'original' }, rabbit: { name: 'ウサギ', look: 'original' }, fox: { name: 'キツネ', look: 'original' } }, layouts: [] };
            island.experience.ambience = action.ambience; island.expression.selection.soundscape = null;
        }
        const experience = action.type === 'ambience';
        expected.islandEvents.push({ id: JSON.stringify([experience ? 'island-experience-v1' : 'island-expression-v1', owner, old.revision]),
            profileId: owner, type: experience ? 'experience_changed' : 'expression_changed', timestamp: next.updatedAt, action });
        // Native IDB string key ordering, not locale-aware display ordering.
        expected.islandEvents.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    }
    assert.deepEqual(after, expected, 'Only the exact sound selection/profile action and its receipt may change');
}

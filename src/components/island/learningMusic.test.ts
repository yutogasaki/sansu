import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLearningMusic, LEARNING_MAX_CUE_VOICES } from './learningMusic';
import { createLearningCue, createLearningStems, LEARNING_BEAT_SECONDS, LEARNING_CUES, LEARNING_LOOP_SECONDS,
    learningChordAt, learningInputPitch, learningStemLevels } from './learningMusicScore';

const peak = (samples: Float32Array) => samples.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
const energy = (samples: Float32Array) => samples.reduce((sum, value) => sum + value * value, 0) / samples.length;
interface Source {
    buffer: AudioBuffer | null; loop: boolean; onended: (() => void) | null;
    connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>;
}
function fixture() {
    const param = () => ({ setValueAtTime: vi.fn(), setTargetAtTime: vi.fn() });
    const sources: Source[] = [], gains: { gain: ReturnType<typeof param>; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
    const filter = { type: '', Q: param(), frequency: param(), connect: vi.fn(), disconnect: vi.fn() };
    const context = {
        state: 'suspended', sampleRate: 8000, currentTime: 3, destination: {},
        resume: vi.fn(async () => { context.state = 'running'; }), close: vi.fn(async () => { context.state = 'closed'; }),
        createBiquadFilter: vi.fn(() => filter),
        createGain: vi.fn(() => { const gain = { gain: param(), connect: vi.fn(), disconnect: vi.fn() }; gains.push(gain); return gain; }),
        createBuffer: vi.fn((_channels: number, length: number, sampleRate: number) => {
            const data = new Float32Array(length); return { length, duration: length / sampleRate, getChannelData: () => data };
        }),
        createBufferSource: vi.fn(() => {
            const source: Source = { buffer: null, loop: false, onended: null, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() };
            sources.push(source); return source;
        }),
    };
    return { context, sources, gains, filter, factory: vi.fn(() => context as unknown as AudioContext) };
}
afterEach(() => vi.useRealTimers());

describe('the score and input share a chord and pulse clock', () => {
    it('uses the currently audible chord at boundaries, after repeated loops and for every digit', () => {
        for (const time of [0, 1.99999, 2, 3.99999, 4, 6, 7.99999, 8, 118]) {
            const classes = learningChordAt(time).map(midi => midi % 12);
            for (const digit of '0123456789.') expect(classes).toContain(learningInputPitch(time, digit) % 12);
        }
        expect(learningChordAt(1.99999)).not.toEqual(learningChordAt(2));
        expect(learningChordAt(8)).toEqual(learningChordAt(0));
        expect(learningInputPitch(NaN, 'x')).toBe(72);
    });

    it('grows independent stems from question progress and clamps malformed levels', () => {
        expect(learningStemLevels(0)).toEqual([1, 0, 0, 0]);
        expect(learningStemLevels(1)).toEqual([1, 1, 1, 1]);
        expect(learningStemLevels(-4)).toEqual(learningStemLevels(0));
        expect(learningStemLevels(NaN)).toEqual(learningStemLevels(0));
        const levels = [0, .2, .4, .6, .8, 1].map(learningStemLevels);
        for (let i = 1; i < levels.length; i++) levels[i].forEach((value, stem) => expect(value).toBeGreaterThanOrEqual(levels[i - 1][stem]));
    });

    it.each([8000, 44100, 48000])('renders finite, audible, seam-free layers and bounded quiet cues at %i Hz', sampleRate => {
        const stems = createLearningStems(sampleRate);
        expect(stems).toHaveLength(4);
        for (const stem of stems) {
            expect(stem.length).toBe(sampleRate * LEARNING_LOOP_SECONDS);
            expect(stem.every(Number.isFinite)).toBe(true);
            expect(stem[0]).toBe(0); expect(Math.abs(stem.at(-1)!)).toBe(0);
            expect(energy(stem)).toBeGreaterThan(.00001); expect(peak(stem)).toBeLessThan(.18);
        }
        const peaks = LEARNING_CUES.map(kind => {
            const data = createLearningCue(kind, sampleRate, 76, learningChordAt(4));
            expect(data.length / sampleRate).toBeLessThanOrEqual(.7);
            expect(data.every(Number.isFinite)).toBe(true);
            expect(data[0]).toBe(0); expect(Math.abs(data.at(-1)!)).toBe(0);
            expect(energy(data)).toBeGreaterThan(.000001); expect(peak(data)).toBeLessThan(.23);
            return peak(data);
        });
        // Conservative maximum: all six effects peak together over all four stems.
        expect((Math.max(...peaks) * LEARNING_MAX_CUE_VOICES + stems.reduce((sum, stem) => sum + peak(stem), 0) * .36) * .68).toBeLessThan(1);
    });

    it('does not alias catch/place/retry as one sound and rejects invalid formats', () => {
        const signatures = LEARNING_CUES.map(kind => {
            const data = createLearningCue(kind, 8000, 76); return `${data.length}:${energy(data)}:${data[250]}`;
        });
        expect(new Set(signatures).size).toBe(LEARNING_CUES.length);
        for (const rate of [0, NaN, Infinity, 200000]) expect(() => createLearningStems(rate)).toThrow();
        expect(() => createLearningCue('unknown' as never, 8000, 60)).toThrow();
    });
});

describe('learning music owns its lifecycle and bounded graph', () => {
    it('starts only on unlock, synchronizes every stem and reads pulse from the audio clock', async () => {
        const f = fixture(), audio = createLearningMusic(f.factory);
        audio.setIntensity(.7, false); expect(audio.input('2')).toBe(false); expect(audio.cue('place')).toBe(false);
        expect(audio.pulse()).toBe(0); expect(f.factory).not.toHaveBeenCalled();
        const first = audio.unlock(); expect(audio.unlock()).toBe(first); expect(await first).toBe(true);
        expect(await audio.unlock()).toBe(true); expect(f.factory).toHaveBeenCalledTimes(1);
        expect(f.sources).toHaveLength(4); expect(f.sources.every(source => source.loop)).toBe(true);
        expect(f.sources.every(source => source.start.mock.calls[0][0] === 3.015)).toBe(true);
        expect(audio.pulse()).toBe(0);
        f.context.currentTime = 3.015; expect(audio.pulse()).toBe(1);
        f.context.currentTime += LEARNING_BEAT_SECONDS / 2; expect(audio.pulse()).toBeCloseTo(Math.exp(-3.5));
        f.context.currentTime += LEARNING_BEAT_SECONDS / 2; expect(audio.pulse()).toBeCloseTo(1);
        f.context.state = 'suspended'; expect(audio.pulse()).toBe(0); expect(audio.input('3')).toBe(false);
        audio.dispose();
    });

    it('changes gains/filter without scheduling nodes, then opens anticipation on peak', async () => {
        const f = fixture(), audio = createLearningMusic(f.factory); await audio.unlock();
        audio.setIntensity(1, true);
        expect(f.filter.frequency.setTargetAtTime).toHaveBeenLastCalledWith(620, 3, .18);
        expect(f.gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(.2, 3, .16);
        for (const gain of f.gains.slice(2)) expect(gain.gain.setTargetAtTime).toHaveBeenLastCalledWith(1, 3, .12);
        expect(f.sources).toHaveLength(4);
        audio.cue('peak'); expect(f.filter.frequency.setTargetAtTime).toHaveBeenLastCalledWith(9000, 3, .045);
        expect(f.sources.at(-1)?.loop).toBe(false); audio.dispose();
    });

    it('limits rapid interaction polyphony and cleans ended or canceled sources exactly once', async () => {
        const f = fixture(), audio = createLearningMusic(f.factory); await audio.unlock();
        for (let digit = 0; digit < 40; digit++) audio.input(String(digit % 10));
        expect(f.sources.filter(source => source.onended)).toHaveLength(LEARNING_MAX_CUE_VOICES);
        expect(f.sources.slice(4, -LEARNING_MAX_CUE_VOICES).every(source => source.buffer === null && source.disconnect.mock.calls.length === 1)).toBe(true);
        const last = f.sources.at(-1)!, ended = last.onended!; ended(); ended();
        expect(last.disconnect).toHaveBeenCalledTimes(1); expect(last.stop).not.toHaveBeenCalled();
        const late = f.sources.at(-2)!.onended!; audio.stop(); late(); audio.stop();
        expect(f.sources.every(source => source.onended === null && source.buffer === null && source.disconnect.mock.calls.length === 1)).toBe(true);
        expect(f.gains.every(gain => gain.disconnect.mock.calls.length === 1)).toBe(true);
        expect(f.context.close).toHaveBeenCalledTimes(1); expect(audio.input('1')).toBe(false); expect(audio.pulse()).toBe(0);
    });

    it('requires a new gesture after inactive/background, and dispose is terminal', async () => {
        const first = fixture(), second = fixture(), audio = createLearningMusic(vi.fn().mockReturnValueOnce(first.context).mockReturnValueOnce(second.context));
        await audio.unlock(); audio.input('1'); audio.setActive(false);
        expect(first.context.close).toHaveBeenCalledTimes(1); expect(await audio.unlock()).toBe(false);
        audio.setActive(true); expect(audio.input('1')).toBe(false); expect(second.context.createBuffer).not.toHaveBeenCalled();
        expect(await audio.unlock()).toBe(true); expect(audio.input('1')).toBe(true); audio.dispose();
        expect(second.context.close).toHaveBeenCalledTimes(1); expect(await audio.unlock()).toBe(false);
    });

    it('cannot resurrect a slow unlock after departure even when a new context already runs', async () => {
        const first = fixture(), second = fixture(); let resolve!: () => void;
        first.context.resume.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
        const audio = createLearningMusic(vi.fn().mockReturnValueOnce(first.context).mockReturnValueOnce(second.context));
        const old = audio.unlock(); audio.stop(); expect(await audio.unlock()).toBe(true);
        first.context.state = 'running'; resolve(); expect(await old).toBe(false);
        expect(first.sources).toHaveLength(0); expect(first.context.close).toHaveBeenCalledTimes(1);
        expect(second.context.close).not.toHaveBeenCalled(); expect(audio.input('6')).toBe(true); audio.dispose();
    });

    it('bounds suspended unlock, refuses unsupported audio and releases partially built graphs', async () => {
        vi.useFakeTimers(); const f = fixture(); f.context.resume.mockImplementation(() => new Promise<void>(() => undefined));
        const audio = createLearningMusic(f.factory), pending = audio.unlock();
        await vi.advanceTimersByTimeAsync(700); expect(await pending).toBe(false);
        expect(f.context.close).toHaveBeenCalledTimes(1); expect(f.sources).toHaveLength(0);
        expect(await createLearningMusic(() => { throw new Error('Unsupported'); }).unlock()).toBe(false);
        const failed = fixture(); failed.context.createBufferSource.mockImplementationOnce(() => { throw new Error('No source'); });
        expect(await createLearningMusic(failed.factory).unlock()).toBe(false);
        expect(failed.context.close).toHaveBeenCalledTimes(1); expect(failed.gains.every(gain => gain.disconnect.mock.calls.length === 1)).toBe(true);
    });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIslandWorkshopAudio, createIslandWorkshopSamples, WORKSHOP_AUDIO_GAIN, WORKSHOP_AUDIO_MAX_VOICES,
    WORKSHOP_AUDIO_SECONDS, WORKSHOP_FEEDBACK_KINDS, type WorkshopFeedbackKind } from './islandWorkshopAudio';

interface Source {
    buffer: AudioBuffer | null; loop: boolean; onended: (() => void) | null;
    connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>;
}
function fixture() {
    const sources: Source[] = [], gains: { connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; gain: { setValueAtTime: ReturnType<typeof vi.fn> } }[] = [];
    const context = {
        state: 'suspended', sampleRate: 12000, currentTime: 3, destination: {},
        resume: vi.fn(async () => { context.state = 'running'; }), close: vi.fn(async () => { context.state = 'closed'; }),
        createGain: vi.fn(() => { const gain = { connect: vi.fn(), disconnect: vi.fn(), gain: { setValueAtTime: vi.fn() } }; gains.push(gain); return gain; }),
        createBuffer: vi.fn((_channels: number, length: number, sampleRate: number) => { const samples = new Float32Array(length);
            return { length, duration: length / sampleRate, getChannelData: () => samples }; }),
        createBufferSource: vi.fn(() => { const source: Source = { buffer: null, loop: false, onended: null,
            connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() }; sources.push(source); return source; }),
    };
    const factory = vi.fn(() => context as unknown as AudioContext);
    return { context, sources, gains, factory };
}
const rms = (samples: Float32Array) => Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
const windowRms = (samples: Float32Array, sampleRate: number, from: number, to: number) => rms(samples.slice(Math.round(from * sampleRate), Math.round(to * sampleRate)));
afterEach(() => { vi.useRealTimers(); });

describe('short material-specific workshop PCM', () => {
    it.each([8000, 44100, 48000])('has finite quiet samples, bounded duration and silent attack/release endpoints at %i Hz', sampleRate => {
        for (const kind of WORKSHOP_FEEDBACK_KINDS) {
            const samples = createIslandWorkshopSamples(kind, sampleRate);
            expect(samples.length / sampleRate).toBeCloseTo(WORKSHOP_AUDIO_SECONDS[kind], 3);
            expect(samples.length / sampleRate).toBeLessThanOrEqual(.381);
            expect(Math.abs(samples[0])).toBe(0); expect(Math.abs(samples.at(-1)!)).toBe(0);
            expect(samples.every(Number.isFinite)).toBe(true);
            expect(samples.every(value => Math.abs(value) <= .121)).toBe(true);
            expect(rms(samples)).toBeGreaterThan(.002); expect(rms(samples)).toBeLessThan(.04);
            // Last 2 ms settle below the body of the sound, avoiding a clipped tail.
            expect(windowRms(samples, sampleRate, WORKSHOP_AUDIO_SECONDS[kind] - .002, WORKSHOP_AUDIO_SECONDS[kind])).toBeLessThan(rms(samples) * .15);
        }
        expect(WORKSHOP_AUDIO_GAIN * .12 * WORKSHOP_AUDIO_MAX_VOICES).toBeLessThan(.13);
    });

    it('distinguishes granular sand, a low wooden knock, bright glass and the hollow shell by their actual waveforms', () => {
        const crossings = (kind: WorkshopFeedbackKind) => {
            const samples = createIslandWorkshopSamples(kind, 12000);
            return samples.reduce((count, value, index) => count + (index > 0 && value * samples[index - 1] < 0 ? 1 : 0), 0) / samples.length;
        };
        expect(crossings('sand')).toBeGreaterThan(crossings('wood') * 3);
        expect(crossings('glass')).toBeGreaterThan(crossings('shell') * 2);
        const signatures = WORKSHOP_FEEDBACK_KINDS.map(kind => {
            const samples = createIslandWorkshopSamples(kind, 12000);
            expect(samples).toEqual(createIslandWorkshopSamples(kind, 12000));
            return `${samples.length}:${rms(samples)}:${samples[250]}`;
        });
        expect(new Set(signatures).size).toBe(WORKSHOP_FEEDBACK_KINDS.length);
    });

    it('gives assembly a second contact and discovery a short rising sequence without scheduling future nodes', () => {
        const assemble = createIslandWorkshopSamples('assemble', 12000), discovery = createIslandWorkshopSamples('discovery', 12000);
        expect(windowRms(assemble, 12000, .082, .105)).toBeGreaterThan(windowRms(assemble, 12000, .052, .072));
        expect(windowRms(discovery, 12000, .2, .225)).toBeGreaterThan(windowRms(discovery, 12000, .17, .19));
        for (const sampleRate of [0, -1, NaN, Infinity, 1000000]) expect(() => createIslandWorkshopSamples('wood', sampleRate)).toThrow();
        expect(() => createIslandWorkshopSamples('unknown' as WorkshopFeedbackKind, 12000)).toThrow();
    });
});

describe('gesture ownership, bounded polyphony and immediate stop', () => {
    it('creates nothing before a gesture unlock and shares one master and finite buffer cache across repeated material callbacks', async () => {
        const f = fixture(), audio = createIslandWorkshopAudio(f.factory);
        expect(audio.play('pick')).toBe(false); expect(f.factory).not.toHaveBeenCalled();
        const first = audio.unlock(), repeated = audio.unlock(); expect(first).toBe(repeated);
        expect(await first).toBe(true); expect(await audio.unlock()).toBe(true);
        expect(f.factory).toHaveBeenCalledTimes(1); expect(f.sources).toHaveLength(0); expect(f.gains).toHaveLength(1);
        expect(f.gains[0].gain.setValueAtTime).toHaveBeenCalledWith(WORKSHOP_AUDIO_GAIN, 3);
        for (let run = 0; run < 3; run++) for (const kind of WORKSHOP_FEEDBACK_KINDS) expect(audio.play(kind)).toBe(true);
        expect(f.context.createBuffer).toHaveBeenCalledTimes(WORKSHOP_FEEDBACK_KINDS.length);
        expect(f.sources.filter(source => source.onended !== null)).toHaveLength(WORKSHOP_AUDIO_MAX_VOICES);
        expect(f.sources.every(source => source.loop === false)).toBe(true);
        expect(f.sources.slice(0, -WORKSHOP_AUDIO_MAX_VOICES).every(source => source.stop.mock.calls.length === 1 && source.disconnect.mock.calls.length === 1)).toBe(true);
        audio.stop(); audio.stop();
        expect(f.sources.every(source => source.onended === null && source.buffer === null && source.disconnect.mock.calls.length === 1)).toBe(true);
        expect(f.gains[0].disconnect).toHaveBeenCalledTimes(1); expect(f.context.close).toHaveBeenCalledTimes(1);
        expect(audio.play('glass')).toBe(false);
    });

    it('releases finished voices once, including a late ended callback after stop, without stopping unrelated learning audio', async () => {
        const f = fixture(), learning = fixture(), audio = createIslandWorkshopAudio(f.factory);
        const independent = learning.context.createBufferSource(); independent.start();
        await audio.unlock(); audio.play('water');
        const ended = f.sources[0].onended!; ended(); ended();
        expect(f.sources[0].disconnect).toHaveBeenCalledTimes(1); expect(f.sources[0].stop).not.toHaveBeenCalled();
        audio.play('shell'); const late = f.sources[1].onended!; audio.stop(); late();
        expect(f.sources[1].stop).toHaveBeenCalledTimes(1); expect(f.sources[1].disconnect).toHaveBeenCalledTimes(1);
        expect(independent.stop).not.toHaveBeenCalled(); expect(independent.disconnect).not.toHaveBeenCalled(); expect(learning.context.close).not.toHaveBeenCalled();
    });

    it('cuts current voices on inactive/learning/background and requires a fresh gesture after becoming active again', async () => {
        const first = fixture(), second = fixture(), factory = vi.fn().mockReturnValueOnce(first.context).mockReturnValueOnce(second.context);
        const audio = createIslandWorkshopAudio(factory);
        await audio.unlock(); audio.play('wood'); audio.play('sand');
        audio.setActive(false);
        expect(first.sources.every(source => source.stop.mock.calls.length === 1 && source.buffer === null)).toBe(true);
        expect(first.context.close).toHaveBeenCalledTimes(1);
        expect(audio.play('discovery')).toBe(false); expect(await audio.unlock()).toBe(false);
        audio.setActive(true); expect(audio.play('glass')).toBe(false); expect(factory).toHaveBeenCalledTimes(1);
        expect(await audio.unlock()).toBe(true); expect(audio.play('glass')).toBe(true);
        audio.dispose(); expect(second.context.close).toHaveBeenCalledTimes(1);
        expect(await audio.unlock()).toBe(false); expect(audio.play('wood')).toBe(false);
    });

    it('does not resurrect an old suspended unlock after stop, even if a newer workshop visit has already unlocked another context', async () => {
        const first = fixture(), second = fixture(); let resume!: () => void;
        first.context.resume.mockImplementation(() => new Promise<void>(resolve => { resume = resolve; }));
        const audio = createIslandWorkshopAudio(vi.fn().mockReturnValueOnce(first.context).mockReturnValueOnce(second.context));
        const old = audio.unlock(); audio.stop();
        expect(await audio.unlock()).toBe(true);
        first.context.state = 'running'; resume(); expect(await old).toBe(false);
        expect(first.sources).toHaveLength(0); expect(first.context.close).toHaveBeenCalledTimes(1);
        expect(second.context.close).not.toHaveBeenCalled(); expect(audio.play('shell')).toBe(true);
        audio.dispose();
    });

    it('refuses suspended or failed playback, retires interrupted tails, and never duplicates the master connection on resume', async () => {
        const f = fixture(), audio = createIslandWorkshopAudio(f.factory);
        await audio.unlock(); audio.play('glass'); f.context.state = 'suspended';
        expect(audio.play('shell')).toBe(false);
        expect(await audio.unlock()).toBe(true);
        expect(f.sources[0].stop).toHaveBeenCalledTimes(1); expect(f.gains[0].connect).toHaveBeenCalledTimes(1);
        f.context.createBufferSource.mockImplementationOnce(() => {
            const source: Source = { buffer: null, loop: false, onended: null, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(() => { throw new Error('refused'); }), stop: vi.fn() };
            f.sources.push(source); return source;
        });
        expect(audio.play('water')).toBe(false); expect(f.sources[1].disconnect).toHaveBeenCalledTimes(1); expect(f.sources[1].buffer).toBeNull();
        expect(audio.play('unknown' as WorkshopFeedbackKind)).toBe(false);
        audio.dispose();
    });

    it('bounds an indefinitely suspended unlock and releases an unsupported or refused context without throwing into learning', async () => {
        vi.useFakeTimers();
        const f = fixture(); f.context.resume.mockImplementation(() => new Promise<void>(() => undefined));
        const audio = createIslandWorkshopAudio(f.factory), pending = audio.unlock();
        await vi.advanceTimersByTimeAsync(700);
        expect(await pending).toBe(false); expect(f.context.close).toHaveBeenCalledTimes(1); expect(f.sources).toHaveLength(0);
        const denied = fixture(); denied.context.resume.mockRejectedValueOnce(new Error('NotAllowedError'));
        expect(await createIslandWorkshopAudio(denied.factory).unlock()).toBe(false); expect(denied.context.close).toHaveBeenCalledTimes(1);
        expect(await createIslandWorkshopAudio(() => { throw new Error('No audio'); }).unlock()).toBe(false);
    });

    it('does not accumulate contexts, cached buffers, voices or callbacks across repeated exits and reentries', async () => {
        const instances: ReturnType<typeof fixture>[] = [];
        const audio = createIslandWorkshopAudio(() => { const f = fixture(); instances.push(f); return f.context as unknown as AudioContext; });
        for (let visit = 0; visit < 12; visit++) {
            audio.setActive(true); await audio.unlock();
            for (const kind of WORKSHOP_FEEDBACK_KINDS) audio.play(kind);
            audio.setActive(false);
        }
        expect(instances).toHaveLength(12);
        for (const f of instances) {
            expect(f.context.close).toHaveBeenCalledTimes(1); expect(f.context.createBuffer).toHaveBeenCalledTimes(8);
            expect(f.gains).toHaveLength(1); expect(f.gains[0].disconnect).toHaveBeenCalledTimes(1);
            expect(f.sources.every(source => source.onended === null && source.buffer === null && source.disconnect.mock.calls.length === 1)).toBe(true);
        }
        audio.dispose();
    });
});

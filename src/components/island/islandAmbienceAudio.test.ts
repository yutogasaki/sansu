import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIslandAmbienceAudio, createIslandAmbienceSamples } from './islandAmbienceAudio';

function audioFixture() {
    const sources: { connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; buffer?: AudioBuffer; loop?: boolean; onended?: (() => void) | null }[] = [];
    const gains: { connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; gain: { setValueAtTime: ReturnType<typeof vi.fn>; linearRampToValueAtTime: ReturnType<typeof vi.fn> } }[] = [];
    const context = {
        state: 'suspended', sampleRate: 8000, currentTime: 0, destination: {},
        resume: vi.fn(async () => { context.state = 'running'; }),
        close: vi.fn(async () => { context.state = 'closed'; }),
        createBuffer: vi.fn((_channels: number, length: number) => { const samples = new Float32Array(length); return { getChannelData: () => samples }; }),
        createBufferSource: vi.fn(() => { const source = { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() }; sources.push(source); return source; }),
        createGain: vi.fn(() => { const gain = { connect: vi.fn(), disconnect: vi.fn(), gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() } }; gains.push(gain); return gain; }),
    };
    const factory = vi.fn(() => context as unknown as AudioContext);
    return { context, sources, gains, factory };
}

afterEach(() => { vi.useRealTimers(); });

describe('quiet island ambience PCM', () => {
    it('plays three distinct shell strikes then leaves the long soundscape gap silent', () => {
        const rate = 12000, samples = createIslandAmbienceSamples('shell-three-notes', rate);
        expect(samples).toHaveLength(rate * 14);
        const crossings: number[] = [];
        for (const start of [0, .36, .72]) {
            const phrase = samples.slice(Math.floor((start + .03) * rate), Math.floor((start + .18) * rate));
            expect(phrase.some(value => Math.abs(value) > .005)).toBe(true);
            crossings.push(phrase.reduce((sum, value, i) => sum + Number(i > 0 && value * phrase[i - 1] < 0), 0));
        }
        expect(new Set(crossings).size).toBe(3);
        expect(samples.slice(Math.ceil(1.3 * rate)).every(value => value === 0)).toBe(true);
        expect(samples.every(value => Number.isFinite(value) && Math.abs(value) <= .121)).toBe(true);
        const preview = createIslandAmbienceSamples('shell-three-notes', rate, 2);
        expect(preview).toEqual(samples.slice(0, rate * 2));
    });
    it('rejects an unknown sound instead of falling through to the evening insects', () => {
        expect(() => createIslandAmbienceSamples('missing' as never, 12000)).toThrow('Invalid island ambience format');
    });
    it('contains distinct finite audible waveforms, bounded peaks and no loop-edge jump', () => {
        const signatures = (['breeze', 'brook', 'evening'] as const).map(kind => {
            const samples = createIslandAmbienceSamples(kind, 12000);
            expect(samples).toHaveLength(72000);
            expect(samples[0]).toBe(0); expect(Math.abs(samples.at(-1)!)).toBe(0);
            let energy = 0, crossings = 0, peak = 0;
            for (let i = 0; i < samples.length; i += 1) {
                peak = Math.max(peak, Math.abs(samples[i]));
                energy += samples[i] ** 2;
                if (i && samples[i] * samples[i - 1] < 0) crossings += 1;
            }
            const rms = Math.sqrt(energy / samples.length);
            expect(Number.isFinite(rms)).toBe(true);
            expect(peak).toBeLessThanOrEqual(.121);
            expect(rms).toBeGreaterThan(.001);
            expect(rms).toBeLessThan(.06);
            return { rms, crossings };
        });
        expect(signatures[0].crossings).toBeLessThan(signatures[1].crossings);
        expect(signatures[2].crossings).toBeGreaterThan(signatures[0].crossings);
        expect(new Set(signatures.map(value => value.rms)).size).toBe(3);
    });
});

describe('island ambience ownership and refusal', () => {
    it('restarts an explicit phrase preview without stacking voices or keeping the old completion callback', async () => {
        const { factory, sources, context } = audioFixture(), firstEnded = vi.fn(), secondEnded = vi.fn();
        const audio = createIslandAmbienceAudio(factory);
        await audio.start('shell-three-notes', { once: true, onEnded: firstEnded });
        const retiredEnd = sources[0].onended!;
        await audio.start('shell-three-notes', { once: true, onEnded: secondEnded });
        expect(sources).toHaveLength(2); expect(sources[0].stop).toHaveBeenCalledTimes(1);
        expect(sources[0].disconnect).toHaveBeenCalledTimes(1); expect(sources[1].loop).toBe(false);
        retiredEnd(); expect(firstEnded).not.toHaveBeenCalled(); expect(secondEnded).not.toHaveBeenCalled();
        sources[1].onended!(); expect(secondEnded).toHaveBeenCalledTimes(1); expect(context.close).toHaveBeenCalledTimes(1);
        audio.dispose();
    });
    it('previews one phrase without looping, then releases its voice and reports its natural end once', async () => {
        const { factory, context, sources, gains } = audioFixture(), ended = vi.fn();
        const audio = createIslandAmbienceAudio(factory);
        expect(await audio.start('shell-three-notes', { once: true, onEnded: ended })).toBe(true);
        expect(sources[0].loop).toBe(false);
        expect(sources[0].buffer?.getChannelData(0)).toHaveLength(16000);
        const callback = sources[0].onended!; callback(); callback();
        expect(ended).toHaveBeenCalledTimes(1); expect(context.close).toHaveBeenCalledTimes(1);
        expect(sources[0].disconnect).toHaveBeenCalledTimes(1); expect(gains[0].disconnect).toHaveBeenCalledTimes(1);
        audio.dispose(); expect(context.close).toHaveBeenCalledTimes(1);
    });
    it('replaces a preview with the spaced loop and ignores the retired preview completion', async () => {
        const { factory, sources, context } = audioFixture(), ended = vi.fn();
        const audio = createIslandAmbienceAudio(factory);
        await audio.start('shell-three-notes', { once: true, onEnded: ended });
        const retiredEnd = sources[0].onended!;
        await audio.start('shell-three-notes');
        expect(sources).toHaveLength(2); expect(sources[1].loop).toBe(true);
        expect(sources[1].buffer?.getChannelData(0)).toHaveLength(112000);
        retiredEnd(); expect(ended).not.toHaveBeenCalled(); expect(context.close).not.toHaveBeenCalled();
        expect(sources[0].disconnect).toHaveBeenCalledTimes(1); expect(sources[1].disconnect).not.toHaveBeenCalled();
        audio.dispose();
    });
    it('owns one voice across repeated start, replaces it for another sound, and disposes everything on stop', async () => {
        const { factory, context, sources, gains } = audioFixture();
        const audio = createIslandAmbienceAudio(factory);
        expect(await audio.start('breeze')).toBe(true);
        expect(await audio.start('breeze')).toBe(true);
        expect(factory).toHaveBeenCalledTimes(1); expect(sources).toHaveLength(1);
        expect(sources[0].loop).toBe(true);
        expect(await audio.start('brook')).toBe(true);
        expect(factory).toHaveBeenCalledTimes(1); expect(sources).toHaveLength(2);
        expect(sources[0].stop).toHaveBeenCalledTimes(1); expect(sources[0].disconnect).toHaveBeenCalledTimes(1);
        audio.stop(); audio.dispose();
        expect(sources[1].stop).toHaveBeenCalledTimes(1); expect(sources[1].disconnect).toHaveBeenCalledTimes(1);
        expect(gains.every(gain => gain.disconnect.mock.calls.length === 1)).toBe(true);
        expect(context.close).toHaveBeenCalledTimes(1);
    });
    it('cannot start a late voice after learning, backgrounding or unmount has stopped its pending resume', async () => {
        const { factory, context, sources } = audioFixture();
        let resume!: () => void;
        context.resume.mockImplementation(() => new Promise<void>(resolve => { resume = resolve; }));
        const audio = createIslandAmbienceAudio(factory);
        const first = audio.start('breeze'), repeated = audio.start('breeze');
        expect(first).toBe(repeated);
        audio.stop(); context.state = 'running'; resume();
        expect(await first).toBe(false);
        expect(sources).toHaveLength(0); expect(context.close).toHaveBeenCalledTimes(1);
    });
    it('reports refused resume as false and closes the unused context', async () => {
        const { factory, context, sources } = audioFixture();
        context.resume.mockRejectedValueOnce(new Error('NotAllowedError'));
        expect(await createIslandAmbienceAudio(factory).start('evening')).toBe(false);
        expect(sources).toHaveLength(0); expect(context.close).toHaveBeenCalledTimes(1);
    });
    it('does not claim playback when autoplay leaves resume suspended indefinitely', async () => {
        vi.useFakeTimers();
        const { factory, context, sources } = audioFixture();
        context.resume.mockImplementation(() => new Promise<void>(() => undefined));
        const pending = createIslandAmbienceAudio(factory).start('brook');
        await vi.advanceTimersByTimeAsync(700);
        expect(await pending).toBe(false);
        expect(sources).toHaveLength(0); expect(context.close).toHaveBeenCalledTimes(1);
    });
    it('recovers through a fresh context after a stop without preserving the old buffers', async () => {
        const first = audioFixture(), second = audioFixture();
        const factory = vi.fn().mockReturnValueOnce(first.context).mockReturnValueOnce(second.context);
        const audio = createIslandAmbienceAudio(factory);
        expect(await audio.start('breeze')).toBe(true);
        audio.stop();
        expect(await audio.start('evening')).toBe(true);
        expect(first.context.close).toHaveBeenCalledTimes(1);
        expect(first.sources[0].disconnect).toHaveBeenCalledTimes(1);
        expect(second.sources[0].start).toHaveBeenCalledTimes(1);
        audio.dispose();
    });
});

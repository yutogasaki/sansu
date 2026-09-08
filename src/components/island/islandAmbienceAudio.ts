import type { IslandAmbience } from '../../domain/island/experience';
import type { IslandExpressionSoundId } from '../../domain/island/expression';

export type IslandSoundscape = IslandAmbience | IslandExpressionSoundId;
type AudibleAmbience = Exclude<IslandSoundscape, 'off'>;
const shellPitches = [1, 1.25, 1.5] as const;

/** Quiet, deterministic PCM: broad low wind, rippling water, and spaced insect
 * calls. No timer schedules more voices; the single buffer loops on the audio clock. */
export function createIslandAmbienceSamples(kind: AudibleAmbience, sampleRate: number, seconds = kind === 'shell-three-notes' ? 14 : 6): Float32Array {
    if (!['breeze', 'brook', 'evening', 'shell-three-notes'].includes(kind) || !Number.isFinite(sampleRate)
        || sampleRate < 8000 || sampleRate > 192000 || !Number.isFinite(seconds) || seconds <= 0 || seconds > 30) throw new Error('Invalid island ambience format');
    const length = Math.max(1, Math.floor(sampleRate * seconds)), result = new Float32Array(length);
    let seed = 27319, low = 0, ripple = 0;
    for (let i = 0; i < length; i += 1) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const noise = seed / 0xffffffff * 2 - 1, t = i / sampleRate;
        low += (noise - low) * .018;
        ripple += (noise - ripple) * .12;
        if (kind === 'breeze') {
            const swell = .72 + .28 * Math.sin(2 * Math.PI * t / seconds);
            result[i] = low * .65 * swell;
        } else if (kind === 'brook') {
            const rippleTone = Math.sin(2 * Math.PI * 430 * t + 2 * Math.sin(2 * Math.PI * 2 * t)) * .011;
            result[i] = (ripple - low) * .14 + rippleTone * (.6 + .4 * Math.sin(2 * Math.PI * 3 * t));
        } else if (kind === 'evening') {
            const phrase = (t % 2) / 2;
            const envelope = phrase < .32 ? Math.sin(Math.PI * phrase / .32) ** 2 : 0;
            const chirp = Math.max(0, Math.sin(2 * Math.PI * 17 * t)) ** 3;
            result[i] = low * .055 + Math.sin(2 * Math.PI * 2700 * t + .8 * Math.sin(2 * Math.PI * 27 * t)) * envelope * chirp * .022;
        } else {
            // Three short shell strikes share the workshop shell's harmonic
            // character. The rest of the 14-second loop is actually silent.
            for (let note = 0; note < 3; note++) {
                const age = t - note * .36;
                if (age < 0 || age >= .58) continue;
                const pitch = shellPitches[note], attack = Math.min(1, age / .004);
                const release = Math.min(1, (.58 - age) / .05), envelope = attack * release * Math.exp(-12 * age);
                result[i] += (Math.sin(2 * Math.PI * 540 * pitch * age) + .5 * Math.sin(2 * Math.PI * 880 * pitch * age)
                    + .25 * Math.sin(2 * Math.PI * 1430 * pitch * age)) * envelope * .06;
            }
        }
        result[i] = Math.max(-.12, Math.min(.12, result[i]));
    }
    // Both ends meet at silence, avoiding an edge click when the buffer loops.
    const edge = Math.min(Math.floor(sampleRate * .04), Math.floor(length / 2));
    for (let i = 0; i < edge; i += 1) {
        const gain = .5 - .5 * Math.cos(Math.PI * i / edge);
        result[i] *= gain;
        result[length - 1 - i] *= gain;
    }
    return result;
}

function browserAudioContext() {
    const Audio = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) throw new Error('Web Audio is unavailable');
    return new Audio();
}

/** One owner, one context, one audible source. stop() disconnects synchronously,
 * then closes the context; a late resume can never resurrect the stopped voice. */
export function createIslandAmbienceAudio(createContext: () => AudioContext = browserAudioContext) {
    let context: AudioContext | undefined;
    let source: AudioBufferSourceNode | undefined;
    let gain: GainNode | undefined;
    let kind: AudibleAmbience | undefined;
    let once = false;
    let generation = 0;
    let starting: Promise<boolean> | undefined;
    const clearVoice = () => {
        if (source) source.onended = null;
        try { source?.stop(); } catch { /* A refused or already-ended source has no remaining voice. */ }
        source?.disconnect(); gain?.disconnect(); source = undefined; gain = undefined;
    };
    const stop = () => {
        generation += 1;
        clearVoice();
        const previous = context;
        context = undefined; kind = undefined; starting = undefined;
        if (previous && previous.state !== 'closed') void previous.close().catch(() => undefined);
    };
    const start = (nextKind: AudibleAmbience, options: { once?: boolean; onEnded?: () => void } = {}): Promise<boolean> => {
        const nextOnce = Boolean(options.once);
        if (!nextOnce && kind === nextKind && once === nextOnce && source && context?.state === 'running') return Promise.resolve(true);
        if (!nextOnce && kind === nextKind && once === nextOnce && starting) return starting;
        const current = ++generation;
        clearVoice(); kind = nextKind; once = nextOnce;
        let target: AudioContext;
        try { target = context ??= createContext(); }
        catch { kind = undefined; return Promise.resolve(false); }
        const attempt = (async () => {
            let timeout: ReturnType<typeof setTimeout> | undefined;
            try {
                if (target.state !== 'running') {
                    await Promise.race([target.resume(), new Promise<void>(resolve => { timeout = setTimeout(resolve, 700); })]);
                }
                if (current !== generation || context !== target) return false;
                if (target.state !== 'running') { stop(); return false; }
                const samples = createIslandAmbienceSamples(nextKind, target.sampleRate, nextOnce ? 2 : undefined);
                const buffer = target.createBuffer(1, samples.length, target.sampleRate);
                buffer.getChannelData(0).set(samples);
                source = target.createBufferSource(); source.buffer = buffer; source.loop = !nextOnce;
                if (nextOnce) source.onended = () => {
                    if (current !== generation || context !== target) return;
                    stop(); options.onEnded?.();
                };
                gain = target.createGain();
                gain.gain.setValueAtTime(0, target.currentTime);
                gain.gain.linearRampToValueAtTime(.35, target.currentTime + .16);
                source.connect(gain); gain.connect(target.destination); source.start();
                return true;
            } catch {
                if (current === generation) stop();
                return false;
            } finally { if (timeout !== undefined) clearTimeout(timeout); }
        })();
        starting = attempt;
        void attempt.finally(() => { if (starting === attempt) starting = undefined; });
        return attempt;
    };
    return { start, stop, dispose: stop };
}

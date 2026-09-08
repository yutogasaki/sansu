export const WORKSHOP_FEEDBACK_KINDS = ['pick', 'wood', 'sand', 'water', 'glass', 'shell', 'assemble', 'discovery'] as const;
export type WorkshopFeedbackKind = typeof WORKSHOP_FEEDBACK_KINDS[number];
export const WORKSHOP_AUDIO_MAX_VOICES = 3;
export const WORKSHOP_AUDIO_GAIN = .35;
export const WORKSHOP_AUDIO_SECONDS: Readonly<Record<WorkshopFeedbackKind, number>> = {
    pick: .075, wood: .12, sand: .15, water: .2, glass: .25, shell: .19, assemble: .23, discovery: .38,
};
const tau = Math.PI * 2;
const tone = (frequency: number, t: number) => Math.sin(tau * frequency * t);
const struck = (t: number, frequency: number, decay: number) => t < 0 ? 0 : tone(frequency, t) * Math.exp(-decay * t) * Math.min(1, t / .003);

/** Short deterministic material sounds with their own attack/release. No
 * learning cue, speech, file fetch, looping voice or delayed timer is involved. */
export function createIslandWorkshopSamples(kind: WorkshopFeedbackKind, sampleRate: number): Float32Array {
    if (!WORKSHOP_FEEDBACK_KINDS.includes(kind) || !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
        throw new Error('Invalid workshop audio format');
    }
    const seconds = WORKSHOP_AUDIO_SECONDS[kind], length = Math.ceil(sampleRate * seconds), samples = new Float32Array(length);
    let seed = 48127, low = 0;
    for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const noise = seed / 0xffffffff * 2 - 1;
        low += (noise - low) * .12;
        let value = 0;
        if (kind === 'pick') value = struck(t, 390, 52) * .08;
        else if (kind === 'wood') value = (struck(t, 245, 36) + struck(t, 570, 48) * .32 + low * Math.exp(-45 * t) * .25) * .08;
        else if (kind === 'sand') value = (noise - low) * (.7 + .3 * tone(73, t)) * Math.exp(-7 * t) * .075;
        else if (kind === 'water') {
            const bubble = (time: number) => time < 0 ? 0 : Math.sin(tau * (820 * time - 1450 * time ** 2)) * Math.exp(-31 * time) * Math.min(1, time / .006);
            value = (bubble(t) + bubble(t - .065) * .58 + low * Math.exp(-24 * t) * .24) * .072;
        } else if (kind === 'glass') value = (struck(t, 1580, 19) + struck(t, 2770, 31) * .3 + struck(t, 3310, 38) * .16) * .06;
        else if (kind === 'shell') value = (struck(t, 540, 22) + struck(t, 880, 34) * .5 + struck(t, 1430, 38) * .25) * .067;
        else if (kind === 'assemble') value = (struck(t, 270, 43) + struck(t - .075, 410, 34) * .85) * .09;
        else value = (struck(t, 620, 24) + struck(t - .095, 830, 24) * .85 + struck(t - .19, 990, 24) * .72) * .075;
        const attack = Math.min(1, i / Math.max(1, sampleRate * .003));
        const release = Math.min(1, (length - 1 - i) / Math.max(1, sampleRate * .025));
        const envelope = Math.sin(Math.PI * attack / 2) ** 2 * Math.sin(Math.PI * release / 2) ** 2;
        samples[i] = Math.max(-.12, Math.min(.12, value * envelope));
    }
    return samples;
}

function browserAudioContext(): AudioContext {
    const Audio = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) throw new Error('Web Audio unavailable');
    return new Audio();
}
interface Voice { source: AudioBufferSourceNode }

/** An independent owner: unlock is called by a user gesture, play only uses
 * that running context. setActive(false)/stop cut output synchronously and
 * release the context/cache. dispose is terminal; stop allows a later gesture. */
export function createIslandWorkshopAudio(createContext: () => AudioContext = browserAudioContext) {
    let context: AudioContext | undefined, master: GainNode | undefined;
    let pending: Promise<boolean> | undefined, generation = 0, unlocked = false, active = true, disposed = false;
    const buffers = new Map<WorkshopFeedbackKind, AudioBuffer>(), voices = new Set<Voice>();
    const releaseVoice = (voice: Voice, stop: boolean) => {
        if (!voices.delete(voice)) return;
        voice.source.onended = null;
        if (stop) { try { voice.source.stop(); } catch { /* Already ended or refused to start. */ } }
        try { voice.source.disconnect(); } catch { /* The context may already be closed by the browser. */ }
        voice.source.buffer = null;
    };
    const stop = () => {
        generation++; unlocked = false; pending = undefined;
        for (const voice of voices) releaseVoice(voice, true);
        try { master?.disconnect(); } catch { /* Already disconnected. */ }
        master = undefined; buffers.clear();
        const previous = context; context = undefined;
        if (previous && previous.state !== 'closed') {
            try { void previous.close().catch(() => undefined); } catch { /* Audio failure cannot block leaving for learning. */ }
        }
    };
    const setActive = (enabled: boolean) => { active = enabled; if (!active) stop(); };
    const unlock = (): Promise<boolean> => {
        if (!active || disposed) return Promise.resolve(false);
        if (unlocked && context?.state === 'running') return Promise.resolve(true);
        if (pending) return pending;
        const current = ++generation;
        let target: AudioContext;
        try { target = context ??= createContext(); }
        catch { return Promise.resolve(false); }
        if (target.state !== 'running') for (const voice of voices) releaseVoice(voice, true);
        const attempt = (async () => {
            let timeout: ReturnType<typeof setTimeout> | undefined;
            try {
                if (target.state !== 'running') await Promise.race([target.resume(), new Promise<void>(resolve => { timeout = setTimeout(resolve, 700); })]);
                if (current !== generation || context !== target || !active || disposed) return false;
                if (target.state !== 'running') { stop(); return false; }
                if (!master) { master = target.createGain(); master.connect(target.destination); }
                master.gain.setValueAtTime(WORKSHOP_AUDIO_GAIN, target.currentTime); unlocked = true;
                return true;
            } catch { if (current === generation) stop(); return false; }
            finally { if (timeout !== undefined) clearTimeout(timeout); }
        })();
        pending = attempt;
        void attempt.finally(() => { if (pending === attempt) pending = undefined; });
        return attempt;
    };
    const play = (kind: WorkshopFeedbackKind): boolean => {
        if (!active || disposed || !unlocked || !context || context.state !== 'running' || !master || !WORKSHOP_FEEDBACK_KINDS.includes(kind)) return false;
        let voice: Voice | undefined;
        try {
            let buffer = buffers.get(kind);
            if (!buffer) {
                const samples = createIslandWorkshopSamples(kind, context.sampleRate);
                buffer = context.createBuffer(1, samples.length, context.sampleRate);
                buffer.getChannelData(0).set(samples); buffers.set(kind, buffer);
            }
            if (voices.size >= WORKSHOP_AUDIO_MAX_VOICES) releaseVoice(voices.values().next().value!, true);
            const source = context.createBufferSource(); source.buffer = buffer; source.loop = false;
            voice = { source }; const owner = voice;
            voices.add(owner); source.onended = () => releaseVoice(owner, false);
            source.connect(master); source.start();
            return true;
        } catch { if (voice) releaseVoice(voice, true); return false; }
    };
    const dispose = () => { disposed = true; stop(); };
    return { unlock, play, stop, setActive, dispose };
}

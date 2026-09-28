import { createLearningCue, createLearningStems, LEARNING_BEAT_SECONDS, LEARNING_CUES, learningChordAt, learningInputPitch,
    learningStemLevels, type LearningMusicCue } from './learningMusicScore';

export const LEARNING_MAX_CUE_VOICES = 6;
interface Voice { source: AudioBufferSourceNode; gain?: GainNode }
function browserAudioContext(): AudioContext {
    const Audio = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) throw new Error('Web Audio unavailable');
    return new Audio();
}

/** Four finite looping stems share one clock. There is no beat timer or future
 * node queue to wake up after departure. Only a fresh gesture can start audio. */
export function createLearningMusic(createContext: () => AudioContext = browserAudioContext, onPlaybackChange: () => void = () => undefined) {
    let context: AudioContext | undefined, master: GainNode | undefined, music: GainNode | undefined, filter: BiquadFilterNode | undefined;
    let pending: Promise<boolean> | undefined, epoch = 0, generation = 0, active = true, disposed = false, unlocked = false;
    let level = 0, reach = false, lastPitch = 72;
    const stems: Voice[] = [], cues = new Set<Voice>();
    const release = (voice: Voice, stop: boolean) => {
        voice.source.onended = null;
        if (stop) { try { voice.source.stop(); } catch { /* Ended/refused sources are already silent. */ } }
        try { voice.source.disconnect(); voice.gain?.disconnect(); } catch { /* A browser may have closed the graph. */ }
        voice.source.buffer = null;
    };
    const releaseCue = (voice: Voice, stop: boolean) => { if (cues.delete(voice)) release(voice, stop); };
    const stop = () => {
        generation++; pending = undefined; unlocked = false;
        for (const voice of stems.splice(0)) release(voice, true);
        for (const voice of cues) releaseCue(voice, true);
        try { filter?.disconnect(); music?.disconnect(); master?.disconnect(); } catch { /* Already closed. */ }
        filter = undefined; music = undefined; master = undefined;
        const previous = context; context = undefined;
        if (previous) previous.onstatechange = null;
        onPlaybackChange();
        if (previous && previous.state !== 'closed') {
            try { void previous.close().catch(() => undefined); } catch { /* Learning remains usable without sound. */ }
        }
    };
    const applyMix = () => {
        if (!context || !filter || !music) return;
        const at = context.currentTime, levels = learningStemLevels(level);
        stems.forEach((voice, index) => voice.gain?.gain.setTargetAtTime(levels[index], at, .12));
        // Anticipation narrows the backing track; the successful contact opens it.
        filter.frequency.setTargetAtTime(reach ? 620 : 9000, at, reach ? .18 : .045);
        music.gain.setTargetAtTime(reach ? .2 : .36, at, reach ? .16 : .045);
    };
    const setIntensity = (nextLevel: number, nextReach: boolean) => {
        const enteringReach = nextReach && !reach;
        level = nextLevel; reach = nextReach; applyMix();
        if (enteringReach) cue('rise');
    };
    const setActive = (next: boolean) => { active = next; if (!active) stop(); };
    const unlock = (): Promise<boolean> => {
        if (!active || disposed) return Promise.resolve(false);
        if (unlocked && context?.state === 'running') return Promise.resolve(true);
        if (pending) return pending;
        // A browser interruption does not keep a graph of old tails alive.
        if (context) stop();
        const current = ++generation;
        let target: AudioContext;
        try { target = context = createContext(); target.onstatechange = () => { if (context === target) onPlaybackChange(); }; } catch { return Promise.resolve(false); }
        const attempt = (async () => {
            let timeout: ReturnType<typeof setTimeout> | undefined;
            try {
                if (target.state !== 'running') await Promise.race([target.resume(), new Promise<void>(resolve => { timeout = setTimeout(resolve, 700); })]);
                if (current !== generation || context !== target || !active || disposed) return false;
                if (target.state !== 'running') { stop(); return false; }
                master = target.createGain(); master.gain.setValueAtTime(.68, target.currentTime); master.connect(target.destination);
                music = target.createGain(); music.gain.setValueAtTime(0, target.currentTime);
                filter = target.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.setValueAtTime(.5, target.currentTime);
                filter.connect(music); music.connect(master);
                const samples = createLearningStems(target.sampleRate);
                // Buffer creation happens before establishing the common start time.
                const buffers = samples.map(data => {
                    const buffer = target.createBuffer(1, data.length, target.sampleRate); buffer.getChannelData(0).set(data); return buffer;
                });
                epoch = target.currentTime + .015;
                buffers.forEach(buffer => {
                    const source = target.createBufferSource(), gain = target.createGain();
                    const voice = { source, gain }; stems.push(voice);
                    source.buffer = buffer; source.loop = true; source.connect(gain); gain.connect(filter!);
                    gain.gain.setValueAtTime(0, target.currentTime); source.start(epoch);
                });
                unlocked = true; applyMix(); onPlaybackChange(); return true;
            } catch { if (current === generation) stop(); return false; }
            finally { if (timeout !== undefined) clearTimeout(timeout); }
        })();
        pending = attempt;
        void attempt.finally(() => { if (pending === attempt) pending = undefined; });
        return attempt;
    };
    const elapsed = () => context ? Math.max(0, context.currentTime - epoch) : 0;
    const cue = (kind: LearningMusicCue): boolean => {
        if (!active || disposed || !unlocked || context?.state !== 'running' || !master || !LEARNING_CUES.includes(kind)) return false;
        let voice: Voice | undefined;
        try {
            if (kind === 'peak') { reach = false; applyMix(); }
            const data = createLearningCue(kind, context.sampleRate, lastPitch, learningChordAt(elapsed()), level);
            const buffer = context.createBuffer(1, data.length, context.sampleRate); buffer.getChannelData(0).set(data);
            if (cues.size >= LEARNING_MAX_CUE_VOICES) releaseCue(cues.values().next().value!, true);
            const source = context.createBufferSource(); voice = { source }; cues.add(voice);
            const owner = voice; source.buffer = buffer; source.loop = false;
            source.onended = () => releaseCue(owner, false); source.connect(master); source.start(); return true;
        } catch { if (voice) releaseCue(voice, true); return false; }
    };
    const input = (digit: string) => { lastPitch = learningInputPitch(elapsed(), digit); return cue('tap'); };
    const pulse = () => {
        if (!active || disposed || !unlocked || context?.state !== 'running' || context.currentTime < epoch) return 0;
        const phase = (elapsed() / LEARNING_BEAT_SECONDS) % 1;
        return Math.exp(-phase * 7);
    };
    const dispose = () => { disposed = true; stop(); };
    const isReady = () => active && !disposed && unlocked && context?.state === 'running';
    return { isReady, unlock, input, cue, pulse, setIntensity, setActive, stop, dispose };
}

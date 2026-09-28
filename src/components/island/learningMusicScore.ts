/** Original four-bar score. Notes, timbres and envelopes are generated locally;
 * no recording, sample, melody or character asset is taken from the reference. */
export const LEARNING_BEAT_SECONDS = .5;
export const LEARNING_LOOP_SECONDS = 8;
export const LEARNING_STEM_COUNT = 4;
export const LEARNING_CUES = ['tap', 'catch', 'place', 'correct', 'step', 'retry', 'jump', 'land', 'peak'] as const;
export type LearningMusicCue = typeof LEARNING_CUES[number];
const chords = [[60, 64, 67, 69], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 64]] as const;
const tau = Math.PI * 2;
const midiHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const format = (sampleRate: number) => {
    if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new Error('Invalid learning audio format');
};

export function learningChordAt(seconds: number): readonly number[] {
    const position = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    return chords[Math.floor(position / 2) % chords.length];
}

/** The key is always a chord tone of the audible bar, including its boundary. */
export function learningInputPitch(seconds: number, digit: string): number {
    const key = /^\d$/.test(digit) ? Number(digit) : 0;
    const chord = learningChordAt(seconds);
    return chord[key % chord.length] + 12 + (key >= 8 ? 12 : 0);
}

export function learningStemLevels(level: number): readonly number[] {
    const value = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;
    const rise = (from: number, to: number) => Math.min(1, Math.max(0, (value - from) / (to - from)));
    return [1, rise(.08, .32), rise(.28, .6), rise(.55, .9)];
}

function note(samples: Float32Array, sampleRate: number, at: number, duration: number, midi: number, amplitude: number, soft = false) {
    const start = Math.round(at * sampleRate), end = Math.min(samples.length, Math.ceil((at + duration) * sampleRate));
    const frequency = midiHz(midi);
    for (let i = start; i < end; i++) {
        const t = (i - start) / sampleRate;
        const envelope = Math.min(1, t / .005) * Math.min(1, (end - 1 - i) / (sampleRate * .025)) * Math.exp(-t * (soft ? 4 : 11));
        const wave = Math.sin(tau * frequency * t) + Math.sin(tau * frequency * 2 * t) * (soft ? .1 : .26)
            + Math.sin(tau * frequency * 3 * t) * (soft ? .025 : .07);
        samples[i] += wave * envelope * amplitude;
    }
}

function drum(samples: Float32Array, sampleRate: number, at: number, kind: 'kick' | 'clap' | 'shaker', amplitude: number) {
    const start = Math.round(at * sampleRate), duration = kind === 'kick' ? .16 : kind === 'clap' ? .1 : .035;
    const end = Math.min(samples.length, Math.ceil((at + duration) * sampleRate));
    let seed = 19273 + start, low = 0;
    for (let i = start; i < end; i++) {
        const t = (i - start) / sampleRate;
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const noise = seed / 0xffffffff * 2 - 1; low += (noise - low) * .15;
        const wave = kind === 'kick' ? Math.sin(tau * (52 * t + 4 * (1 - Math.exp(-32 * t))))
            : kind === 'clap' ? noise * (.55 + .45 * Math.cos(tau * 41 * t)) : noise - low;
        const envelope = Math.min(1, t / .002) * Math.min(1, (end - 1 - i) / (sampleRate * .008)) * Math.exp(-t * (kind === 'kick' ? 26 : 45));
        samples[i] += wave * envelope * amplitude;
    }
}

export function createLearningStems(sampleRate: number): Float32Array[] {
    format(sampleRate);
    const stems = Array.from({ length: LEARNING_STEM_COUNT }, () => new Float32Array(Math.round(LEARNING_LOOP_SECONDS * sampleRate)));
    const melody = [0, 2, 1, 3, 2, 1, 3, 2];
    for (let bar = 0; bar < 4; bar++) {
        const chord = chords[bar], start = bar * 2;
        for (let step = 0; step < 8; step++) {
            note(stems[0], sampleRate, start + step * .25, .21, chord[melody[step]] + 12, step % 2 === 0 ? .08 : .05);
            drum(stems[2], sampleRate, start + step * .25, 'shaker', step % 2 === 0 ? .028 : .048);
        }
        for (let beat = 0; beat < 4; beat++) {
            note(stems[1], sampleRate, start + beat * .5, .32, chord[beat % 2 === 0 ? 0 : 2] - 12, .075, true);
            drum(stems[1], sampleRate, start + beat * .5, 'kick', .055);
            if (beat % 2 === 1) drum(stems[2], sampleRate, start + beat * .5, 'clap', .055);
        }
        for (const beat of [0, 1.5]) for (const pitch of chord) note(stems[3], sampleRate, start + beat, .42, pitch, .019, true);
        note(stems[3], sampleRate, start + 1.25, .24, chord[2] + 24, .036);
    }
    return stems;
}

export function createLearningCue(kind: LearningMusicCue, sampleRate: number, pitch: number, chord: readonly number[] = chords[0]): Float32Array {
    format(sampleRate);
    if (!LEARNING_CUES.includes(kind) || !Number.isFinite(pitch) || pitch < 24 || pitch > 108) throw new Error('Invalid learning cue');
    const seconds = kind === 'peak' ? .7 : kind === 'correct' ? .39 : kind === 'jump' ? .27 : .18;
    const samples = new Float32Array(Math.ceil(seconds * sampleRate));
    if (kind === 'land') drum(samples, sampleRate, 0, 'kick', .12);
    else if (kind === 'retry') note(samples, sampleRate, 0, .16, pitch - 12, .055, true);
    else if (kind === 'peak' || kind === 'correct') {
        // Interval order comes from the current chord rather than a competing jingle key.
        for (let i = 0; i < (kind === 'peak' ? 4 : 3); i++) note(samples, sampleRate, i * .055, kind === 'peak' ? .42 : .22, chord[i] + 12, .085);
        if (kind === 'peak') drum(samples, sampleRate, 0, 'clap', .08);
    } else {
        const offset = kind === 'catch' ? -12 : kind === 'place' ? 0 : kind === 'jump' ? 7 : kind === 'step' ? 12 : 0;
        note(samples, sampleRate, 0, seconds, Math.min(108, pitch + offset), kind === 'tap' ? .095 : .075);
    }
    return samples;
}

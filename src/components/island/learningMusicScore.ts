/** Original eight-bar score. Notes, timbres and envelopes are generated locally;
 * no recording, sample, melody or character asset is taken from the reference. */
export const LEARNING_BEAT_SECONDS = .5;
export const LEARNING_LOOP_SECONDS = 16;
export const LEARNING_STEM_COUNT = 4;
export const LEARNING_CUES = ['tap', 'catch', 'place', 'correct', 'step', 'retry', 'jump', 'land', 'peak', 'section', 'rise'] as const;
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

type Timbre = 'mallet' | 'bass' | 'bell' | 'pad';
function note(samples: Float32Array, sampleRate: number, at: number, duration: number, midi: number, amplitude: number, timbre: Timbre = 'mallet') {
    const start = Math.round(at * sampleRate), end = Math.min(samples.length, Math.ceil((at + duration) * sampleRate));
    const frequency = midiHz(midi);
    const partials: readonly (readonly [number, number, number])[] = timbre === 'bell'
        ? [[1, 1, 6], [2.76, .22, 16], [4, .08, 22]]
        : timbre === 'bass' ? [[1, 1, 5], [2, .24, 10], [3, .07, 16]]
        : timbre === 'pad' ? [[1, 1, 2], [2, .14, 3], [3, .04, 4]]
        : [[1, 1, 12], [3, .24, 26], [6, .07, 45]];
    const audible = partials.filter(([ratio]) => frequency * ratio < sampleRate * .45);
    const steps = audible.map(([ratio]) => tau * frequency * ratio / sampleRate);
    const gains = audible.map(([, gain]) => gain);
    const decays = audible.map(([, , decay]) => Math.exp(-decay / sampleRate));
    for (let i = start; i < end; i++) {
        const position = i - start, t = position / sampleRate;
        const envelope = Math.min(1, t / (timbre === 'pad' ? .035 : .004))
            * Math.min(1, (end - 1 - i) / (sampleRate * .025));
        let wave = 0;
        for (let partial = 0; partial < audible.length; partial++) {
            wave += Math.sin(steps[partial] * position) * gains[partial];
            gains[partial] *= decays[partial];
        }
        samples[i] += wave * envelope * amplitude;
    }
}

/** A tiny baked room: no live delay nodes or tails surviving mute/exit.
 * Dry sound dominates both channels, including when summed to mono. */
export function learningStereo(samples: Float32Array, sampleRate: number, loop = false): [Float32Array, Float32Array] {
    return [0, 1].map(channel => {
        const result = new Float32Array(samples.length);
        const delays = (channel === 0 ? [.029, .071] : [.041, .089]).map(seconds => Math.round(seconds * sampleRate));
        for (let i = 0; i < samples.length; i++) {
            let value = samples[i];
            for (let reflection = 0; reflection < delays.length; reflection++) {
                const source = i - delays[reflection];
                if (source >= 0) value += samples[source] * (reflection === 0 ? .12 : .065);
                else if (loop) value += samples[(source + samples.length) % samples.length] * (reflection === 0 ? .12 : .065);
            }
            const fade = loop ? 1 : Math.min(1, (samples.length - 1 - i) / (sampleRate * .025));
            result[i] = value * fade / 1.185;
        }
        return result;
    }) as [Float32Array, Float32Array];
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
    // A question-and-answer phrase, with breathing space between the motifs.
    const phrases = [[0, 2, 1, -1, 3, 2, -1, 1], [2, -1, 3, 2, 1, -1, 2, 0]];
    for (let bar = 0; bar < 8; bar++) {
        const chord = chords[bar % 4], start = bar * 2, phrase = phrases[Math.floor(bar / 4)];
        for (let step = 0; step < 8; step++) {
            const at = start + step * .25 + (step % 2 ? .018 : 0);
            if (phrase[step] >= 0) note(stems[0], sampleRate, at, .23, chord[phrase[step]] + 12, step % 2 === 0 ? .079 : .052);
            drum(stems[2], sampleRate, at, 'shaker', step % 2 === 0 ? .019 : .032);
        }
        for (let beat = 0; beat < 4; beat++) {
            note(stems[1], sampleRate, start + beat * .5, .35, chord[beat % 2 === 0 ? 0 : 2] - 12, .075, 'bass');
            drum(stems[1], sampleRate, start + beat * .5, 'kick', .045);
            if (beat % 2 === 1) drum(stems[2], sampleRate, start + beat * .5, 'clap', .046);
        }
        if (bar % 4 === 3) for (const at of [1.625, 1.75]) drum(stems[2], sampleRate, start + at, 'clap', .026);
        for (const beat of [.25, 1.25]) for (const pitch of chord) note(stems[3], sampleRate, start + beat, .5, pitch, .017, 'pad');
        note(stems[3], sampleRate, start + .75, .38, chord[2] + 24, .032, 'bell');
        if (bar >= 4) note(stems[3], sampleRate, start + 1.5, .4, chord[1] + 24, .026, 'bell');
    }
    return stems;
}

export function createLearningCue(kind: LearningMusicCue, sampleRate: number, pitch: number, chord: readonly number[] = chords[0], level = 0): Float32Array {
    format(sampleRate);
    if (!LEARNING_CUES.includes(kind) || !Number.isFinite(pitch) || pitch < 24 || pitch > 108) throw new Error('Invalid learning cue');
    const progress = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;
    const seconds = kind === 'peak' || kind === 'section' ? .7 : kind === 'correct' ? .55 : kind === 'rise' ? .38 : kind === 'jump' ? .27 : .18;
    const samples = new Float32Array(Math.ceil(seconds * sampleRate));
    if (kind === 'land') drum(samples, sampleRate, 0, 'kick', .12);
    else if (kind === 'retry') note(samples, sampleRate, 0, .16, pitch - 12, .055, 'pad');
    else if (kind === 'rise') {
        // A short upward pickup announces anticipation without a looping alarm.
        for (let i = 0; i < 3; i++) note(samples, sampleRate, i * .07, .18, chord[i] + 12, .036, 'bell');
    } else if (kind === 'peak' || kind === 'section' || kind === 'correct') {
        // Every note belongs to the playing bar. Progress adds orchestration,
        // rather than escalating volume or restarting the music after a miss.
        const count = kind === 'section' ? 6 : kind === 'peak' ? 5 : 3 + Math.round(progress * 2);
        for (let i = 0; i < count; i++) note(samples, sampleRate, i * .055,
            kind === 'correct' ? .24 : .36, chord[i % chord.length] + 12 + (i >= chord.length ? 12 : 0), .055, i % 2 === 0 ? 'mallet' : 'bell');
        if (kind !== 'correct' || progress >= .6) drum(samples, sampleRate, 0, 'kick', .065);
        if (kind === 'peak') {
            drum(samples, sampleRate, .025, 'clap', .04);
            for (const tone of chord.slice(0, 3)) note(samples, sampleRate, .22, .44, tone, .019, 'pad');
            note(samples, sampleRate, .36, .32, chord[0] + 24, .035, 'bell');
        }
        if (kind === 'section') for (const tone of chord.slice(0, 3)) note(samples, sampleRate, .32, .34, tone, .022, 'pad');
    } else {
        const offset = kind === 'catch' ? -12 : kind === 'place' ? 0 : kind === 'jump' ? 7 : kind === 'step' ? 12 : 0;
        note(samples, sampleRate, 0, seconds, Math.min(108, pitch + offset), kind === 'tap' ? .088 : .068, kind === 'place' || kind === 'step' ? 'bell' : 'mallet');
    }
    return samples;
}

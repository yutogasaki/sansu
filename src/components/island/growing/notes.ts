import type { Species } from '../../../domain/growingIsland';

/** A gentle pentatonic: whatever order friends are touched in, it sounds pleasant. */
const SCALE = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3, 784];
const SPECIES_NOTE: Record<Species | 'pokomoko', number> = {
    pokomoko: 0, hedgehog: 1, otter: 2, rabbit: 3, fox: 4, duck: 5, squirrel: 6, bird: 7, girl: 8, boy: 5, penguin: 1, owl: 0, frog: 6,
};
let context: AudioContext | undefined;
const notes = new Set<() => void>(), tapNotes: (() => void)[] = [];
export function stopNotes() { for (const stop of [...notes]) stop(); tapNotes.length = 0; }

function audio() {
    try {
        const Audio = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        context ??= Audio ? new Audio() : undefined;
        if (context?.state === 'suspended') void context.resume();
        return context;
    } catch { return undefined; }
}

/** One soft marimba-like note. Called from a tap, so browsers allow it to sound. */
export function playNote(index: number, at = 0) {
    if (at === 0 && tapNotes.length >= 3) tapNotes.shift()?.();
    const stop = playFrequency(SCALE[((index % SCALE.length) + SCALE.length) % SCALE.length], at);
    if (stop && at === 0) tapNotes.push(stop);
}

function playFrequency(frequency: number, at: number) {
    const ctx = audio(); if (!ctx) return;
    const start = ctx.currentTime + at;
    const gain = ctx.createGain(); gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.22, start + .01); gain.gain.exponentialRampToValueAtTime(.001, start + .9);
    const oscillators: OscillatorNode[] = [], parts: GainNode[] = [];
    let ended = false;
    const stop = () => {
        if (ended) return; ended = true;
        for (const osc of oscillators) { try { osc.stop(); } catch { /* Already ended. */ } osc.disconnect(); }
        parts.forEach(part => part.disconnect()); gain.disconnect(); notes.delete(stop);
        const index = tapNotes.indexOf(stop); if (index >= 0) tapNotes.splice(index, 1);
    };
    notes.add(stop);
    for (const [ratio, level] of [[1, 1], [4, .18]] as const) {
        const osc = ctx.createOscillator(), part = ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = frequency * ratio; part.gain.value = level;
        oscillators.push(osc); parts.push(part);
        if (ratio === 1) osc.onended = stop;
        osc.connect(part); part.connect(gain); osc.start(start); osc.stop(start + 1);
    }
    return stop;
}

export const noteFor = (species: Species | 'pokomoko') => SPECIES_NOTE[species];

const C = 261.6, D = 293.7, E = 329.6, F = 349.2, G = 392, A = 440;
/** Traditional tunes in the public domain, taking turns at each concert (melody only). */
export const TUNES: readonly { name: string; notes: number[] }[] = [
    { name: 'きらきら ぼし', notes: [C, C, G, G, A, A, G, 0, F, F, E, E, D, D, C] },
    { name: 'かえるの うた', notes: [C, D, E, F, E, D, C, 0, E, F, G, A, G, F, E] },
    { name: 'メリーさんの ひつじ', notes: [E, D, C, D, E, E, E, 0, D, D, D, 0, E, G, G] },
    { name: 'ぶんぶんぶん', notes: [G, F, E, 0, D, E, F, D, C, 0, E, F, G, E, F, G, A, F, E] },
];
/** Plays one tune; returns how long it lasts in milliseconds. */
export function playTune(enabled: boolean, index = 0) {
    if (!enabled) return 0;
    const tune = TUNES[((index % TUNES.length) + TUNES.length) % TUNES.length].notes;
    tune.forEach((frequency, i) => { if (frequency) playFrequency(frequency, i * .32); });
    return tune.length * 320;
}

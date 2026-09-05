import type { PlayBeat } from '../../domain/park/simulation';

export const BEAT_MS = 850;
export const beatDuration = (beat: PlayBeat) => beat.action === 'walk'
    ? (beat.fast ? 650 : 1000)
    : BEAT_MS + (beat.popped ? 650 : 0);

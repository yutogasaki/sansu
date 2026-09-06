import type { PartKind } from '../../domain/park/types';
import { threeParkRequested, supportsThreePark } from './three/config';
import { threeBeatDuration } from './three/choreography';
import type { PlayBeat } from '../../domain/park/simulation';

export const BEAT_MS = 850;
export const beatDuration = (beat: PlayBeat) => beat.action === 'walk'
    ? (beat.fast ? 650 : 1000)
    : BEAT_MS + (beat.popped ? 650 : 0);

export const parkBeatDuration = (beat: PlayBeat, layout: readonly (PartKind | null)[]) =>
    threeParkRequested() && supportsThreePark(layout) ? threeBeatDuration(beat) : beatDuration(beat);

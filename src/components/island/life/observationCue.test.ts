import { describe, expect, it } from 'vitest';
import { observationItemLabel, observationSnapshot, observationTransitions } from './observationCue';
import type { LifeState } from '../../../domain/islandLife/model';

const state = (discovery?: LifeState['residents'][number]['discovery'], placed = true): Pick<LifeState, 'residents' | 'items'> => ({
    residents: [
        { id: 'pokomoko', cell: { x: 0, z: 1 }, enjoyed: 0, enjoyedBy: {} },
        { id: 'rabbit', cell: { x: 0, z: 2 }, enjoyed: 0, enjoyedBy: {}, discovery },
        { id: 'otter', cell: { x: 0, z: 3 }, enjoyed: 0, enjoyedBy: {} },
    ],
    items: [{ id: 'flower-1', kind: 'flower', cell: placed ? { x: 1, z: 2 } : undefined, growth: 0, style: 'original' }],
});

describe('living-island observation cues', () => {
    it('does not announce the initial snapshot or an unchanged discovery', () => {
        const initial = state();
        expect(observationTransitions(initial, undefined)).toEqual([]);
        const discovered = state({ itemId: 'flower-1', at: 10, mood: 'notice' });
        const snapshot = observationSnapshot(discovered);
        expect(observationTransitions(discovered, snapshot)).toEqual([]);
    });

    it('turns new notice and curious discoveries into short readable replies', () => {
        const noticed = state({ itemId: 'flower-1', at: 10, mood: 'notice' });
        expect(observationTransitions(noticed, {})).toMatchObject([{ residentId: 'rabbit', itemId: 'flower-1', symbol: '!', message: 'うさぎが おはなを みつけたよ' }]);
        const curious = state({ itemId: 'flower-1', at: 11, mood: 'curious' });
        expect(observationTransitions(curious, {})).toMatchObject([{ symbol: '?', message: 'うさぎが おはなを みているよ' }]);
    });

    it('ignores stored or missing discoveries and keeps item labels in one catalog', () => {
        const hidden = state({ itemId: 'flower-1', at: 10, mood: 'notice' }, false);
        expect(observationTransitions(hidden, {})).toEqual([]);
        expect(observationItemLabel({ kind: 'flower' })).toBe('おはな');
    });
});

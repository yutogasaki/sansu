import { expect, it } from 'vitest';
import { newLife, type LifeState } from '../../../domain/islandLife/model';
import { replayLife } from '../../../domain/islandLife/simulation';
import { canReuseLifeScene } from './sceneReuse';
import { previewPlacement } from './placement';

function island() {
    const state = replayLife(newLife('scene-reuse', 1_000));
    state.items = [{ id: 'flower', kind: 'flower', cell: { x: 0, z: 0 }, growth: 1, style: 'original' }];
    return state;
}

it('keeps the scene during an ordinary saved clock refresh while visits continue', () => {
    const original = island();
    const advanced: LifeState = { ...structuredClone(original), now: original.now + 15_000,
        residents: original.residents.map(resident => ({ ...resident, cell: { x: 1, z: 1 } })) };
    expect(canReuseLifeScene({ state: original, changeKey: 'same-events' },
        { state: advanced, changeKey: 'same-events' })).toBe(true);
});

it('rebuilds after a command, a visible growth stage, or a long background gap', () => {
    const original = island(), previous = { state: original, changeKey: 'before' };
    expect(canReuseLifeScene(previous, { state: { ...original, now: original.now + 15_000 }, changeKey: 'after' })).toBe(false);
    expect(canReuseLifeScene(previous, { state: { ...original, items: [{ ...original.items[0], growth: 6 }] }, changeKey: 'before' })).toBe(false);
    expect(canReuseLifeScene(previous, { state: { ...original, now: original.now + 61_000 }, changeKey: 'before' })).toBe(false);
});

it('rebuilds when placement or scene settings change', () => {
    const original = island(), previous = { state: original, changeKey: 'same-events' };
    expect(canReuseLifeScene(previous, { ...previous, selected: 'flower' })).toBe(false);
    expect(canReuseLifeScene(previous, { ...previous, state: { ...original, heroStyle: 'sunshine' } })).toBe(false);
});

it('keeps an open placement preview through growth within the same visible stage', () => {
    const original = island(), advanced = { ...original, now: original.now + 15_000,
        items: [{ ...original.items[0], growth: 1.1 }] };
    const before = { state: original, changeKey: 'same-events', placement: previewPlacement(original, original.items[0], { x: 1, z: 1 }) };
    const after = { state: advanced, changeKey: 'same-events', placement: previewPlacement(advanced, advanced.items[0], { x: 1, z: 1 }) };
    expect(canReuseLifeScene(before, after)).toBe(true);
});

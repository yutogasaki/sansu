import { describe, expect, it } from 'vitest';
import { applyIntent } from '../../../domain/growingIsland/commands';
import { newIsland } from '../../../domain/growingIsland/island';
import { derivePlaces } from '../../../domain/growingIsland/places';
import type { Cell, GrowingState } from '../../../domain/growingIsland/types';
import type { Ghost } from './objectLayer';
import { growingScenePreviewKey, growingSceneStateKey } from './growingSceneInputs';

function island() {
    const state = newIsland('scene-inputs', 1000);
    state.tutorial = 'done'; state.guidance!.starter.automatic = false;
    state.landmarks = [{ id: 't1', kind: 'sapling', cell: { x: 0, z: 3 }, growth: 18, maturedAt: 0 },
        { id: 't2', kind: 'sapling', cell: { x: 2, z: 3 }, growth: 18, maturedAt: 0 },
        { id: 'seat', kind: 'bench', cell: { x: 1, z: 4 }, growth: 0 }];
    state.plots = [{ id: 'home', kind: 'home', cell: { x: 4, z: 2 }, stage: 2, style: 'tree', roof: 0,
        plantedAt: 0, growth: 0, origin: 'seed', paid: 4 }];
    state.villagers = [{ id: 'friend', species: 'otter', home: 'home', arrivedAt: 0, trait: 'mellow',
        variant: { color: 0, accessory: 0, sparkle: false } }];
    return state;
}

describe('GrowingWorld saved scene inputs', () => {
    it('keeps the same scene key after validated shown/use receipts while saving their evidence', () => {
        const state = island(), before = structuredClone(state), sceneKey = growingSceneStateKey(state);
        const place = derivePlaces(state).find(place => place.ruleId === 'P01' && place.stage === 'grown')!;
        expect(place).toBeDefined();
        const shown = applyIntent(state, { id: 'shown', command: { type: 'place-shown', profileId: state.seed,
            expectedRevision: 0, ruleId: place.ruleId, revision: place.revision } }, 1000).state;
        const receipt = { type: 'place-used' as const, profileId: state.seed, expectedRevision: 0, ruleId: place.ruleId,
            placeId: place.id, revision: place.revision, actorId: 'pokomoko', targetId: place.useTargets[0].id };
        const used = applyIntent(shown, { id: 'used', command: receipt }, 1001).state;
        expect(shown).not.toBe(state); expect(used).not.toBe(shown);
        expect(shown.placeProgress!.shown.P01).toBe(place.revision);
        expect(used.placeProgress!.uses.P01!.pokomoko).toMatchObject({ actorId: 'pokomoko', targetId: 'seat', at: 1001 });
        expect(used.applied).toEqual(['shown', 'used']);
        expect(growingSceneStateKey(shown)).toBe(sceneKey);
        expect(growingSceneStateKey(used)).toBe(sceneKey);
        expect(derivePlaces(used)).toEqual(derivePlaces(state));
        expect(() => applyIntent(used, { id: 'stale', command: { ...receipt, revision: 'stale-shape' } }, 1002)).toThrow();
        expect(state).toEqual(before);
    });

    const changes: [string, (state: GrowingState) => void][] = [
        ['owner position', state => { state.landmarks[0].cell!.x += 1; }],
        ['owner storage', state => { state.landmarks[0].cell = undefined; }],
        ['owner growth', state => { state.landmarks[0].growth += 1; }],
        ['owner stage', state => { state.plots[0].stage = 3; }],
        ['owner style', state => { state.plots[0].style = 'water'; }],
        ['owner roof', state => { state.plots[0].roof = 1; }],
        ['owner colour', state => { state.landmarks[0].color = 'red'; }],
        ['nature age', state => { state.nature.hours += 1; }],
        ['town clock', state => { state.town.clock += 1; }],
        ['town bank', state => { state.town.bank += 1; }],
        ['flag', state => { state.flagColor = 1; }],
        ['flag emblem', state => { state.emblem = { image: 'data:image/png;base64,eA==', glyph: 'A' }; }],
        ['bridge', state => { state.bridge = { x: 2 }; }],
        ['land', state => { state.land.expanded = 'east'; }],
        ['arrivals', state => { state.arrivals.push('friend'); }],
        ['unopened', state => { state.unopened.push('home'); }],
        ['visitor', state => { state.pier.visitor.variant.color += 1; }],
        ['resident home', state => { state.villagers[0].home = 'pokomoko'; }],
        ['resident absence', state => { state.villagers[0].away = true; }],
        ['resident outfit', state => { state.villagers[0].outfit = { color: 1 }; }],
        ['guidance', state => { state.guidance!.starter.automatic = true; }],
    ];
    it.each(changes)('invalidates when %s changes', (_name, change) => {
        const state = island(), next = structuredClone(state);
        expect(growingSceneStateKey(next)).toBe(growingSceneStateKey(state));
        change(next);
        expect(growingSceneStateKey(next)).not.toBe(growingSceneStateKey(state));
    });

    it('includes new fields and nested receipt-named fields, even when undefined', () => {
        const state = island(), original = growingSceneStateKey(state);
        const next = Object.assign(structuredClone(state), { futureSceneInput: undefined });
        expect(growingSceneStateKey(next)).not.toBe(original);
        const a = Object.assign(structuredClone(state), { futureSceneInput: { placeProgress: 'a', applied: ['a'] } });
        const b = Object.assign(structuredClone(state), { futureSceneInput: { placeProgress: 'b', applied: ['a'] } });
        expect(growingSceneStateKey(a)).not.toBe(growingSceneStateKey(b));
        const nested = Object.assign(structuredClone(state), { futureSceneInput: { optional: undefined } });
        const empty = Object.assign(structuredClone(state), { futureSceneInput: {} });
        expect(growingSceneStateKey(nested)).not.toBe(growingSceneStateKey(empty));
    });
});

describe('GrowingWorld preview inputs', () => {
    const ghost = (): Ghost => ({ kind: 'flower', seed: false, cell: { x: 1, z: 3 }, valid: true, style: 'plain',
        allowed: [{ x: 1, z: 3 }, { x: 2, z: 3 }], ownerId: 'flower', color: 'red', keepsake: undefined });
    const hints: Cell[] = [{ x: 1, z: 4 }, { x: 2, z: 4 }];
    it('reuses equivalent fresh objects and includes selection, all Ghost fields and ordered cells', () => {
        const input = ghost(), initial = growingScenePreviewKey(input, 'flower', hints);
        expect(growingScenePreviewKey(structuredClone(input), 'flower', structuredClone(hints))).toBe(initial);
        for (const next of [{ ...input, kind: 'sapling' as const }, { ...input, seed: true }, { ...input, cell: { x: 2, z: 3 } },
            { ...input, valid: false }, { ...input, style: 'water' as const }, { ...input, keepsake: 'unit-1' },
            { ...input, color: 'blue' as const }, { ...input, ownerId: 'another' }, { ...input, allowed: [...input.allowed].reverse() }])
            expect(growingScenePreviewKey(next, 'flower', hints)).not.toBe(initial);
        expect(growingScenePreviewKey(input, 'another', hints)).not.toBe(initial);
        expect(growingScenePreviewKey(input, 'flower', [...hints].reverse())).not.toBe(initial);
        expect(growingScenePreviewKey(input, 'flower', [{ x: 1, z: 4 }, { x: 3, z: 4 }])).not.toBe(initial);
        expect(growingScenePreviewKey(undefined, 'flower', hints)).not.toBe(initial);
        expect(growingScenePreviewKey(input, undefined, hints)).not.toBe(initial);
        expect(growingScenePreviewKey(input, 'flower', undefined)).not.toBe(initial);
    });
});

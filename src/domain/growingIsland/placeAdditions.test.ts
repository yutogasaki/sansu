import { describe, expect, it } from 'vitest';
import { architectureFixture } from './placeArchitecture.fixture';
import { derivePlaces } from './places';
import { derivePlaceRelations } from './placeRelations';
import { memoryDestination } from './placeMemories';
import { applyIntent } from './commands';
import { advanceNature } from './nature';
import type { Landmark } from './types';

function garden(kind: 'flower' | 'sapling', cells: number[][]) {
    const state = architectureFixture(); state.plots = []; state.drops = 1000;
    state.nature.lastSpread = Math.floor(state.nature.hours / 12);
    state.nature.lastMix = Math.floor(state.nature.hours / 24);
    state.landmarks = cells.map(([x, z], i) => ({ id: `l${i + 1}`, kind, cell: { x, z },
        growth: kind === 'flower' ? 6 : 18, ...(kind === 'sapling' ? { maturedAt: 0 } : {}) }));
    state.nextId = cells.length + 1;
    return state;
}
const square = [[2, 2], [3, 2], [2, 3], [3, 3]];
const row = [[2, 2], [3, 2], [4, 2], [5, 2]];

describe('established places survive additions and later maturation', () => {
    it('keeps a flower roof on its original support owners after placing a fifth flower, blooming and storage', () => {
        const state = garden('flower', square), original = derivePlaces(state).find(p => p.ruleId === 'P05')!;
        const added = applyIntent(state, { id: 'add', command: { type: 'place', kind: 'flower', cell: { x: 4, z: 3 } } }, 0).state;
        const id = added.landmarks.find(owner => !state.landmarks.some(old => old.id === owner.id))!.id;
        for (const growth of [0, 6]) {
            added.landmarks.find(owner => owner.id === id)!.growth = growth;
            const place = derivePlaces(added).find(p => p.ruleId === 'P05')!;
            expect(place.stage).toBe('grown');
            expect(place.flowerRoofs).toContainEqual({ variant: 'canopy', mainIds: original.mainIds });
            expect(place.useTargets.some(target => target.kind === 'garden')).toBe(true);
        }
        const stored = applyIntent(added, { id: 'store', command: { type: 'store', id } }, 0).state;
        expect(derivePlaces(stored).find(p => p.ruleId === 'P05')!.flowerRoofs).toEqual(original.flowerRoofs);
        expect(state.landmarks).toHaveLength(4); expect(state.drops).toBe(1000);
    });

    it('preserves two independently supported roofs after their gardens merge, without consuming the linking flower', () => {
        const state = garden('flower', [...square, ...square.map(([x, z]) => [x + 4, z])]);
        const old = derivePlaces(state).filter(p => p.ruleId === 'P05').flatMap(p => p.flowerRoofs ?? []);
        expect(old).toHaveLength(2);
        state.landmarks.push({ id: 'l9', kind: 'flower', cell: { x: 4, z: 2 }, growth: 6 });
        const place = derivePlaces(state).find(p => p.ruleId === 'P05')!;
        expect(place.mainIds).toHaveLength(9); expect(place.flowerRoofs).toEqual(old);
        const ids = place.flowerRoofs!.flatMap(part => part.mainIds);
        expect(new Set(ids).size).toBe(8); expect(ids).not.toContain('l9');
        expect(derivePlaces(JSON.parse(JSON.stringify(state)))).toEqual(derivePlaces(state));
        state.landmarks.reverse(); expect(derivePlaces(state).find(p => p.ruleId === 'P05')).toEqual(place);
    });

    it('keeps the existing tree gallery while an added side tree matures, and drops it after real support loss', () => {
        const state = garden('sapling', row);
        state.landmarks.push({ id: 'young', kind: 'sapling', cell: { x: 5, z: 3 }, growth: 0 });
        const before = derivePlaces(state).find(p => p.ruleId === 'P02')!;
        expect(before.walkSurface.length).toBeGreaterThan(0);
        advanceNature(state, 18 * 3_600_000);
        expect(state.landmarks.find(owner => owner.id === 'young')!.growth).toBe(18);
        const after = derivePlaces(state).find(p => p.ruleId === 'P02')!;
        expect(after.mainIds).toEqual(before.mainIds); expect(after.walkSurface).toEqual(before.walkSurface);
        state.landmarks[1].cell = undefined; state.landmarks[2].cell = undefined;
        expect(derivePlaces(state).some(p => p.ruleId === 'P02')).toBe(false);
    });

    it('retains normal shade and its memory destination when a young tree is added', () => {
        const state = garden('sapling', [[4, 3]]);
        const old = derivePlaces(state).find(p => p.ruleId === 'P01')!;
        state.landmarks.push({ id: 'young', kind: 'sapling', cell: { x: 5, z: 3 }, growth: 0 });
        const places = derivePlaces(state), shade = places.find(p => p.ruleId === 'P01')!;
        expect(shade.stage).toBe('grown'); expect(shade.mainIds).not.toContain('young');
        expect(shade.useTargets.some(target => target.kind === 'garden')).toBe(true);
        expect(derivePlaces(JSON.parse(JSON.stringify(state)))).toEqual(places);
        expect(memoryDestination({ id: 'memory', kind: 'grown', family: 'grove', at: 0, memberIds: old.mainIds, variant: old.variant }, places)).toBe(old.anchorId);
        const matured = structuredClone(state);
        advanceNature(matured, 18 * 3_600_000);
        expect(derivePlaces(matured).find(p => p.ruleId === 'P01')!.stage).toBe('grown');
        const removed = applyIntent(state, { id: 'remove-mature', command: { type: 'store', id: old.mainIds[0] } }, 0).state;
        expect(derivePlaces(removed).some(p => p.ruleId === 'P01' && p.stage === 'grown')).toBe(false);
    });

    it('retains water/flower relations when young flowers are added', () => {
        const state = garden('flower', []);
        state.landmarks = [{ id: 'water', kind: 'water-bowl', cell: { x: 4, z: 3 }, growth: 0 },
            { id: 'bloomed', kind: 'flower', cell: { x: 5, z: 3 }, growth: 6 }];
        const hasRelation = () => derivePlaceRelations(state).some(relation => relation.id === 'C02');
        expect(hasRelation()).toBe(true);
        state.landmarks.push({ id: 'young-flower', kind: 'flower', cell: { x: 6, z: 3 }, growth: 0 });
        expect(hasRelation()).toBe(true);
    });

    it('does not authorize roofs from immature supports or across a blocked joining gap', () => {
        const state = garden('flower', [[2, 2], [4, 2], [2, 4], [4, 4]]);
        state.landmarks[3].growth = 0;
        expect(derivePlaces(state).find(p => p.ruleId === 'P05')?.flowerRoofs).toBeUndefined();
        state.landmarks[3].growth = 6;
        state.landmarks.push(...[[3, 2], [2, 3], [4, 3], [3, 4]].map(([x, z], i): Landmark => ({ id: `block-${i}`, kind: 'sapling', cell: { x, z }, growth: 0 })));
        expect(derivePlaces(state).filter(p => p.ruleId === 'P05').flatMap(p => p.flowerRoofs ?? [])).toEqual([]);
    });

    it('does not let a newly possible canopy steal the older arch supports', () => {
        const state = garden('flower', row);
        state.landmarks.forEach((owner, i) => { owner.id = `l${i + 1}`; });
        state.landmarks.push(...[[2, 3], [3, 3]].map(([x, z], i): Landmark => ({ id: `l${i + 5}`, kind: 'flower', cell: { x, z }, growth: 6 })));
        expect(derivePlaces(state).find(p => p.ruleId === 'P05')!.flowerRoofs).toEqual([{ variant: 'arch', mainIds: ['l1', 'l2', 'l3', 'l4'] }]);
    });

    it('assigns a nearby home to one local grove and keeps both gallery identities unique after merging', () => {
        const state = garden('sapling', [...row, ...row.map(([x, z]) => [x, z + 4])]);
        state.landmarks.push({ id: 'link', kind: 'sapling', cell: { x: 2, z: 4 }, growth: 18, maturedAt: 0 });
        state.plots = [{ ...architectureFixture().plots[0], cell: { x: 3, z: 4 } }];
        const places = derivePlaces(state).filter(place => place.ruleId === 'P02');
        expect(places).toHaveLength(2); expect(new Set(places.map(place => place.id)).size).toBe(2);
        expect(places.flatMap(place => place.memberIds).filter(id => id === state.plots[0].id)).toHaveLength(1);
        expect(new Set(places.flatMap(place => place.mainIds)).size).toBe(8);
    });
});

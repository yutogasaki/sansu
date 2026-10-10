import { describe, expect, it } from 'vitest';
import { newIsland } from './island';
import { placeGoalCatalog } from './placeCatalog';
import { derivePlaces, placeConnected } from './places';
import { derivePlaceRelations } from './placeRelations';
import { terrainHeightAt } from './placeTerrain';
import { key, reachableFromHome, walkableCells } from './space';
import type { GrowingState, LandmarkKind, SeedKind } from './types';
import type { PlaceGoalId } from './placeTypes';

/** Explicit mature layout fixture, not natural acquisition/elapsed-time evidence. */
export function placeFixture(goalId: PlaceGoalId, variantId: string, offset = { x: 6, z: 1 }): GrowingState {
    const state = newIsland('place-fixture', 1_000);
    state.tutorial = 'done'; state.landmarks = []; state.plots = [];
    state.land = { expanded: 'east', extra: ['west', 'south'], capes: ['east', 'west'] };
    state.nature.hours = 200;
    const goal = placeGoalCatalog.find(g => g.id === goalId)!;
    const variant = goal.variants.find(v => v.id === variantId)!;
    variant.demo.forEach((entry, index) => {
        const input = goal.inputs.find(input => input.role === entry.role)!;
        const [type, kind] = input.kind.split(':');
        const cell = { x: entry.x + offset.x, z: entry.z + offset.z }, id = `${goalId}-${index}`;
        if (type === 'landmark') state.landmarks.push({ id, kind: kind as LandmarkKind, cell, growth: kind === 'sapling' ? 18 : 6,
            ...(kind === 'sapling' ? { maturedAt: 0 } : {}) });
        else state.plots.push({ id, kind: kind as SeedKind, cell, plantedAt: 0, builtAt: 6, stagedAt: 6,
            stage: kind === 'home' ? 2 : 1, style: goalId === 'P02' ? 'tree' : 'plain', growth: 0, origin: 'seed', paid: 40 });
    });
    return state;
}

describe('owned materials derive real places', () => {
    for (const goal of placeGoalCatalog.filter(g => g.id !== 'P06')) for (const variant of goal.variants) {
        it(`${goal.id}/${variant.id} preserves all individual assets and has a reachable grown place`, () => {
            // P03's flat alternatives use the original plain; a tier needs actual expanded slope.
            const offset = goal.id === 'P03' && variant.id !== 'tiered' ? { x: 0, z: variant.id === 'shore' ? 3 : 2 } : { x: 6, z: 1 };
            const state = placeFixture(goal.id, variant.id, offset), before = structuredClone(state);
            const place = derivePlaces(state).find(p => p.ruleId === goal.id);
            expect(place, JSON.stringify(derivePlaces(state))).toBeDefined();
            expect(place?.missing).toEqual([]); expect(place?.stage).toBe('grown');
            expect(place!.entrances.every(cell => reachableFromHome(state).has(key(cell)))).toBe(true);
            expect(place!.useTargets.length).toBeGreaterThan(0);
            expect(new Set(place!.memberIds).size).toBe(place!.memberIds.length);
            expect(state).toEqual(before);
            expect(place?.variant).toBe(variant.id);
            if (goal.id === 'P02') {
                expect(place?.walkSurface.length).toBeGreaterThan(20);
                const first = place!.walkSurface[0], last = place!.walkSurface.at(-1)!;
                expect(last).toEqual(first);
                expect(Math.max(...place!.walkSurface.map(p => p.y)) - first.y).toBeGreaterThan(1);
            }
        });
    }
    it('rejects diagonals and a blocked straight gap; same-owner storage breaks only current shapes', () => {
        const open = new Set(['1,1', '2,1']);
        expect(placeConnected({ x: 1, z: 1 }, { x: 2, z: 2 }, open)).toBe(false);
        expect(placeConnected({ x: 1, z: 1 }, { x: 3, z: 1 }, open)).toBe(true);
        open.delete('2,1'); expect(placeConnected({ x: 1, z: 1 }, { x: 3, z: 1 }, open)).toBe(false);
        const state = placeFixture('P01', 'lane');
        state.landmarks[0].cell = undefined;
        expect(derivePlaces(state).some(p => p.ruleId === 'P01' && p.stage === 'grown')).toBe(false);
        expect(state.landmarks[0].growth).toBe(18);
    });
    it('stable owner ordering has no bearing on component or attachment identity', () => {
        const state = placeFixture('P02', 'court');
        const original = derivePlaces(state);
        state.landmarks.reverse(); state.plots.reverse();
        expect(derivePlaces(state)).toEqual(original);
    });
    it('a reachable open courtyard centre joins the same footprint and physical gallery', () => {
        const state = placeFixture('P02', 'court'), before = structuredClone(state);
        const place = derivePlaces(state).find(p => p.ruleId === 'P02')!;
        const trees = state.landmarks.filter(item => item.kind === 'sapling');
        const center = { x: (Math.min(...trees.map(t => t.cell!.x)) + Math.max(...trees.map(t => t.cell!.x))) / 2,
            z: (Math.min(...trees.map(t => t.cell!.z)) + Math.max(...trees.map(t => t.cell!.z))) / 2 };
        expect(reachableFromHome(state).has(key(center))).toBe(true);
        expect(place.footprint).toContainEqual(center);
        expect(place.walkSurface.some(point => point.x === center.x && point.z === center.z)).toBe(true);
        expect(new Set(place.walkSurface.map(point => `${Math.round(point.x)},${Math.round(point.z)}`)).size).toBeGreaterThan(1);
        expect(state).toEqual(before);
    });
    it('P02 uses built tree-home style, existing big-tree age, and still retains the P01 garden', () => {
        const state = placeFixture('P02', 'lane');
        expect(derivePlaces(state).find(p => p.ruleId === 'P01')?.stage).toBe('grown');
        state.nature.hours = 167;
        expect(derivePlaces(state).find(p => p.ruleId === 'P02')?.stage).toBe('connected');
        state.nature.hours = 168;
        expect(derivePlaces(state).find(p => p.ruleId === 'P02')?.stage).toBe('grown');
        state.plots[0].style = 'plain';
        expect(derivePlaces(state).some(p => p.ruleId === 'P02')).toBe(false);
        expect(state.plots[0].stage).toBe(2);
    });
    it('immature flowers create connected supports then bloom without an extra place clock', () => {
        const state = placeFixture('P05', 'court');
        state.landmarks.filter(l => l.kind === 'flower').forEach(l => { l.growth = 5.99; });
        expect(derivePlaces(state).find(p => p.ruleId === 'P05')?.stage).toBe('connected');
        state.landmarks.filter(l => l.kind === 'flower').forEach(l => { l.growth = 6; });
        expect(derivePlaces(state).find(p => p.ruleId === 'P05')?.stage).toBe('grown');
    });
    it('water loses its grown continuous shape when a channel is stored', () => {
        const state = placeFixture('P03', 'tiered');
        expect(derivePlaces(state).find(p => p.ruleId === 'P03')?.variant).toBe('tiered');
        state.landmarks.find(l => l.kind === 'water-channel')!.cell = undefined;
        expect(derivePlaces(state).some(p => p.ruleId === 'P03' && p.stage === 'grown')).toBe(false);
    });
    it('flat original ground cannot claim a tiered spring', () => {
        const state = placeFixture('P03', 'tiered', { x: 0, z: 1 });
        expect(state.landmarks.filter(l => l.kind === 'water-bowl').map(l => terrainHeightAt(state, l.cell!))).toEqual([0, 0, 0]);
        expect(derivePlaces(state).find(p => p.ruleId === 'P03')?.variant).not.toBe('tiered');
    });
    it('unopened houses never silently form a community roof', () => {
        const state = placeFixture('P04', 'bay');
        state.unopened = state.plots.map(p => p.id);
        expect(derivePlaces(state).some(p => p.ruleId === 'P04')).toBe(false);
    });
    it('courtyard furniture cannot masquerade as walkable interior', () => {
        const state = placeFixture('P05', 'court');
        state.keepsakes.push({ id: 'keepsake', unitId: 'fact', cell: { x: 8, z: 3 } });
        expect(walkableCells(state).has('8,3')).toBe(false);
        expect(derivePlaces(state).find(p => p.ruleId === 'P05')?.variant).not.toBe('court');
    });
    it('large repeated areas preserve all members without a four-tree ownership cap', () => {
        const state = placeFixture('P01', 'lane');
        state.land.districts = Array.from({ length: 8 }, () => 'east' as const);
        for (let i = 0; i < 15; i++) state.landmarks.push({ id: `more-${i}`, kind: 'sapling', cell: { x: 10 + i, z: 2 }, growth: 18, maturedAt: 0 });
        const place = derivePlaces(state).find(p => p.ruleId === 'P01');
        expect(place?.mainIds.length).toBe(17);
    });
    it('a single bench is assigned once across independent families, with a stable winner', () => {
        const state = placeFixture('P01', 'lane', { x: 0, z: 2 });
        state.landmarks = [
            { id: 't1', kind: 'sapling', cell: { x: 0, z: 3 }, growth: 18, maturedAt: 0 },
            { id: 't2', kind: 'sapling', cell: { x: 2, z: 3 }, growth: 18, maturedAt: 0 },
            { id: 'seat', kind: 'bench', cell: { x: 1, z: 4 }, growth: 0 },
            ...[{ x: 0, z: 2 }, { x: 1, z: 2 }, { x: 0, z: 1 }, { x: 1, z: 1 }]
                .map((cell, index) => ({ id: `f${index}`, kind: 'flower' as const, cell, growth: 6 })),
        ];
        const places = derivePlaces(state), chosen = places.filter(p => p.memberIds.includes('seat'));
        expect(chosen).toHaveLength(1);
        expect(places.filter(p => p.stage === 'grown')).toHaveLength(1);
        state.landmarks.reverse();
        expect(derivePlaces(state)).toEqual(places);
    });
    it('unfed ninth channels cannot connect separate ponds into a continuous grown spring', () => {
        const state = placeFixture('P03', 'tiered');
        state.land.districts = Array.from({ length: 14 }, () => 'east' as const);
        state.landmarks = [{ id: 'a', kind: 'water-bowl', cell: { x: 0, z: 4 }, growth: 0 },
            { id: 'b', kind: 'water-bowl', cell: { x: 20, z: 4 }, growth: 0 },
            { id: 'c', kind: 'water-bowl', cell: { x: 40, z: 4 }, growth: 0 },
            { id: 'flower', kind: 'flower', cell: { x: 1, z: 5 }, growth: 6 },
            { id: 'seat', kind: 'bench', cell: { x: 2, z: 5 }, growth: 0 }];
        for (let x = 1; x < 40; x++) if (x !== 20) state.landmarks.push({ id: `channel-${x}`, kind: 'water-channel', cell: { x, z: 4 }, growth: 0 });
        const places = derivePlaces(state).filter(p => p.ruleId === 'P03');
        expect(places).toHaveLength(3);
        expect(places.some(p => p.stage === 'grown')).toBe(false);
    });
    it('a bench outside existing shade never completes a grove just because a canopy was drawn', () => {
        const state = placeFixture('P01', 'lane');
        const seat = state.landmarks.find(l => l.kind === 'bench')!;
        seat.cell = { x: 8, z: 4 };
        expect(derivePlaces(state).find(p => p.ruleId === 'P01')?.stage).toBe('connected');
    });
    it('an entrance blocker changes semantic revision while preserving all original member coordinates', () => {
        const state = placeFixture('P03', 'shore', { x: 0, z: 3 });
        const original = derivePlaces(state).find(p => p.ruleId === 'P03')!;
        const shore = original.useTargets.find(t => t.kind === 'shore')!;
        state.keepsakes.push({ id: 'blocking-keepsake', unitId: 'fact', cell: { ...shore.cell } });
        const current = derivePlaces(state).find(p => p.ruleId === 'P03')!;
        expect(current.stage).toBe('grown'); expect(current.memberIds).toEqual(original.memberIds);
        expect(current.revision).not.toBe(original.revision);
        expect(current.useTargets.find(t => t.kind === 'shore')?.cell).not.toEqual(shore.cell);
    });
});

describe('different grown places share paths rather than economy multipliers', () => {
    it('all four relation types require current mature families and existing influence', () => {
        const state = placeFixture('P05', 'canopy', { x: 5, z: 3 });
        state.landmarks.push({ id: 'tree-a', kind: 'sapling', cell: { x: 6, z: 3 }, growth: 18, maturedAt: 0 },
            { id: 'tree-b', kind: 'sapling', cell: { x: 8, z: 3 }, growth: 18, maturedAt: 0 },
            { id: 'wood-seat', kind: 'bench', cell: { x: 7, z: 2 }, growth: 0 });
        const places = derivePlaces(state);
        const a = places.find(p => p.family === 'grove')!, b = places.find(p => p.family === 'flowers')!;
        // Synthetic role copies exercise the relation gate alone, not a new acquired place.
        a.stage = 'grown'; b.stage = 'grown';
        const spring = { ...a, id: 'spring-test', ruleId: 'P03' as const, family: 'spring' as const };
        const community = { ...b, id: 'community-test', ruleId: 'P04' as const, family: 'community' as const };
        state.landmarks.push({ id: 'water-test', kind: 'water-bowl', cell: { x: 7, z: 3 }, growth: 0 });
        const before = structuredClone(state);
        expect(new Set(derivePlaceRelations(state, [a, b, spring, community]).map(r => r.id))).toEqual(new Set(['C01', 'C02', 'C03', 'C04']));
        expect(state).toEqual(before);
        spring.stage = 'connected';
        expect(derivePlaceRelations(state, [a, b, spring, community]).map(r => r.id)).not.toContain('C01');
    });
});

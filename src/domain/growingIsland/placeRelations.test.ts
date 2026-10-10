import { describe, expect, it } from 'vitest';
import { connectedWaterChannels, waterInfluence } from '../islandLife/waterChannels';
import { foodSupport, genki, housing, playSupport } from './community';
import { waterLayout } from './environment';
import { newIsland } from './island';
import { derivePlaceRelations } from './placeRelations';
import { derivePlaces } from './places';
import { key, occupant, onLand, reachableFromHome } from './space';
import type { GrowingState, LandmarkKind, SeedKind } from './types';
import type { PlaceRelation } from './placeTypes';

/** Direct mature-owned fixtures isolate spatial rules. They are not acquisition or elapsed-time evidence. */
function fresh() {
    const state = newIsland('relations-fixture', 1_000);
    state.tutorial = 'done'; state.landmarks = []; state.plots = [];
    state.land = { expanded: 'east', extra: ['west'], capes: ['east', 'west'] };
    return state;
}
function landmark(state: GrowingState, id: string, kind: LandmarkKind, x: number, z: number) {
    state.landmarks.push({ id, kind, cell: { x, z }, growth: kind === 'sapling' ? 18 : 6,
        ...(kind === 'sapling' ? { maturedAt: 0 } : {}) });
}
function plot(state: GrowingState, id: string, kind: SeedKind, x: number, z: number) {
    state.plots.push({ id, kind, cell: { x, z }, stage: kind === 'home' ? 2 : 1,
        style: 'plain', origin: 'seed', plantedAt: 0, growth: 0, paid: 6 });
}
function grove(state: GrowingState) {
    landmark(state, 'tree-1', 'sapling', 0, 3); landmark(state, 'tree-2', 'sapling', 2, 3);
    landmark(state, 'grove-seat', 'bench', 1, 4);
}
function spring(state: GrowingState) {
    for (const [id, kind, x, z] of [
        ['water-1', 'water-bowl', 4, 1], ['water-2', 'water-bowl', 6, 1], ['water-3', 'water-bowl', 6, 3],
        ['channel-1', 'water-channel', 5, 1], ['channel-2', 'water-channel', 6, 2],
        ['spring-flower', 'flower', 4, 3], ['spring-seat', 'bench', 8, 3],
    ] as const) landmark(state, id, kind, x, z);
}
function flowers(state: GrowingState) {
    for (const [x, z] of [[1, 2], [2, 2], [1, 3], [2, 3]]) landmark(state, `flower-${x}-${z}`, 'flower', x, z);
    landmark(state, 'flower-seat', 'bench', 1, 4);
}
function community(state: GrowingState, offsetX = 0) {
    plot(state, 'home-1', 'home', 4 + offsetX, 2); plot(state, 'home-2', 'home', 8 + offsetX, 2);
    plot(state, 'play', 'play', 6 + offsetX, 4); landmark(state, 'community-water', 'water-bowl', 6 + offsetX, 2);
}
function validOwners(state: GrowingState) {
    for (const item of [...state.landmarks, ...state.plots]) {
        expect(item.cell).toBeDefined(); expect(onLand(state, item.cell!)).toBe(true);
        expect(occupant(state, item.cell!, item.id), `overlap ${item.id}`).toBeUndefined();
    }
}
const economy = (state: GrowingState) => ({ drops: state.drops, town: state.town, nature: state.nature, learned: state.learned,
    housing: housing(state), food: foodSupport(state), play: playSupport(state), genki: genki(state) });
function relation(state: GrowingState, id: PlaceRelation['id']) {
    return derivePlaceRelations(state).filter(relation => relation.id === id);
}

describe('constructed owned place relations', () => {
    for (const [id, first, second, families] of [
        ['C01', grove, spring, ['grove', 'spring']], ['C02', spring, flowers, ['spring', 'flowers']],
        ['C03', grove, community, ['grove', 'community']], ['C04', flowers, community, ['flowers', 'community']],
    ] as const) {
        it(`${id} requires its two real current mature families and retains the original economy`, () => {
            const state = fresh(); first(state); second(state); validOwners(state);
            const before = structuredClone(state), scores = structuredClone(economy(state));
            const places = derivePlaces(state), relations = derivePlaceRelations(state, places);
            const result = relations.find(relation => relation.id === id);
            expect(result).toBeDefined();
            expect(result!.placeIds.map(placeId => places.find(place => place.id === placeId)!.family)).toEqual(families);
            expect(result!.placeIds.every(placeId => places.find(place => place.id === placeId)!.stage === 'grown')).toBe(true);
            expect(result!.path.length - 1).toBeLessThanOrEqual(3);
            expect(result!.path.every(cell => reachableFromHome(state).has(key(cell)))).toBe(true);
            for (let i = 0; i < 4; i++) expect(derivePlaceRelations(state)).toEqual(relations);
            expect(state).toEqual(before); expect(economy(state)).toEqual(scores);
            const family = places.find(place => place.id === result!.placeIds[0])!;
            for (const owner of [...state.landmarks, ...state.plots]) if (family.mainIds.includes(owner.id)) owner.cell = undefined;
            expect(relation(state, id)).toEqual([]);
        });
    }

    it('uses a real shortest route of three cells and rejects four cells between the same mature families', () => {
        const three = fresh(); three.land.districts = ['east']; flowers(three); community(three, 3); validOwners(three);
        const exact = relation(three, 'C04'); expect(exact).toHaveLength(1); expect(exact[0].path.length - 1).toBe(3);
        const four = fresh(); four.land.districts = ['east']; flowers(four); community(four, 4); validOwners(four);
        expect(derivePlaces(four).filter(place => place.stage === 'grown').map(place => place.family)).toEqual(['community', 'flowers']);
        expect(relation(four, 'C04')).toEqual([]);
    });

    it('does not treat straight-line proximity across a blocked route as a connection', () => {
        const state = fresh(); state.land.districts = ['east']; flowers(state); community(state, 3);
        for (let z = 1; z <= 3; z++) landmark(state, `wall-${z}`, 'fence', 4, z);
        validOwners(state);
        expect(derivePlaces(state).filter(place => place.stage === 'grown').map(place => place.family)).toEqual(['community', 'flowers']);
        expect(relation(state, 'C04')).toEqual([]);
    });

    it('cannot fabricate a flower family from diagonal-only flowers beside a community', () => {
        const state = fresh(); community(state, 1);
        for (const [x, z] of [[0, 1], [1, 2], [2, 3], [3, 4]]) landmark(state, `diagonal-${x}`, 'flower', x, z);
        landmark(state, 'diagonal-seat', 'bench', 0, 4); validOwners(state);
        expect(derivePlaces(state).some(place => place.family === 'flowers')).toBe(false);
        expect(relation(state, 'C04')).toEqual([]);
    });

    it('removing a bench assigned to another family also removes its phantom entrance', () => {
        const state = fresh(); state.land.districts = ['east']; flowers(state); community(state, 4);
        landmark(state, 'near-tree-a', 'sapling', 4, 1); landmark(state, 'near-tree-b', 'sapling', 6, 1);
        landmark(state, 'shared-bench', 'bench', 5, 2); validOwners(state);
        const places = derivePlaces(state), roof = places.find(place => place.ruleId === 'P05')!;
        expect(roof.stage).toBe('grown'); expect(roof.memberIds).not.toContain('shared-bench');
        expect(places.find(place => place.ruleId === 'P01')?.memberIds).toContain('shared-bench');
        expect(roof.entrances.some(cell => cell.x === 6 && cell.z === 2)).toBe(false);
        expect(relation(state, 'C04')).toEqual([]);
    });

    it('requires water at actual roof flowers even when neighboring garden cells are wet', () => {
        const state = fresh(); state.land.extra.push('south');
        for (const [id, kind, x, z] of [
            ['w1', 'water-bowl', 2, 1], ['w2', 'water-bowl', 4, 1], ['w3', 'water-bowl', 6, 1],
            ['c1', 'water-channel', 3, 1], ['c2', 'water-channel', 5, 1], ['wf', 'flower', 7, 1],
            ['ws', 'bench', 3, 3], ['fs', 'bench', 4, 7],
        ] as const) landmark(state, id, kind, x + 2, z);
        for (let x = 4; x <= 7; x++) landmark(state, `dry-flower-${x}`, 'flower', x, 5);
        validOwners(state);
        const roof = derivePlaces(state).find(place => place.ruleId === 'P05')!, water = waterLayout(state);
        expect(roof.stage).toBe('grown');
        expect(state.landmarks.filter(item => roof.mainIds.includes(item.id)).every(item => waterInfluence(water, item.cell!) === 0)).toBe(true);
        expect(roof.footprint.some(cell => waterInfluence(water, cell) > 0)).toBe(true);
        expect(relation(state, 'C02')).toEqual([]);
    });

    it('retains the original eight-channel supply and excludes a dry extension from a grown water place', () => {
        const state = fresh(); state.land.districts = ['east'];
        for (let x = 0; x < 3; x++) landmark(state, `source-${x}`, 'water-bowl', x, 3);
        for (let x = 3; x <= 11; x++) landmark(state, `water-channel-${x}`, 'water-channel', x, 3);
        landmark(state, 'waterside', 'flower', 1, 4); landmark(state, 'seat', 'bench', 3, 4); validOwners(state);
        const supply = connectedWaterChannels(waterLayout(state));
        expect(supply.has('10,3')).toBe(true); expect(supply.has('11,3')).toBe(false);
        const waterPlace = derivePlaces(state).find(place => place.ruleId === 'P03')!;
        expect(waterPlace.stage).toBe('grown'); expect(waterPlace.waterRefs).toContain('water-channel-10');
        expect(waterPlace.waterRefs).not.toContain('water-channel-11');
        expect(state.landmarks.find(item => item.id === 'water-channel-11')?.cell).toEqual({ x: 11, z: 3 });
    });
});

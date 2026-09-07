import { describe, expect, it } from 'vitest';
import { createIsland, isValidIslandPlacement } from '../../../domain/island/catalog';
import { findSafeResidentSpawn, planResidentRoute, residentObstacles, residentPointIsClear } from './navigation';
import { chooseReachableResident, residentNeedsInitialSpawn, savedResidentLayoutChanged, suggestReachablePlacement, type ResidentCandidate } from './residentInteraction';
import type { IslandStageItem } from './types';

const residents = (): ResidentCandidate[] => [
    { position: { x: .1, z: 1.6 }, visible: true }, { position: { x: 2.45, z: 1.45 }, visible: true },
    { position: { x: 6.26, z: .83 }, visible: true },
];
const bench = (x = 0, z = 1): IslandStageItem => ({ id: 'bench', kind: 'bench', position: { x, z }, rotation: 0 });
const enclosedBench = () => {
    const target = bench(2.25, 1);
    const flowers: IslandStageItem[] = [[3.5, 1], [3, 2], [1.75, 2], [1, 1], [1.75, 0], [3, 0]]
        .map(([x, z], i) => ({ id: `flower-${i}`, kind: 'flower', position: { x, z }, rotation: 0 }));
    return { target, island: { ...createIsland('test', 0), completedSets: 12, items: [target, ...flowers] } };
};

describe('reachable, replayable island furniture', () => {
    it('gives every visible reachable resident a turn, including the distant fox', () => {
        const target = bench();
        let after = -1;
        const sequence: number[] = [];
        for (let i = 0; i < 6; i++) {
            const choice = chooseReachableResident(residents(), target, [target], 4, after)!;
            sequence.push(choice.index); after = choice.index;
        }
        expect(sequence).toEqual([0, 1, 2, 0, 1, 2]);
    });

    it('does not choose the fox before it is present', () => {
        const candidates = residents(); candidates[2].visible = false;
        const target = bench();
        expect(chooseReachableResident(candidates, target, [target], 2, 1)?.index).toBe(0);
    });

    it('tries another resident when a legally placed object is blocked from the first resident', () => {
        const { target, island } = enclosedBench(), candidates = residents();
        expect(island.items.every(item => isValidIslandPlacement(island, item.id, item.position!))).toBe(true);
        expect(residentPointIsClear(candidates[0].position, true, residentObstacles(island.items, target.id))).toBe(true);
        expect(planResidentRoute(candidates[0].position, target, island.items, 12)).toBeUndefined();
        expect(chooseReachableResident(candidates, target, island.items, 12)?.index).toBe(1);
    });

    it('replays an occupied seat without sending a second resident into it', () => {
        const target = bench(), candidates = residents();
        candidates[1] = { position: { ...target.position! }, visible: true, itemId: target.id };
        const choice = chooseReachableResident(candidates, target, [target], 4, 1);
        expect(choice?.index).toBe(1); expect(choice?.replay).toBe(true);
    });

    it('returns blocked when no visible resident can reach the object', () => {
        const { target, island } = enclosedBench(), candidates = residents();
        candidates[1].position = { x: -1, z: 2 };
        expect(chooseReachableResident(candidates, target, island.items, 12)).toBeUndefined();
    });

    it('keeps an already reachable initial suggestion and does not mutate possessions', () => {
        const target = bench(), island = createIsland('test', 0);
        island.items.push({ ...target, position: undefined });
        const before = JSON.stringify(island);
        const candidates = residents(); candidates[2].visible = false;
        expect(suggestReachablePlacement(island, target, candidates)).toEqual(target.position);
        expect(JSON.stringify(island)).toBe(before);
    });

    it('suggests clear accessible land outside a legally spaced but enclosed flower ring', () => {
        const { target, island } = enclosedBench(), candidates = residents();
        candidates[1].position = { x: -1, z: 2 };
        island.items = island.items.map(item => item.id === target.id ? { ...item, position: undefined } : item);
        const before = JSON.stringify(island), position = suggestReachablePlacement(island, target, candidates);
        expect(position).toBeDefined(); expect(position).not.toEqual(target.position);
        const placed = { ...target, position: position! };
        const items = island.items.map(item => item.id === target.id ? placed : item);
        expect(isValidIslandPlacement({ ...island, items }, target.id, position!)).toBe(true);
        expect(chooseReachableResident(candidates, placed, items, 12)).toBeDefined();
        expect(JSON.stringify(island)).toBe(before);
    });

    it('does not invent a suggestion if there is no available resident', () => {
        const target = bench(), island = createIsland('test', 0);
        expect(suggestReachablePlacement(island, target, residents().map(resident => ({ ...resident, visible: false })))).toBeUndefined();
    });
});

describe('safe initial resident placement', () => {
    it('retains every safe original spawn and leaves saved possessions unchanged', () => {
        const island = { ...createIsland('test', 0), completedSets: 4 }, original = JSON.stringify(island);
        const candidates = residents();
        for (const resident of candidates) expect(findSafeResidentSpawn(resident.position, island.items, 4,
            candidates.filter(other => other !== resident).map(other => other.position))).toEqual(resident.position);
        expect(JSON.stringify(island)).toBe(original);
    });

    it('moves the reproduced lamp-covered otter spawn to clear nearby main land', () => {
        const items: IslandStageItem[] = [
            { id: 'starter-flower', kind: 'flower', position: { x: 1.5, z: .8 }, rotation: 0 },
            { id: 'starter-lantern', kind: 'lantern', position: { x: 0, z: 1 }, rotation: 0 },
            bench(-4, .5),
            { id: 'swing', kind: 'swing', position: { x: -.5, z: 2.5 }, rotation: 0 },
            { id: 'flower', kind: 'flower', position: { x: 1, z: 1.5 }, rotation: 0 },
            { id: 'lamp', kind: 'lantern', position: { x: .5, z: 0 }, rotation: 0 },
        ];
        const candidates = residents(), origin = candidates[0].position, before = JSON.stringify(items);
        const point = findSafeResidentSpawn(origin, items, 4, candidates.slice(1).map(resident => resident.position))!;
        expect(point).toBeDefined(); expect(point).not.toEqual(origin); expect(point.x).toBeLessThan(4.6);
        expect(residentPointIsClear(point, true, residentObstacles(items, ''))).toBe(true);
        expect(Math.hypot(point.x - origin.x, point.z - origin.z)).toBeLessThan(1.5);
        expect(JSON.stringify(items)).toBe(before);
    });

    it('keeps a newly arriving fox on east land when furniture covers its original point', () => {
        const origin = residents()[2].position;
        const items: IslandStageItem[] = [{ id: 'fox-flower', kind: 'flower', position: { ...origin }, rotation: 0 }];
        const point = findSafeResidentSpawn(origin, items, 4)!;
        expect(point).toBeDefined(); expect(point).not.toEqual(origin); expect(point.x).toBeGreaterThan(4.6);
        expect(residentPointIsClear(point, true, residentObstacles(items, ''))).toBe(true);
        expect(findSafeResidentSpawn(origin, items, 0)).toBeUndefined();
    });

    it('does not place a relocated resident on another resident', () => {
        const origin = residents()[0].position;
        const items: IslandStageItem[] = [{ id: 'cover', kind: 'flower', position: { ...origin }, rotation: 0 }];
        const first = findSafeResidentSpawn(origin, items, 4)!;
        const second = findSafeResidentSpawn(origin, items, 4, [first])!;
        expect(Math.hypot(first.x - second.x, first.z - second.z)).toBeGreaterThanOrEqual(.84);
    });

    it('keeps an unspawned resident pending when no safe point exists and allows recovery after storage', () => {
        // Deliberately saturated navigation boundary; placement legality is tested separately.
        const covering: IslandStageItem[] = [];
        for (let x = -4.5; x <= 4.5; x += .5) for (let z = -3.5; z <= 3.5; z += .5) covering.push({
            id: `cover-${x}-${z}`, kind: 'bench', position: { x, z }, rotation: 0,
        });
        const origin = residents()[0].position;
        expect(findSafeResidentSpawn(origin, covering, 4)).toBeUndefined();
        const stored = covering.map(item => ({ ...item, position: undefined }));
        expect(residentNeedsInitialSpawn('otter', 4, 4, true, savedResidentLayoutChanged(covering, stored))).toBe(true);
        expect(findSafeResidentSpawn(origin, stored, 4)).toEqual(origin);
    });

    it('runs only on scene creation, fox arrival, or a saved-space change for pending residents', () => {
        for (const species of ['otter', 'rabbit', 'fox'] as const) {
            expect(residentNeedsInitialSpawn(species, 4)).toBe(true);
            expect(residentNeedsInitialSpawn(species, 4, 4)).toBe(false);
            expect(residentNeedsInitialSpawn(species, 6, 4)).toBe(false);
            expect(residentNeedsInitialSpawn(species, 4, 4, true, false)).toBe(false);
            expect(residentNeedsInitialSpawn(species, 4, 4, false, true)).toBe(false);
        }
        expect(residentNeedsInitialSpawn('fox', 4, 3)).toBe(true);
        expect(residentNeedsInitialSpawn('otter', 4, 3)).toBe(false);
        const item = bench();
        expect(savedResidentLayoutChanged([item], [{ ...item }])).toBe(false);
        expect(savedResidentLayoutChanged([item], [item, { ...item, id: 'unplaced', position: undefined }])).toBe(false);
        expect(savedResidentLayoutChanged([item], [{ ...item, position: { x: 2, z: 1 } }])).toBe(true);
    });
});
